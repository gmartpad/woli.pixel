# Test Plan 02 — Single Image Upload, Analysis & Processing (MVP)

> Covers: Upload -> AI Analysis -> Type Selection -> Sharp Processing -> Download.
> The core workflow and most critical feature.

## Feature Surface

### Backend
- **Routes:** `apps/api/src/routes/images.ts`
  - `POST /upload` — file upload, metadata extraction
  - `POST /:id/analyze` — AI pipeline (vision + classification)
  - `GET /:id` — fetch upload record
  - `POST /:id/process` — Sharp processing + AI explanation
  - `GET /:id/download` — download processed image
- **Services:**
  - `upload-validator.ts` — file validation
  - `image-processor.ts` — Sharp resize/convert/compress pipeline
  - `ai.ts` — `analyzeImage()`, `generateExplanation()`
- **DB:** `imageUploads` table

### Frontend
- **Components:** `UploadZone.tsx`, `UploadProgress.tsx`, `FileInfo.tsx`, `TypeConfirmation.tsx`, `CropModal.tsx`, `ProcessingSpinner.tsx`, `ResultsPanel.tsx`, `ContextPreview.tsx`, `DownloadSection.tsx`
- **Store:** `app-store.ts` — full step state machine
- **API Client:** `uploadImage()`, `processImage()` in `lib/api.ts`

---

## Backend Tests

### `apps/api/src/services/upload-validator.test.ts`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Returns error when file is null | null | `{ valid: false, error: "Nenhum arquivo enviado" }` |
| 2 | Accepts PNG files | File with type image/png | `{ valid: true }` |
| 3 | Accepts JPEG files | File with type image/jpeg | `{ valid: true }` |
| 4 | Accepts GIF files | File with type image/gif | `{ valid: true }` |
| 5 | Accepts WebP files | File with type image/webp | `{ valid: true }` |
| 6 | Rejects unsupported MIME types | File with type image/bmp | `{ valid: false }` |
| 7 | Rejects non-image types | File with type application/pdf | `{ valid: false }` |
| 8 | Rejects files exceeding MAX_FILE_SIZE | 15MB file | `{ valid: false }` |
| 9 | Accepts files at exactly MAX_FILE_SIZE | 10MB file | `{ valid: true }` |

### `apps/api/src/services/image-processor.test.ts`

| # | Test | Scenario | Expected |
|---|------|----------|----------|
| 1 | Resizes to target dimensions (cover) | 2000x1500 -> 1920x1080 target | Output is 1920x1080, adjustments includes "resized" |
| 2 | Contains with transparency | 500x500 -> 128x128, requiresTransparency | Output is 128x128, fit "contain", transparent bg |
| 3 | No resize when dimensions match | 256x256 -> 256x256 target | adjustments does NOT include "resized" |
| 4 | Upscales to minWidth for variable types | 100px wide -> minWidth 200 | Output width >= 200 |
| 5 | Smart crop detection | 4:3 image -> 1:1 target | adjustments includes "smart_cropped" |
| 6 | JPEG format conversion | PNG input, target format jpeg | Output format is jpeg, adjustments includes "format_converted" |
| 7 | PNG format conversion | JPEG input, target format png | Output format is png |
| 8 | JPEG compression within size limit | Large image -> 500KB max | Output size <= 500KB |
| 9 | PNG palette fallback | Large PNG -> 500KB max | Tries palette mode if standard compression exceeds limit |
| 10 | User crop applied before resize | Crop + resize | Crop applied first, then resize to target |
| 11 | Adjustments tracked correctly | Multiple operations | All relevant adjustments present in array |
| 12 | Output file is written to UPLOAD_DIR | Any processing | processedPath exists on disk |

### `apps/api/src/services/ai.test.ts` (mocked OpenAI)

| # | Test | What it verifies |
|---|------|------------------|
| 1 | `analyzeImage` sends image to gpt-4.1-mini | First API call uses vision model with image content |
| 2 | `analyzeImage` sends classification to gpt-4.1-nano | Second API call uses text model (no image) |
| 3 | `analyzeImage` returns combined result | Response merges quality, content, classification, cropSuggestion |
| 4 | `analyzeImage` passes all image types as context | Types JSON included in system prompt |
| 5 | `generateExplanation` returns PT-BR string | Response is non-empty string |
| 6 | `generateExplanation` includes adjustment labels | Translates adjustment keys to PT-BR labels |

### `apps/api/src/routes/images.test.ts`

| # | Test | Method + Path | Expected |
|---|------|---------------|----------|
| 1 | Rejects upload with no file | POST /upload (empty form) | 400 |
| 2 | Rejects unsupported format | POST /upload (bmp file) | 400 |
| 3 | Rejects oversized file | POST /upload (>10MB) | 400 |
| 4 | Successful upload returns metadata | POST /upload (valid PNG) | 201, id, filename, width, height, sizeKb |
| 5 | Upload creates DB record with status "uploaded" | POST /upload | DB row exists with correct status |
| 6 | Analyze returns AI results | POST /:id/analyze | 200, quality, content, suggested_type, crop_suggestion |
| 7 | Analyze caches result on second call | POST /:id/analyze x2 | Second call returns same result without re-calling AI |
| 8 | Analyze updates DB status to "analyzed" | POST /:id/analyze | DB status is "analyzed" |
| 9 | Analyze returns 404 for non-existent ID | POST /fake-id/analyze | 404 |
| 10 | Get upload returns record | GET /:id | 200, full record |
| 11 | Get upload returns 404 for missing | GET /fake-id | 404 |
| 12 | Process requires target_type_id | POST /:id/process (no body) | 400 |
| 13 | Process returns before/after comparison | POST /:id/process | 200, original, processed, adjustments, explanation, download_url |
| 14 | Process updates DB status to "processed" | POST /:id/process | DB status is "processed" |
| 15 | Download returns binary with correct content-type | GET /:id/download | 200, Content-Type matches format |
| 16 | Download supports format conversion query param | GET /:id/download?format=webp | 200, Content-Type: image/webp |
| 17 | Download returns 404 when not processed | GET /:id/download (unprocessed) | 404 |

---

## Frontend Tests

### `apps/web/src/stores/app-store.test.ts`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Initial state is idle with null values | Default store state |
| 2 | `setStep` updates step and clears error | Step transition |
| 3 | `setUpload` sets uploadId, originalImage, and step to "uploading" | Upload action |
| 4 | `setSelectedTypeId` updates selectedTypeId | Type selection |
| 5 | `setError` stores error message | Error handling |
| 6 | `reset` returns to initial state | Full reset |
| 7 | `reset` preserves history | History not cleared |

### `apps/web/src/components/UploadZone.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Renders drop zone when step is "idle" | Drop zone visible |
| 2 | Hidden when step is not "idle" | Returns null for other steps |
| 3 | Shows accepted formats text | "PNG, JPEG, GIF, WebP" visible |
| 4 | Shows max file size | "10 MB" visible |
| 5 | File input accepts correct MIME types | accept attribute is correct |

### `apps/web/src/components/FileInfo.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Displays filename, dimensions, format, size | Original image metadata shown |
| 2 | Hidden when step is "idle" or "uploading" | Returns null |

### `apps/web/src/components/ResultsPanel.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Shows before/after comparison | Original and processed dimensions/sizes |
| 2 | Shows size reduction percentage | Calculated correctly |
| 3 | Shows adjustment list | Each adjustment displayed |
| 4 | Shows AI explanation text | Explanation rendered |
| 5 | Hidden when step is not "processed" | Returns null |

### `apps/web/src/components/DownloadSection.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Shows download button when processed | Button visible |
| 2 | Download link points to correct URL | href includes upload ID |
| 3 | Format selector offers PNG, JPG, WebP | Options rendered |
