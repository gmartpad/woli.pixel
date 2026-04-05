# Avatar History — Design Document

> **Date:** 2026-04-05
> **Author:** Gabriel + Claude
> **Status:** Approved

## Context

When a user clicks "Alterar foto" on the profile settings page, the file picker opens immediately. There is no way to browse or restore previously uploaded avatars. Old avatars persist in S3 (`avatars/{userId}/{timestamp}.webp`) but are not tracked in the database — each upload overwrites `user.image` with a new presigned URL.

Additionally, `user.image` stores a presigned URL with 1-hour expiry, which causes broken images after expiration.

This design introduces a profile image history system with a picker modal, permanent proxy URLs, and immediate S3 cleanup on deletion.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | History table + API proxy route | Simple, no new infrastructure, permanent URLs |
| URL strategy | Proxy route (`GET /api/v1/avatar/:id`) | Eliminates presigned URL expiration globally |
| Deletion | Hard delete (DB + S3 immediately) | No deferred cleanup complexity |
| History limit | 20 avatars per user | Keeps grid manageable, storage bounded |
| UX pattern | Modal with 2 tabs (History default, Upload) | Focused interaction, history-first flow |
| Deletion UX | Single "X" on hover + multi-select bulk mode | Quick deletes + efficient cleanup |
| Migration | Lazy backfill on first history request | No batch migration script needed |

## Database Schema

```sql
CREATE TABLE avatar_history (
  id          TEXT PRIMARY KEY,           -- crypto.randomUUID()
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  s3_key      TEXT NOT NULL,              -- "avatars/{userId}/{timestamp}.webp"
  file_size   INTEGER NOT NULL,           -- bytes
  width       INTEGER NOT NULL,           -- pixels (256)
  height      INTEGER NOT NULL,           -- pixels (256)
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX avatar_history_user_id_idx ON avatar_history(user_id);
```

No `deleted_at` column — all deletions are immediate (DB row + S3 object).

## API Endpoints

### `GET /api/v1/avatar/:id` (proxy route, no auth required)

Streams the avatar image from S3. The ID is an unguessable UUID.

- Looks up `avatar_history` by ID → gets `s3_key` → streams from S3
- Response headers: `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable`
- Returns 404 if not found

### `GET /api/v1/profile/avatar/history` (protected)

Returns the user's avatar history, ordered by `uploaded_at DESC`.

- Response: `{ data: { id, url, uploadedAt, fileSize }[] }`
- Max 20 items (no pagination needed)
- **Lazy backfill:** If 0 rows exist but `user.image` contains a presigned URL (`X-Amz-Signature`), parse the S3 key, verify via `HeadObject`, insert a history row, update `user.image` to proxy URL, then return normally.

### `POST /api/v1/profile/avatar` (protected, existing route modified)

Current behavior preserved: validate → Sharp 256×256 WebP → S3 upload.

New additions:
- Insert row into `avatar_history`
- If user has ≥ 20 active avatars, hard-delete the oldest non-current (DB + S3)
- Set `user.image` to `/api/v1/avatar/{newId}` (proxy URL, not presigned)
- Forward Set-Cookie headers

Response: `{ data: { id, url } }`

### `PUT /api/v1/profile/avatar/:id/restore` (protected)

Sets a historical avatar as the current one.

- Verify ownership + existence
- `auth.api.updateUser({ image: "/api/v1/avatar/{id}" })`
- Forward Set-Cookie headers

Response: `{ data: { id, url } }`

### `DELETE /api/v1/profile/avatar/:id` (protected)

Permanently deletes one avatar.

- Query row to get `s3Key`
- `DELETE FROM avatar_history WHERE id = ? AND user_id = ?`
- `deleteFromS3(s3Key)`
- If deleting current avatar: `auth.api.updateUser({ image: null })`

Response: `{ data: { deleted: true } }`

### `DELETE /api/v1/profile/avatar/bulk` (protected)

Permanently deletes multiple avatars.

- Body: `{ ids: string[] }`
- Same logic as single delete, batched in a transaction
- `batchDeleteObjects(s3Keys)` for S3 cleanup
- If current avatar is in the list: `user.image` → `null`

Response: `{ data: { deleted: number } }`

## Frontend

### Component Tree

```
AvatarUpload (existing, modified — becomes trigger + modal host)
└── AvatarPickerModal (new)
    ├── Tab: AvatarHistoryGrid (new)
    │   ├── AvatarThumbnail (new, reusable)
    │   └── EmptyState (inline)
    └── Tab: AvatarCropUpload (extracted from current AvatarUpload)
```

### Modal UX

- **"Alterar foto"** click opens `AvatarPickerModal` (instead of file picker)
- **History tab** (default): 4-col grid (desktop) / 3-col (mobile) of 64×64 circular thumbnails
  - Current avatar has a ring highlight
  - Clicking a thumbnail selects it (blue ring); "Salvar" calls `PUT /restore`
  - Hovering a non-current thumbnail shows an "X" delete button
  - "Selecionar vários" toggle enters multi-select mode (checkboxes + "Excluir selecionados" button)
  - Footer shows count: "12 fotos"
- **Upload tab**: Contains the existing crop flow (file picker → react-easy-crop → confirm). After upload, auto-switches to History tab.
- **Empty state**: "Nenhuma foto no historico. Envie sua primeira foto!" + button to switch to Upload tab.
- **Deleting current avatar**: Confirmation dialog before proceeding.

### Data Fetching

- History list via React Query: `queryKey: ["avatar-history"]`, `staleTime: 30_000`
- Upload/restore/delete mutations invalidate `["avatar-history"]`
- Session update via `$sessionSignal` (existing pattern)

## Data Flows

### Upload

```
Crop → POST /profile/avatar → Sharp → S3 put → INSERT avatar_history
→ enforce 20-limit → updateUser(image: proxy URL) → Set-Cookie
→ Client: $sessionSignal + invalidateQueries
```

### Restore

```
Select thumbnail → Salvar → PUT /profile/avatar/:id/restore
→ updateUser(image: proxy URL) → Set-Cookie
→ Client: $sessionSignal + close modal
```

### Delete

```
Click "X" or "Excluir selecionados" → DELETE (single or /bulk)
→ DELETE DB rows → deleteFromS3 → if current: updateUser(image: null)
→ Client: invalidateQueries
```

### Migration (lazy backfill)

```
GET /profile/avatar/history returns 0 rows
→ Check user.image for presigned URL signature
→ Parse S3 key → HeadObject → INSERT avatar_history
→ updateUser(image: proxy URL) → return history
```

## Testing Strategy

### Backend (bun:test)

- **Schema:** Insert/cascade/limit enforcement with PGlite
- **`GET /avatar/:id`:** 200 streams WebP, 404 unknown, correct Cache-Control
- **`GET /profile/avatar/history`:** 401 unauth, ordered list, empty array, lazy backfill
- **`POST /profile/avatar`:** Existing tests + history row inserted + proxy URL + 20-limit auto-delete
- **`PUT /profile/avatar/:id/restore`:** 401, 404 other user's avatar, 200 updates user.image
- **`DELETE /profile/avatar/:id`:** 401, 404, deletes DB + S3, current deletion nullifies user.image
- **`DELETE /profile/avatar/bulk`:** Batch delete DB + S3, handles current avatar

### Frontend (vitest + RTL)

- **AvatarPickerModal:** Opens on click, defaults to History tab, tab switching
- **AvatarHistoryGrid:** Thumbnails render, selection, empty state, delete via "X", multi-select + bulk delete, confirmation on current delete
- **AvatarCropUpload:** Crop flow, upload triggers history invalidation
- **AvatarThumbnail:** Current ring, selected ring, hover "X", checkbox in multi-select
