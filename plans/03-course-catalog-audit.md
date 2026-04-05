# Feature 3: Course Catalog Audit Mode

## Overview

Woli has 5,000+ courses with images uploaded over years by different content creators — quality and consistency vary wildly. Instead of validating new uploads one-by-one, Audit Mode lets an administrator point Woli Pixel at a batch of existing catalog images (via folder upload or URL list), scan them all, and generate a comprehensive quality report with actionable recommendations. This turns Woli Pixel from a "gatekeeper for new uploads" into a "diagnostic tool for existing content."

---

## Implementation Plan

### Phase 1: Database Schema

**New table: `audit_jobs`**

```
audit_jobs
├── id (UUID, PK)
├── name (VARCHAR 200) — e.g. "Auditoria Catálogo Q2 2026"
├── description (TEXT, nullable)
├── source_type (VARCHAR 20) — 'folder_upload' | 'url_list'
├── total_images (INT, default 0)
├── scanned_images (INT, default 0)
├── passed_images (INT, default 0) — quality score >= threshold
├── failed_images (INT, default 0)
├── error_images (INT, default 0) — images that couldn't be analyzed
├── avg_quality_score (DECIMAL 3,1, nullable)
├── pass_threshold (INT, default 7) — configurable: images scoring below this "fail"
├── status (VARCHAR 20) — 'created' | 'scanning' | 'completed' | 'error'
├── report_json (JSONB, nullable) — aggregated report data
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

**New table: `audit_items`**

```
audit_items
├── id (UUID, PK)
├── audit_job_id (UUID, FK → audit_jobs.id, NOT NULL)
├── source_url (TEXT, nullable) — original URL if source_type is 'url_list'
├── original_filename (VARCHAR 255)
├── original_width (INT)
├── original_height (INT)
├── original_size_kb (INT)
├── original_format (VARCHAR 10)
├── file_path (TEXT) — local path after download/upload
├── quality_score (INT, nullable) — 1-10
├── content_type (VARCHAR 50, nullable) — from AI analysis
├── quality_issues (TEXT[], nullable)
├── suggested_type_key (VARCHAR 50, nullable)
├── suggestion_confidence (INT, nullable)
├── dominant_colors (TEXT[], nullable)
├── analysis_json (JSONB, nullable)
├── status (VARCHAR 20) — 'pending' | 'scanning' | 'scanned' | 'error'
├── error_message (TEXT, nullable)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

Index: idx_audit_items_job on audit_job_id
Index: idx_audit_items_score on quality_score
```

**File:** `apps/api/src/db/schema.ts`

### Phase 2: Audit Processing Service

**New file:** `apps/api/src/services/audit-processor.ts`

```ts
class AuditProcessor {
  constructor(private concurrencyLimit: number = 3) {}

  async scanItem(item: AuditItem): Promise<AuditItemResult>
  // 1. Read file from disk (already uploaded) or download from URL
  // 2. Extract metadata with Sharp
  // 3. Run AI analysis (Step 1 only — vision analysis, no classification needed)
  // 4. Return quality score, issues, content type, colors

  async runAudit(jobId: string): Promise<void>
  // 1. Load all audit_items for job
  // 2. Process in parallel with semaphore (reuse pattern from batch feature)
  // 3. Update each audit_item with results
  // 4. After all complete, generate aggregate report
  // 5. Update audit_job with stats and report_json

  generateReport(items: AuditItemResult[]): AuditReport
  // Aggregate statistics:
  // - avg/min/max/median quality scores
  // - score distribution histogram (1-2, 3-4, 5-6, 7-8, 9-10)
  // - most common issues (ranked by frequency)
  // - content type distribution
  // - format distribution
  // - size statistics (avg, total, oversized count)
  // - dimension anomalies (images that don't match any standard type)
  // - color palette analysis (most common dominant colors across catalog)
  // - worst offenders list (bottom 10 by quality score)
  // - recommendations list (Portuguese)
}
```

**`AuditReport` type:**
```ts
{
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    avg_score: number;
    median_score: number;
  };
  score_distribution: Record<string, number>;  // "1-2": 5, "3-4": 12, ...
  top_issues: Array<{ issue: string; count: number; percentage: number }>;
  content_type_distribution: Record<string, number>;
  format_distribution: Record<string, number>;
  size_stats: { avg_kb: number; total_mb: number; oversized_count: number };
  worst_offenders: Array<{ filename: string; score: number; issues: string[] }>;
  recommendations: string[];  // Portuguese action items
}
```

### Phase 3: Backend API

**New file:** `apps/api/src/routes/audits.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/audits` | Create audit job. Body: `{ name, description?, pass_threshold? }` |
| `POST` | `/api/v1/audits/:id/upload` | Upload images to audit (multipart, multiple files). Creates audit_items rows |
| `POST` | `/api/v1/audits/:id/add-urls` | Add images by URL. Body: `{ urls: string[] }`. Creates audit_items with source_url. Downloads files to disk |
| `POST` | `/api/v1/audits/:id/scan` | Start scanning all pending audit_items. Returns immediately; processing runs async |
| `GET` | `/api/v1/audits` | List all audit jobs with summary stats |
| `GET` | `/api/v1/audits/:id` | Get audit job details + paginated items. Query params: `page`, `per_page`, `sort_by` (score, filename, status), `filter_status` |
| `GET` | `/api/v1/audits/:id/report` | Get generated report JSON |
| `GET` | `/api/v1/audits/:id/report/export` | Download report as CSV (for spreadsheet analysis) |
| `DELETE` | `/api/v1/audits/:id` | Delete audit job and all associated items + files |

**Mount in `apps/api/src/index.ts`:**
```ts
import { auditsRouter } from "./routes/audits";
app.route("/api/v1/audits", auditsRouter);
```

### Phase 4: Frontend — State

**New file:** `apps/web/src/stores/audit-store.ts`

```ts
type AuditStep = "idle" | "setup" | "uploading" | "scanning" | "report";

type AuditJob = {
  id: string;
  name: string;
  status: string;
  totalImages: number;
  scannedImages: number;
  passedImages: number;
  failedImages: number;
  avgQualityScore: number | null;
  passThreshold: number;
};

type AuditItem = {
  id: string;
  filename: string;
  score: number | null;
  contentType: string | null;
  issues: string[];
  suggestedType: string | null;
  status: string;
};

type AuditState = {
  step: AuditStep;
  currentJob: AuditJob | null;
  items: AuditItem[];
  report: AuditReport | null;
  // Actions
  setStep: (step: AuditStep) => void;
  setCurrentJob: (job: AuditJob) => void;
  setItems: (items: AuditItem[]) => void;
  setReport: (report: AuditReport) => void;
  reset: () => void;
};
```

### Phase 5: Frontend — Components

**New components:**

| Component | File | Description |
|-----------|------|-------------|
| `AuditSetup` | `components/audit/AuditSetup.tsx` | Form: audit name, pass threshold slider (1-10), source type tabs (upload files / paste URLs). Multi-file dropzone or textarea for URLs |
| `AuditProgress` | `components/audit/AuditProgress.tsx` | Large progress bar (scanned / total), live counter, estimated time remaining. Grid of small thumbnails showing scan status per image |
| `AuditReport` | `components/audit/AuditReport.tsx` | Dashboard layout with summary cards (total, passed, failed, avg score), score distribution bar chart, top issues list, content type pie chart |
| `AuditItemsTable` | `components/audit/AuditItemsTable.tsx` | Sortable/filterable table of all audit items. Columns: thumbnail, filename, score (color-coded), content type, issues (truncated), suggested type, status. Click row to expand details |
| `AuditWorstOffenders` | `components/audit/AuditWorstOffenders.tsx` | Top 10 worst images with thumbnails, scores, and specific issues. "Reprocessar" button per image to send to single-image processing flow |
| `AuditExport` | `components/audit/AuditExport.tsx` | Export buttons: CSV, JSON. Print-friendly report view |

**Modified components:**
- `App.tsx`: Add "Auditoria" mode. When active, main content area shows audit flow instead of single-image flow
- Sidebar: Add audit icon + nav item. Show badge with active audit count

### Phase 6: Frontend — API Client

**File:** `apps/web/src/lib/api.ts` (extend)

Add:
- `createAudit(name, description?, passThreshold?): Promise<AuditJob>`
- `uploadAuditImages(auditId, files: File[]): Promise<void>`
- `addAuditUrls(auditId, urls: string[]): Promise<void>`
- `startAuditScan(auditId): Promise<void>`
- `getAudit(auditId): Promise<AuditJobWithItems>`
- `getAuditReport(auditId): Promise<AuditReport>`
- `exportAuditCsv(auditId): Promise<Blob>`
- `listAudits(): Promise<AuditJob[]>`
- `deleteAudit(auditId): Promise<void>`

### Phase 7: Polling / Real-time Updates

While scanning is in progress, the frontend polls `GET /api/v1/audits/:id` every 3 seconds to update progress. When `status === 'completed'`, fetch the report and transition to the report view.

Alternative (future): Server-Sent Events (SSE) endpoint for real-time progress updates.

---

## TDD Test Plan

### Test Infrastructure

**Backend:**
```
apps/api/src/__tests__/
├── services/
│   └── audit-processor.test.ts
├── routes/
│   └── audits.test.ts
└── helpers/
    └── audit-fixtures.ts   — sample audit data, mock images
```

**Frontend:**
```
apps/web/src/__tests__/
├── stores/
│   └── audit-store.test.ts
├── components/
│   ├── AuditSetup.test.tsx
│   ├── AuditProgress.test.tsx
│   ├── AuditReport.test.tsx
│   ├── AuditItemsTable.test.tsx
│   └── AuditWorstOffenders.test.tsx
└── lib/
    └── api-audits.test.ts
```

### Backend Tests

#### 1. Audit Processor Service (`audit-processor.test.ts`)

```
describe("AuditProcessor")
  describe("scanItem")
    ✓ reads image from disk and returns metadata (width, height, format, sizeKb)
    ✓ calls AI analysis and returns quality score + issues
    ✓ returns content_type and dominant_colors from AI
    ✓ handles corrupt/unreadable image gracefully (returns error status)
    ✓ handles missing file path gracefully

  describe("runAudit")
    ✓ processes all pending audit_items in parallel (up to concurrency limit)
    ✓ updates audit_job.scanned_images counter incrementally
    ✓ sets audit_job status to 'completed' when all items scanned
    ✓ continues scanning remaining items when one fails
    ✓ updates passed_images count based on pass_threshold
    ✓ updates failed_images count based on pass_threshold
    ✓ calls generateReport after all items complete

  describe("generateReport")
    ✓ calculates correct avg_score from item scores
    ✓ calculates correct median_score
    ✓ builds score_distribution histogram with correct buckets
    ✓ ranks top_issues by frequency descending
    ✓ calculates percentage for each issue
    ✓ builds content_type_distribution from item content types
    ✓ builds format_distribution from item formats
    ✓ calculates size_stats: avg_kb, total_mb, oversized count
    ✓ selects bottom 10 items for worst_offenders list
    ✓ generates recommendations in Portuguese based on findings
    ✓ handles empty items array (returns zeroed report)
    ✓ handles all items errored (report reflects 0 scores)
    ✓ excludes errored items from score calculations
```

#### 2. Audit Routes Integration (`audits.test.ts`)

```
describe("POST /api/v1/audits")
  ✓ creates audit job with name, returns 201 with id
  ✓ defaults pass_threshold to 7
  ✓ accepts custom pass_threshold (1-10)
  ✓ validates pass_threshold range
  ✓ accepts optional description

describe("POST /api/v1/audits/:id/upload")
  ✓ accepts multiple files in single request
  ✓ creates audit_item row per file
  ✓ updates audit_job.total_images count
  ✓ extracts basic metadata (Sharp) per file
  ✓ saves files to disk under audit-specific subdirectory
  ✓ returns 404 for non-existent audit_id
  ✓ rejects files with invalid MIME types

describe("POST /api/v1/audits/:id/add-urls")
  ✓ accepts array of image URLs
  ✓ creates audit_item row per URL with source_url set
  ✓ downloads each URL and saves to disk
  ✓ handles unreachable URLs gracefully (creates item with error status)
  ✓ validates URL format
  ✓ returns 404 for non-existent audit_id

describe("POST /api/v1/audits/:id/scan")
  ✓ sets audit status to 'scanning'
  ✓ returns 202 Accepted (async processing)
  ✓ returns 400 if audit has no items
  ✓ returns 409 if audit is already scanning

describe("GET /api/v1/audits/:id")
  ✓ returns audit job with summary stats
  ✓ includes paginated items (default page=1, per_page=20)
  ✓ supports sort_by=score ascending
  ✓ supports sort_by=score descending
  ✓ supports filter_status=scanned|error|pending
  ✓ returns 404 for non-existent audit

describe("GET /api/v1/audits")
  ✓ returns all audits sorted by created_at desc
  ✓ returns empty array when none exist

describe("GET /api/v1/audits/:id/report")
  ✓ returns report_json when audit is completed
  ✓ returns 404 when audit not found
  ✓ returns 400 when audit not yet completed

describe("GET /api/v1/audits/:id/report/export")
  ✓ returns CSV with correct headers
  ✓ CSV has one row per audit_item
  ✓ sets Content-Type to text/csv
  ✓ sets Content-Disposition with audit name in filename

describe("DELETE /api/v1/audits/:id")
  ✓ deletes audit job and all audit_items
  ✓ cleans up uploaded files from disk
  ✓ returns 404 for non-existent audit
```

### Frontend Tests

#### 3. Audit Store (`audit-store.test.ts`)

```
describe("useAuditStore")
  ✓ initializes with step 'idle', null job, empty items, null report
  ✓ setStep transitions step
  ✓ setCurrentJob stores job data
  ✓ setItems stores items array
  ✓ setReport stores report data
  ✓ reset clears all state to initial
```

#### 4. AuditSetup Component (`AuditSetup.test.tsx`)

```
describe("AuditSetup")
  ✓ renders name input field
  ✓ renders pass threshold slider with default value 7
  ✓ slider updates displayed value on change
  ✓ renders source type tabs: "Upload Arquivos" and "URLs"
  ✓ "Upload Arquivos" tab shows multi-file dropzone
  ✓ "URLs" tab shows textarea for pasting URLs
  ✓ "Iniciar Auditoria" button disabled when name is empty
  ✓ "Iniciar Auditoria" button disabled when no images/URLs added
  ✓ "Iniciar Auditoria" enabled when name + images provided
  ✓ calls createAudit + uploadAuditImages on submit
```

#### 5. AuditProgress Component (`AuditProgress.test.tsx`)

```
describe("AuditProgress")
  ✓ renders progress bar with scanned/total ratio
  ✓ shows percentage text
  ✓ shows count: "25 de 100 imagens analisadas"
  ✓ updates bar width as scannedImages increases
  ✓ shows "Concluído" badge when status is 'completed'
  ✓ shows error count if error_images > 0
```

#### 6. AuditReport Component (`AuditReport.test.tsx`)

```
describe("AuditReport")
  ✓ renders summary cards: total, passed (green), failed (red), avg score
  ✓ renders score distribution as horizontal bar chart
  ✓ bars have correct widths proportional to counts
  ✓ renders top issues list with frequency and percentage
  ✓ renders recommendations section
  ✓ renders "Exportar CSV" button
  ✓ renders "Exportar JSON" button
```

#### 7. AuditItemsTable Component (`AuditItemsTable.test.tsx`)

```
describe("AuditItemsTable")
  ✓ renders table with correct columns
  ✓ shows thumbnail per row
  ✓ color-codes score: green >= 7, yellow 5-6, red < 5
  ✓ truncates issues to first 2 with "+N mais" indicator
  ✓ click on column header triggers sort
  ✓ status filter dropdown filters rows
  ✓ click on row expands detail panel
  ✓ pagination controls navigate pages
```

#### 8. AuditWorstOffenders Component (`AuditWorstOffenders.test.tsx`)

```
describe("AuditWorstOffenders")
  ✓ shows up to 10 items sorted by score ascending
  ✓ each item shows: thumbnail, filename, score, issue badges
  ✓ "Reprocessar" button links to single-image flow with image pre-loaded
  ✓ renders nothing when all items have score >= threshold
```

### Test Execution Order (TDD Flow)

```
1. audit-processor.test.ts (generateReport)  → implement report generation logic (pure functions)
2. audit-processor.test.ts (scanItem)         → implement single item scanning
3. audit-processor.test.ts (runAudit)         → implement full audit orchestration
4. audits.test.ts                             → implement routes + schema
5. audit-store.test.ts                        → implement Zustand store
6. api-audits.test.ts                         → implement API client
7. AuditSetup.test.tsx                        → implement component
8. AuditProgress.test.tsx                     → implement component
9. AuditReport.test.tsx                       → implement component
10. AuditItemsTable.test.tsx                  → implement component
11. AuditWorstOffenders.test.tsx              → implement component
```

---

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Large audits (1000+ images) overwhelm AI API | Concurrency limit (default 3), process in batches of 50, show progress. Add `AUDIT_AI_CONCURRENCY` env var |
| URL downloads may be slow or fail | Download with 10s timeout, retry once, then mark as error. Don't block other items |
| Report generation may be slow for large datasets | generateReport is a pure function over in-memory array — fast. Pre-compute during scan, don't re-compute on every GET |
| Disk space for downloaded audit images | Store in `./uploads/audits/{auditId}/` subdirectory. DELETE endpoint cleans up. Add max audit size check (e.g., 500 images) |
| Audit scanning is long-running | Return 202 immediately, poll for status. Frontend shows progress bar with ETA |
