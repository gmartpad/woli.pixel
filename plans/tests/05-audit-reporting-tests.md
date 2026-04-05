# Test Plan 05 — Audit & Reporting (Feature 3)

> Covers: Audit job creation, bulk image upload/URL import, concurrent scanning, report generation, CSV export.

## Feature Surface

### Backend
- **Routes:** `apps/api/src/routes/audits.ts`
  - `POST /` — create audit job
  - `POST /:id/upload` — upload multiple files
  - `POST /:id/add-urls` — import images by URL
  - `POST /:id/scan` — start concurrent AI scanning (async, 202)
  - `GET /` — list audits
  - `GET /:id` — get audit + paginated items
  - `GET /:id/report` — get generated report JSON
  - `GET /:id/report/export` — CSV export
  - `DELETE /:id` — cascade delete (items + files)
- **DB:** `auditJobs` table, `auditItems` table
- **Services:** Reuses `ai.ts` for scanning

### Frontend
- **Components:** `AuditSetup.tsx`, `AuditProgress.tsx`, `AuditReport.tsx`
- **Store:** `audit-store.ts`
- **API Client:** `createAudit()`, `uploadAuditImages()`, `addAuditUrls()`, `startAuditScan()`, `getAudit()`, `getAuditReport()`, `listAudits()`, `deleteAudit()`, `exportAuditCsv()`

---

## Backend Tests

### `apps/api/src/routes/audits.test.ts`

#### Audit CRUD

| # | Test | Method | Expected |
|---|------|--------|----------|
| 1 | Create audit with name | POST / | 201, `{ id, name, status: "created" }` |
| 2 | Create audit with custom pass_threshold | POST / `{ pass_threshold: 8 }` | passThreshold === 8 |
| 3 | Create rejects threshold outside 1-10 | POST / `{ pass_threshold: 15 }` | 400 |
| 4 | Create rejects missing name | POST / `{}` | 400 |
| 5 | List audits ordered by createdAt DESC | GET / | 200, most recent first |
| 6 | Get audit includes paginated items | GET /:id?page=1 | 200, items array with pagination |
| 7 | Delete audit cascades items and files | DELETE /:id | 200, items deleted, files removed |

#### File Upload

| # | Test | Method | Expected |
|---|------|--------|----------|
| 8 | Upload multiple files increments totalImages | POST /:id/upload (3 files) | totalImages += 3 |
| 9 | Upload filters invalid file types | POST /:id/upload (1 png + 1 txt) | Only PNG creates auditItem |
| 10 | Upload creates auditItem per valid file | POST /:id/upload | auditItems count matches |
| 11 | Upload saves files to audits/:id/ directory | POST /:id/upload | Files exist on disk |

#### URL Import

| # | Test | Method | Expected |
|---|------|--------|----------|
| 12 | Add URLs creates items for each | POST /:id/add-urls `{ urls: [...] }` | 201, `{ added: N }` |
| 13 | Add URLs handles partial failures | POST /:id/add-urls (1 valid, 1 404) | `{ added: 1, errors: 1 }` |
| 14 | Add URLs rejects empty array | POST /:id/add-urls `{ urls: [] }` | 400 |

#### Scanning

| # | Test | Method | Expected |
|---|------|--------|----------|
| 15 | Scan returns 202 with pending count | POST /:id/scan | 202, `{ status: "scanning", pending: N }` |
| 16 | Scan updates job status to "scanning" | POST /:id/scan | DB status check |
| 17 | Failed scan item does not abort job | 1 of 3 fails | errorImages incremented, scan continues |
| 18 | Scan completion generates report JSON | After scan finishes | reportJson populated with summary, distributions, stats |
| 19 | Scan completion calculates avgQualityScore | After scan finishes | Numeric average of all scores |
| 20 | Scan completion counts passed/failed by threshold | threshold=7, scores [5, 8, 9] | passed=2, failed=1 |

#### Report

| # | Test | Method | Expected |
|---|------|--------|----------|
| 21 | Get report returns 400 if not completed | GET /:id/report (status != "completed") | 400 or appropriate error |
| 22 | Report contains expected structure | GET /:id/report | summary, score_distribution, top_issues, content_type_distribution, format_distribution, size_stats, worst_offenders |
| 23 | Report summary totals are consistent | GET /:id/report | total === passed + failed + errors |
| 24 | Score distribution buckets are correct | Various scores | Correct bucket counts |
| 25 | Top issues sorted by count desc | Multiple issues | Highest count first |
| 26 | Worst offenders are lowest scores | Various scores | Ordered by score ASC |

#### CSV Export

| # | Test | Method | Expected |
|---|------|--------|----------|
| 27 | Export returns text/csv content type | GET /:id/report/export | Content-Type: text/csv |
| 28 | Export has correct headers | GET /:id/report/export | "filename,format,width,height,..." |
| 29 | Export has one row per auditItem | GET /:id/report/export | Row count matches items |
| 30 | Export Content-Disposition is attachment | GET /:id/report/export | Downloadable filename |

---

## Frontend Tests

### `apps/web/src/stores/audit-store.test.ts`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Initial state is idle | Default values |
| 2 | Creating audit sets job ID and transitions step | State update |
| 3 | Adding files updates file list | Files tracked |
| 4 | Scan progress updates counters | Progress state |
| 5 | Reset clears all state | Back to initial |

### `apps/web/src/components/audit/AuditSetup.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Renders name input and threshold slider | Form elements present |
| 2 | Submit disabled without name | Validation |
| 3 | Threshold slider defaults to 7 | Default value |
| 4 | File drop zone accepts multiple files | Multi-file upload |
| 5 | URL input accepts comma-separated URLs | URL import form |

### `apps/web/src/components/audit/AuditProgress.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Shows scanning progress bar | Percentage displayed |
| 2 | Shows scanned/total count | Numbers match |
| 3 | Shows passed/failed/error counts | Color-coded stats |
| 4 | Hidden when not scanning | Returns null for other steps |

### `apps/web/src/components/audit/AuditReport.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Shows summary cards (total, passed, failed, avg score) | Stats rendered |
| 2 | Score distribution chart renders | Visual distribution |
| 3 | Top issues list shows issue names and counts | Issues displayed |
| 4 | Worst offenders table shows filenames and scores | Table rows |
| 5 | Export CSV button triggers download | API called, blob received |
| 6 | Hidden when not completed | Returns null |
