# Feature 1: Batch Upload & Validation

## Overview

Transform Woli Pixel from single-image to multi-image processing. Content Factory teams and Autor-IA workflows generate dozens of assets per course — validating one-by-one is a bottleneck. This feature adds a multi-file upload queue with parallel AI analysis and a summary dashboard showing pass/fail per image.

---

## Implementation Plan

### Phase 1: Database Schema

**New table: `batch_jobs`**

```
batch_jobs
├── id (UUID, PK)
├── name (VARCHAR 100, nullable) — optional user label, e.g. "Curso Onboarding - Imagens"
├── total_images (INT) — count of images in batch
├── completed_images (INT, default 0) — progress counter
├── failed_images (INT, default 0)
├── status (VARCHAR 20) — 'pending' | 'uploading' | 'analyzing' | 'analyzed' | 'processing' | 'processed' | 'error'
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

**Modify table: `image_uploads`**

```
+ batch_id (UUID, nullable, FK → batch_jobs.id) — null for single-image uploads (backwards compatible)
+ batch_index (INT, nullable) — ordering within batch
```

**Index:** `idx_uploads_batch` on `batch_id`

**File:** `apps/api/src/db/schema.ts`
- Add `batchJobs` pgTable definition after `imageUploads`
- Add `batchId` and `batchIndex` columns to `imageUploads`
- Generate new Drizzle migration

### Phase 2: Backend API

**File:** `apps/api/src/routes/batches.ts` (new router)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/batches` | Create empty batch job, return batch ID |
| `POST` | `/api/v1/batches/:batchId/upload` | Upload single file to batch (multipart). Reuses existing upload validation logic. Sets `batch_id` + `batch_index` on the `image_uploads` row |
| `POST` | `/api/v1/batches/:batchId/analyze` | Trigger parallel AI analysis for all uploaded images in batch. Uses `Promise.allSettled()` to process concurrently with a configurable concurrency limit (default: 3) |
| `POST` | `/api/v1/batches/:batchId/process` | Process all analyzed images. Accepts `{ default_type_id?: string, overrides?: Record<uploadId, typeId> }`. Uses AI-suggested type when no override specified |
| `GET` | `/api/v1/batches/:batchId` | Return batch job with all image uploads, statuses, and analysis summaries |
| `GET` | `/api/v1/batches/:batchId/download` | Download all processed images as a ZIP archive |

**Concurrency control:**
- Extract shared upload validation logic into `apps/api/src/services/upload-validator.ts`
- Create `apps/api/src/services/batch-processor.ts` with a semaphore pattern limiting concurrent AI calls (avoid API rate limits)
- Each image follows the same 3-step pipeline (upload → analyze → process), but errors are isolated per-image — one failure doesn't abort the batch

**Batch status progression:**
```
pending → uploading (first file received)
       → analyzing (analyze triggered)
       → analyzed (all images analyzed OR errored)
       → processing (process triggered)
       → processed (all images processed OR errored)
```

Update `completed_images` and `failed_images` counters after each individual image completes.

**Mount in `apps/api/src/index.ts`:**
```ts
import { batchesRouter } from "./routes/batches";
app.route("/api/v1/batches", batchesRouter);
```

### Phase 3: Frontend — State

**File:** `apps/web/src/stores/batch-store.ts` (new store)

```ts
type BatchStep = "idle" | "selecting" | "uploading" | "analyzing" | "reviewed" | "processing" | "completed";

type BatchImage = {
  file: File;
  uploadId: string | null;
  status: "pending" | "uploading" | "uploaded" | "analyzing" | "analyzed" | "processing" | "processed" | "error";
  analysis: AIAnalysis | null;
  selectedTypeId: string | null;
  error: string | null;
};

type BatchState = {
  batchStep: BatchStep;
  batchId: string | null;
  images: BatchImage[];
  // Actions
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  updateImage: (index: number, updates: Partial<BatchImage>) => void;
  setBatchStep: (step: BatchStep) => void;
  reset: () => void;
};
```

### Phase 4: Frontend — API Client

**File:** `apps/web/src/lib/api.ts` (extend existing)

Add functions:
- `createBatch(name?: string): Promise<{ id: string }>`
- `uploadToBatch(batchId: string, file: File): Promise<UploadResult>`
- `analyzeBatch(batchId: string): Promise<void>`
- `processBatch(batchId: string, defaultTypeId?: string, overrides?: Record<string, string>): Promise<void>`
- `getBatch(batchId: string): Promise<BatchResult>`
- `downloadBatch(batchId: string): Promise<Blob>`

### Phase 5: Frontend — Components

**New components:**

| Component | File | Description |
|-----------|------|-------------|
| `BatchUploadZone` | `components/BatchUploadZone.tsx` | Multi-file drag-and-drop. Shows file list with thumbnails, individual remove buttons, total count/size. "Analisar Todas" button |
| `BatchProgressGrid` | `components/BatchProgressGrid.tsx` | Grid of image cards showing upload → analyze → process progress per image. Color-coded: green (done), yellow (in-progress), red (error), gray (pending) |
| `BatchSummary` | `components/BatchSummary.tsx` | Aggregate stats: total images, avg quality score, pass/fail counts, common issues histogram, "Processar Todas" button |
| `BatchReviewTable` | `components/BatchReviewTable.tsx` | Table view of all analyzed images. Columns: thumbnail, filename, quality score, suggested type, selected type (editable dropdown), status. Sort/filter by score or status |
| `BatchDownload` | `components/BatchDownload.tsx` | Download all as ZIP, or individual downloads. Shows total size reduction |

**Modified components:**
- `App.tsx`: Add mode toggle (single / batch) in header. Conditionally render single-image flow or batch flow
- `UploadZone.tsx`: Extract shared drag-and-drop logic into a `useFileDrop` hook reusable by both modes

### Phase 6: App Layout Integration

Add a toggle in the sidebar or header to switch between "Imagem Única" and "Lote" modes. The batch mode replaces the main content area with the batch-specific components. Both modes share the same sidebar, header, and navigation.

---

## TDD Test Plan

### Test Infrastructure Setup

**Backend:** Use `bun:test` (built into Bun runtime). No additional dependencies needed.

```
apps/api/src/__tests__/
├── services/
│   ├── upload-validator.test.ts
│   └── batch-processor.test.ts
├── routes/
│   └── batches.test.ts
└── helpers/
    ├── test-db.ts          — test database setup/teardown
    ├── test-fixtures.ts    — sample image buffers (1x1 PNG, JPEG, etc.)
    └── mock-ai.ts          — mock OpenAI responses
```

**Frontend:** Add Vitest + React Testing Library.

```
apps/web/src/__tests__/
├── stores/
│   └── batch-store.test.ts
├── components/
│   ├── BatchUploadZone.test.tsx
│   ├── BatchProgressGrid.test.tsx
│   ├── BatchSummary.test.tsx
│   └── BatchReviewTable.test.tsx
└── lib/
    └── api-batch.test.ts
```

### Backend Tests

#### 1. Upload Validator Service (`upload-validator.test.ts`)

Write these tests FIRST (before extracting the service):

```
describe("validateUploadFile")
  ✓ accepts PNG file under 10MB
  ✓ accepts JPEG file under 10MB
  ✓ accepts GIF file under 10MB
  ✓ accepts WebP file under 10MB
  ✓ rejects file with unsupported MIME type (e.g., image/bmp)
  ✓ rejects file exceeding MAX_FILE_SIZE
  ✓ rejects null/undefined file
  ✓ rejects file with empty buffer
  ✓ returns normalized format from Sharp metadata
  ✓ returns width, height, sizeKb from Sharp metadata
```

#### 2. Batch Processor Service (`batch-processor.test.ts`)

```
describe("BatchProcessor")
  describe("analyzeInParallel")
    ✓ processes N images concurrently up to concurrency limit
    ✓ continues processing remaining images after one fails
    ✓ returns results array with per-image success/error status
    ✓ updates batch progress counter after each completion
    ✓ sets batch status to 'analyzed' when all complete
    ✓ sets batch status to 'error' only when ALL images fail

  describe("processInParallel")
    ✓ uses AI-suggested type when no override provided
    ✓ uses override type_id when provided for specific image
    ✓ uses default_type_id when no suggestion and no override
    ✓ isolates errors — one image failure doesn't abort batch
    ✓ updates completed_images counter incrementally
```

#### 3. Batch Routes Integration (`batches.test.ts`)

```
describe("POST /api/v1/batches")
  ✓ creates batch job with status 'pending', returns id
  ✓ accepts optional name field
  ✓ returns 201 status

describe("POST /api/v1/batches/:batchId/upload")
  ✓ saves file and creates image_uploads row with batch_id set
  ✓ increments batch_index sequentially
  ✓ updates batch total_images count
  ✓ transitions batch status to 'uploading' on first upload
  ✓ returns 404 for non-existent batch_id
  ✓ applies same file validation as single upload

describe("POST /api/v1/batches/:batchId/analyze")
  ✓ triggers analysis for all uploaded images in batch
  ✓ returns 400 if batch has no images
  ✓ returns 409 if batch is already analyzing
  ✓ updates batch status to 'analyzing'

describe("GET /api/v1/batches/:batchId")
  ✓ returns batch with all image_uploads joined
  ✓ includes per-image analysis results
  ✓ includes aggregate stats (total, completed, failed)
  ✓ returns 404 for non-existent batch

describe("POST /api/v1/batches/:batchId/process")
  ✓ processes all analyzed images
  ✓ accepts default_type_id for bulk type assignment
  ✓ accepts per-image overrides map
  ✓ returns 400 if no images are in 'analyzed' status

describe("GET /api/v1/batches/:batchId/download")
  ✓ returns ZIP file with all processed images
  ✓ ZIP contains properly named files
  ✓ returns 404 if no processed images
  ✓ sets correct Content-Type and Content-Disposition headers
```

### Frontend Tests

#### 4. Batch Store (`batch-store.test.ts`)

```
describe("useBatchStore")
  ✓ initializes with batchStep 'idle' and empty images array
  ✓ addFiles appends BatchImage entries with status 'pending'
  ✓ addFiles deduplicates by filename
  ✓ removeFile splices image at index and reindexes
  ✓ updateImage merges partial updates at specific index
  ✓ setBatchStep transitions step correctly
  ✓ reset clears all state back to initial
```

#### 5. BatchUploadZone Component (`BatchUploadZone.test.tsx`)

```
describe("BatchUploadZone")
  ✓ renders dropzone with multi-file messaging
  ✓ accepts multiple files via input[type=file][multiple]
  ✓ shows file list with thumbnails after selection
  ✓ shows individual remove (X) button per file
  ✓ shows total file count and aggregate size
  ✓ disables "Analisar Todas" button when no files selected
  ✓ enables "Analisar Todas" button when files present
  ✓ calls addFiles on drop event with correct File objects
  ✓ rejects files that fail client-side validation (size/type)
  ✓ shows validation error per rejected file
```

#### 6. BatchProgressGrid Component (`BatchProgressGrid.test.tsx`)

```
describe("BatchProgressGrid")
  ✓ renders a card for each image in batch
  ✓ shows green badge for 'processed' status
  ✓ shows yellow spinner for 'analyzing'/'processing' status
  ✓ shows red badge with error message for 'error' status
  ✓ shows gray badge for 'pending' status
  ✓ shows overall progress bar (completed / total)
  ✓ updates in real-time as individual image statuses change
```

#### 7. BatchSummary Component (`BatchSummary.test.tsx`)

```
describe("BatchSummary")
  ✓ shows total images count
  ✓ calculates and displays average quality score
  ✓ shows pass count (score >= 7) and fail count (score < 7)
  ✓ shows top 3 most common quality issues
  ✓ shows "Processar Todas" button when all analyzed
  ✓ disables "Processar Todas" when some are still analyzing
```

#### 8. BatchReviewTable Component (`BatchReviewTable.test.tsx`)

```
describe("BatchReviewTable")
  ✓ renders table with columns: thumbnail, filename, score, suggested type, selected type, status
  ✓ shows editable type dropdown per row (populated from image-types API)
  ✓ pre-selects AI-suggested type in dropdown
  ✓ calls updateImage when user changes type selection
  ✓ sorts by quality score ascending/descending on column click
  ✓ filters by status when status filter is applied
  ✓ highlights rows with quality score < 5 in red
```

### Test Execution Order (TDD Flow)

```
1. upload-validator.test.ts     → extract validateUploadFile service
2. batch-processor.test.ts      → implement BatchProcessor class
3. batches.test.ts              → implement batch routes
4. batch-store.test.ts          → implement Zustand store
5. api-batch.test.ts            → implement API client functions
6. BatchUploadZone.test.tsx     → implement component
7. BatchProgressGrid.test.tsx   → implement component
8. BatchSummary.test.tsx        → implement component
9. BatchReviewTable.test.tsx    → implement component
```

---

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| OpenAI rate limits with parallel analysis | Semaphore pattern: max 3 concurrent AI calls, configurable via env var `BATCH_AI_CONCURRENCY` |
| ZIP generation memory pressure for large batches | Stream ZIP creation using `archiver` or Bun's built-in compression. Set max batch size (e.g., 50 images) |
| Backwards compatibility with single-image flow | `batch_id` is nullable — all existing single-image code unchanged |
| Long-running batch operations | Return batch ID immediately, poll status via `GET /batches/:id`. Consider SSE for real-time updates |
