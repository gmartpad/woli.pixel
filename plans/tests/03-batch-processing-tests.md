# Test Plan 03 — Batch Upload & Validation (Feature 1)

> Covers: Multi-file upload, concurrent AI analysis, batch processing, batch status tracking.

## Feature Surface

### Backend
- **Routes:** `apps/api/src/routes/batches.ts`
  - `POST /` — create batch job
  - `POST /:batchId/upload` — add image to batch
  - `POST /:batchId/analyze` — concurrent AI analysis (async, 202)
  - `POST /:batchId/process` — concurrent processing with type overrides (async, 202)
  - `GET /:batchId` — batch details + images
  - `GET /` — list all batches
- **DB:** `batchJobs` table + `imageUploads.batchId` + `imageUploads.batchIndex`
- **Services:** Reuses `ai.ts`, `image-processor.ts`, `upload-validator.ts`

### Frontend
- **Components:** `BatchUploadZone.tsx`, `BatchProgressGrid.tsx`, `BatchSummary.tsx`, `BatchReviewTable.tsx`
- **Store:** `batch-store.ts` — `BatchStep`, `BatchImage[]`, actions
- **API Client:** `createBatch()`, `uploadToBatch()`, `analyzeBatch()`, `processBatch()`, `getBatch()`

---

## Backend Tests

### `apps/api/src/routes/batches.test.ts`

| # | Test | Method | Expected |
|---|------|--------|----------|
| 1 | Create batch returns ID and pending status | POST / | 201, `{ id, status: "pending" }` |
| 2 | Create batch with custom name | POST / `{ name: "Lote Teste" }` | 201, name matches |
| 3 | Upload to batch increments totalImages | POST /:id/upload | totalImages incremented, batchIndex assigned |
| 4 | Upload to batch links imageUpload to batchId | POST /:id/upload | imageUploads.batchId set |
| 5 | Upload rejects invalid files | POST /:id/upload (bad type) | 400 |
| 6 | Upload returns 404 for non-existent batch | POST /fake/upload | 404 |
| 7 | Analyze returns 202 with total count | POST /:id/analyze | 202, `{ status: "analyzing", total }` |
| 8 | Analyze updates batch status to "analyzing" | POST /:id/analyze | DB status check |
| 9 | Process accepts default_type_id | POST /:id/process `{ default_type_id }` | 202 |
| 10 | Process accepts per-image overrides | POST /:id/process `{ overrides: {...} }` | 202 |
| 11 | Get batch returns batch + images array | GET /:id | 200, images array with per-image details |
| 12 | Get batch images include analysis results | GET /:id | Each image has qualityScore, contentType |
| 13 | List batches returns ordered array | GET / | 200, array ordered by createdAt |
| 14 | Batch status transitions correctly | Create -> Upload -> Analyze -> Process | Status: pending -> uploading -> analyzing -> analyzed -> processing -> processed |

### Concurrency Tests

| # | Test | Scenario | Expected |
|---|------|----------|----------|
| 15 | Concurrent analysis respects BATCH_AI_CONCURRENCY | 5 images, concurrency=3 | At most 3 concurrent AI calls |
| 16 | Failed analysis does not abort batch | 1 of 3 images fails AI | failedImages=1, completedImages=2, status still reaches "analyzed" |
| 17 | Concurrent processing completes all images | 3 images with types assigned | All 3 processed |

---

## Frontend Tests

### `apps/web/src/stores/batch-store.test.ts`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Initial state: idle, no images | Default values |
| 2 | `addFiles` adds files to images array | Files appear in images[] |
| 3 | `addFiles` deduplicates by filename | Same file not added twice |
| 4 | `removeFile` removes by index | Array shrinks correctly |
| 5 | `updateImage` merges partial updates | Fields updated without overwriting others |
| 6 | `setBatchStep` transitions step | Step updates correctly |
| 7 | `setBatchId` stores batch ID | ID persisted |
| 8 | `reset` returns to initial state | All state cleared |

### `apps/web/src/components/batch/BatchUploadZone.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Renders multi-file drop zone | Drop zone accepts multiple files |
| 2 | Shows file count after selection | "N arquivos selecionados" |
| 3 | Displays file list with names and sizes | Each file shown |
| 4 | Remove button removes file from list | File removed from store |

### `apps/web/src/components/batch/BatchProgressGrid.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Shows progress card per image | One card per BatchImage |
| 2 | Cards show status indicators (pending, analyzing, analyzed, error) | Correct status badge |
| 3 | Error cards show error message | Error text displayed |

### `apps/web/src/components/batch/BatchSummary.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Shows total/completed/failed counts | Numbers match store state |
| 2 | Shows progress bar | Percentage calculated correctly |

### `apps/web/src/components/batch/BatchReviewTable.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Table renders one row per analyzed image | Row count matches images |
| 2 | Each row shows filename, quality score, suggested type | Columns populated |
| 3 | Type override dropdown works | Changing type updates store |
