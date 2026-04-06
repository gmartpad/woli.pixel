# Multi-Select for History Grid — Design

## Problem

The history page only supports single-item actions. Users who need to delete or download multiple images must repeat the same flow for each item individually — click card, wait for panel, click action, confirm. This is tedious for bulk operations.

## Solution

Add a **selection mode** (Google Photos / Apple Photos pattern) where users can select multiple items and execute batch actions from a floating toolbar.

## User Flow

### Entering Selection Mode
- **Explicit**: "Selecionar" button in the filter bar area
- **Gesture**: Long-press on a card (touch devices)

### In Selection Mode
- Filter bar is replaced by a **selection toolbar**
- Cards show a **checkbox overlay** (top-left, replacing status dot)
- Three-dot action menu is hidden
- Tapping a card toggles its selection (does NOT open detail panel)
- Toolbar shows: `✕ | {n} selecionados | Selecionar todos | [Baixar] [Excluir]`

### Exiting Selection Mode
- ✕ button in the selection toolbar
- After a batch action completes (delete or download)
- When the last selected item is deselected (count reaches 0)

### Mutual Exclusivity
- Entering selection mode closes the detail panel
- Opening the detail panel exits selection mode

## Batch Actions

### Batch Delete
- Confirmation dialog: "Tem certeza que deseja excluir **N imagens**?"
- Fires a single bulk API request
- On success: exit selection mode, invalidate history cache

### Batch Download (ZIP)
- No confirmation needed
- Fires a POST request, receives a ZIP stream
- Browser triggers download of the ZIP file
- On success: exit selection mode

## State Management — History Store

New state in `history-store.ts`:

```ts
selectionMode: boolean
selectedIds: Set<string>

enterSelectionMode(firstId?: string): void
exitSelectionMode(): void
toggleItem(id: string): void
selectAll(ids: string[]): void
deselectAll(): void  // auto-exits when count → 0
```

## Component Changes

| Component | Change |
|-----------|--------|
| `HistoryCard` | New `selectionMode`, `isChecked`, `onToggle` props. In selection mode: checkbox overlay, hide three-dot, click toggles |
| `HistoryGrid` | Pass selection props through to cards |
| `HistoryPage` | Orchestrate selection mode, render `SelectionToolbar`, handle long-press entry |
| `SelectionToolbar` | **New** — sticky bar with count, select all, download, delete |
| `DeleteConfirmDialog` | Support plural: "N imagens" when count > 1 |

## Backend — New Endpoints

### `DELETE /api/v1/history/bulk`

Request:
```json
{ "items": [{ "id": "abc", "mode": "generation" }, { "id": "def", "mode": "upload" }] }
```
Response: `204 No Content`

Implementation: Drizzle `inArray()` for DB, iterate S3 deletions, all in a transaction. Follows existing `bulkDeleteAvatars` pattern.

### `POST /api/v1/history/download`

Request:
```json
{ "ids": ["abc", "def", "ghi"] }
```
Response: `application/zip` stream with `Content-Disposition: attachment; filename="woli-pixel-images.zip"`

Implementation: Streaming ZIP (archiver or similar) piping files from S3 without buffering the full archive in memory.

## Frontend API

```ts
// api.ts
bulkDeleteHistory(items: { id: string; mode: string }[]): Promise<void>
bulkDownloadHistory(ids: string[]): Promise<Blob>
```

Two new mutations in `HistoryPage`:
- Bulk delete → invalidates `["history"]`, exits selection mode
- Bulk download → creates download link from Blob, exits selection mode

## Testing Strategy

| Layer | Tests |
|-------|-------|
| `SelectionToolbar` | Renders count, calls onDelete/onDownload/onCancel/onSelectAll |
| `HistoryCard` | Selection mode shows checkbox, click toggles, three-dot hidden |
| `HistoryPage` | Long-press enters selection mode, actions fire mutations, auto-exit |
| `DeleteConfirmDialog` | Plural message when count > 1 |
| Backend bulk delete | Route test: multiple items, DB + S3 cleanup |
| Backend bulk download | Route test: returns valid ZIP stream |
| History store | Direct state tests: enter/exit, toggle, selectAll, auto-exit on empty |
