# Test Plan 01 — Image Types (Read-Only Presets)

> Covers: `imageTypes` table, `GET /api/v1/image-types` routes, `fetchImageTypes()` client, seed data integrity.

## Feature Surface

### Backend
- **Route:** `apps/api/src/routes/image-types.ts`
  - `GET /` — returns all 19 types grouped by category
  - `GET /:id` — returns single type by UUID
- **DB:** `imageTypes` table (19 rows seeded)
- **Seed:** `apps/api/src/db/seed.ts` — IMAGE_TYPES_SEED array

### Frontend
- **API Client:** `fetchImageTypes()` in `lib/api.ts`
- **Component:** `TypeConfirmation.tsx` — tabs, cards, selection
- **Store:** `app-store.ts` — `selectedTypeId` state

---

## Backend Tests

### `apps/api/src/db/seed.test.ts` — Seed Data Integrity

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Seed array has exactly 19 entries | No accidental additions/removals |
| 2 | Every typeKey is unique | No duplicates |
| 3 | Every entry has required fields (category, typeKey, displayName, maxFileSizeKb, allowedFormats, recommendedFormat, previewContext) | Schema compliance |
| 4 | Categories are one of: admin, content, user, gamification | Valid categories only |
| 5 | Types with fixed dimensions have both width AND height | No partial dimension specs |
| 6 | Types with requiresTransparency=true include "png" in allowedFormats | PNG required for transparency |
| 7 | Admin category count is 9 | Category A completeness |
| 8 | Content category count is 4 | Category B completeness |
| 9 | User category count is 1 | Category C completeness |
| 10 | Gamification category count is 5 | Category D completeness |

### `apps/api/src/routes/image-types.test.ts` — Route Tests

| # | Test | Method | Expected |
|---|------|--------|----------|
| 1 | Returns all types grouped by category | GET / | 200, body.grouped has 4 categories, body.total === 19 |
| 2 | Each category group is a non-empty array | GET / | Every grouped[cat].length > 0 |
| 3 | Type objects have expected shape | GET / | id, typeKey, displayName, category, width, height, maxFileSizeKb, allowedFormats present |
| 4 | Returns single type by valid ID | GET /:id | 200, body matches seeded type |
| 5 | Returns 404 for non-existent ID | GET /:id | 404, `{ error }` |
| 6 | Returns 404 for malformed UUID | GET /not-a-uuid | 404 or 400 |

---

## Frontend Tests

### `apps/web/src/lib/api.test.ts` — API Client (partial: image-types)

| # | Test | What it verifies |
|---|------|------------------|
| 1 | `fetchImageTypes()` calls correct URL | Fetches `${API_URL}/image-types` |
| 2 | Returns parsed JSON on success | Body is parsed correctly |
| 3 | Throws on non-OK response | Error propagation |

### `apps/web/src/components/TypeConfirmation.test.tsx` — Component

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Not rendered when step is "idle" | Returns null |
| 2 | Renders category tabs when step is "uploaded" | Tab buttons for Admin, Conteudo, Usuario, Gamificacao |
| 3 | Clicking a tab switches the displayed types | Panel content changes |
| 4 | Clicking a type card selects it | selectedTypeId updates in store |
| 5 | Selected card shows checkmark icon | Visual selection indicator |
| 6 | Type cards display dimensions or "variavel" | Correct dimension text |
| 7 | Type cards show file size and format badges | maxFileSizeKb, allowedFormats rendered |
| 8 | "Processar Imagem" button disabled without selection | Button has disabled attribute |
| 9 | "Processar Imagem" button enabled with selection | Button is clickable |
