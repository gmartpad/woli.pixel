# Feature 4: Autor-IA Quality Gate

## Overview

Autor-IA is Woli's AI-powered course authoring tool that generates images aligned to course themes. Currently, these generated images go directly into courses without quality validation. This feature creates an API-based quality gate that Autor-IA (or any external system) can call to validate images before publishing. An administrator configures pass/fail thresholds, and the API returns a clear verdict with actionable feedback.

---

## Implementation Plan

### Phase 1: Database Schema

**New table: `quality_gate_configs`**

```
quality_gate_configs
├── id (UUID, PK)
├── name (VARCHAR 100) — e.g. "Autor-IA Padrão", "Conteúdo Premium"
├── is_active (BOOLEAN, default true)
├── min_quality_score (INT, default 6) — minimum score (1-10) to pass
├── max_file_size_kb (INT, nullable) — override per-type max if set
├── require_no_blur (BOOLEAN, default true)
├── require_no_low_resolution (BOOLEAN, default true)
├── require_min_width (INT, nullable) — e.g. 800px minimum
├── require_min_height (INT, nullable)
├── allowed_content_types (TEXT[], nullable) — e.g. ["photo", "illustration"]. Null = accept all
├── blocked_content_types (TEXT[], nullable) — e.g. ["screenshot"]. Null = block none
├── brand_profile_id (UUID, nullable, FK → brand_profiles.id) — optional brand check
├── webhook_secret (VARCHAR 64, nullable) — HMAC secret for authenticating webhook calls
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

**New table: `gate_results`**

```
gate_results
├── id (UUID, PK)
├── gate_config_id (UUID, FK → quality_gate_configs.id)
├── image_upload_id (UUID, FK → image_uploads.id)
├── verdict (VARCHAR 10) — 'pass' | 'fail' | 'warn'
├── quality_score (INT) — 1-10
├── failures (TEXT[]) — array of specific failure reasons
├── warnings (TEXT[]) — array of warnings (non-blocking issues)
├── metadata_json (JSONB) — full analysis snapshot at time of check
├── source (VARCHAR 50) — 'autor_ia' | 'api' | 'manual' | 'webhook'
├── source_reference (VARCHAR 200, nullable) — external ID from calling system
├── checked_at (TIMESTAMP)
└── created_at (TIMESTAMP)
```

**Index:** `idx_gate_results_verdict` on `verdict`
**Index:** `idx_gate_results_config` on `gate_config_id`
**Index:** `idx_gate_results_source` on `source, source_reference`

**File:** `apps/api/src/db/schema.ts`

### Phase 2: Quality Gate Evaluation Service

**New file:** `apps/api/src/services/quality-gate.ts`

```ts
type GateEvaluation = {
  verdict: "pass" | "fail" | "warn";
  quality_score: number;
  failures: string[];   // reasons for failure (Portuguese)
  warnings: string[];   // non-blocking issues (Portuguese)
  details: {
    score_check: { required: number; actual: number; passed: boolean };
    blur_check: { required: boolean; detected: boolean; passed: boolean };
    resolution_check: { required: boolean; detected: boolean; passed: boolean };
    dimension_check?: { min_w: number; min_h: number; actual_w: number; actual_h: number; passed: boolean };
    content_type_check?: { allowed: string[] | null; blocked: string[] | null; actual: string; passed: boolean };
    file_size_check?: { max_kb: number; actual_kb: number; passed: boolean };
    brand_check?: { score: number; threshold: number; passed: boolean };
  };
};

export function evaluateGate(
  config: QualityGateConfig,
  analysis: AnalysisResult,
  imageMetadata: { width: number; height: number; sizeKb: number },
  brandResult?: BrandConsistencyResult
): GateEvaluation
```

**Evaluation logic:**
1. Check `quality_score >= min_quality_score` → failure if below
2. Check `blur_detected === false` if `require_no_blur` → failure if blurry
3. Check `low_resolution === false` if `require_no_low_resolution` → failure if low-res
4. Check `width >= require_min_width` and `height >= require_min_height` if set → failure if too small
5. Check `content_type` against `allowed_content_types` (whitelist) → failure if not in list
6. Check `content_type` against `blocked_content_types` (blacklist) → failure if in list
7. Check `sizeKb <= max_file_size_kb` if set → failure if too large
8. Check `brand_score >= threshold` if brand_profile_id set → warning (not failure) if below

**Verdict:**
- `pass`: zero failures
- `fail`: one or more failures
- `warn`: zero failures but one or more warnings

### Phase 3: Webhook Authentication

**New file:** `apps/api/src/middleware/webhook-auth.ts`

```ts
import { createHmac, timingSafeEqual } from "crypto";

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean
// HMAC-SHA256 with timing-safe comparison
// Signature header: X-Woli-Signature: sha256=<hex>
```

### Phase 4: Backend API

**New file:** `apps/api/src/routes/quality-gates.ts`

**Config management:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/quality-gates` | Create gate config |
| `GET` | `/api/v1/quality-gates` | List all gate configs |
| `GET` | `/api/v1/quality-gates/:id` | Get gate config details |
| `PUT` | `/api/v1/quality-gates/:id` | Update gate config |
| `DELETE` | `/api/v1/quality-gates/:id` | Delete gate config |

**Validation endpoints (the core API for external systems):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/quality-gates/:id/validate` | Full validation: upload image + analyze + evaluate. Multipart form: file + optional `source` and `source_reference` fields. Returns GateEvaluation. This is the main endpoint Autor-IA calls |
| `POST` | `/api/v1/quality-gates/:id/validate-url` | Same but accepts `{ url: string, source?, source_reference? }`. Downloads image from URL first |
| `GET` | `/api/v1/quality-gates/:id/history` | List recent gate results for this config. Paginated. Filterable by verdict |

**Webhook endpoint:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/webhooks/quality-gate` | Incoming webhook. Body: `{ gate_id, image_url, source_reference, callback_url? }`. Verifies HMAC signature. Processes async, POSTs result to callback_url if provided |

**Integration flow for Autor-IA:**
```
Autor-IA generates image
  → POST /api/v1/quality-gates/{configId}/validate (with image file)
  → Woli Pixel: upload → AI analyze → evaluate gate rules
  → Returns: { verdict: "pass" | "fail" | "warn", failures: [...], quality_score: N }
  → Autor-IA: if pass → embed in course; if fail → regenerate or flag for human review
```

### Phase 5: Frontend — Configuration UI

**New file:** `apps/web/src/stores/gate-store.ts`

```ts
type QualityGateConfig = {
  id: string;
  name: string;
  isActive: boolean;
  minQualityScore: number;
  maxFileSizeKb: number | null;
  requireNoBlur: boolean;
  requireNoLowResolution: boolean;
  requireMinWidth: number | null;
  requireMinHeight: number | null;
  allowedContentTypes: string[] | null;
  blockedContentTypes: string[] | null;
  brandProfileId: string | null;
  webhookSecret: string | null;
};

type GateResult = {
  id: string;
  verdict: "pass" | "fail" | "warn";
  qualityScore: number;
  failures: string[];
  warnings: string[];
  source: string;
  sourceReference: string | null;
  checkedAt: string;
};

type GateState = {
  configs: QualityGateConfig[];
  selectedConfigId: string | null;
  results: GateResult[];
  // Actions
  setConfigs: (configs: QualityGateConfig[]) => void;
  setSelectedConfig: (id: string | null) => void;
  setResults: (results: GateResult[]) => void;
};
```

**New components:**

| Component | File | Description |
|-----------|------|-------------|
| `GateConfigManager` | `components/gates/GateConfigManager.tsx` | List of gate configs with create/edit/delete. Card-based layout |
| `GateConfigForm` | `components/gates/GateConfigForm.tsx` | Form: name, min score slider (1-10), blur toggle, resolution toggle, min dimensions inputs, content type multi-select (whitelist), blocked types multi-select, file size limit input, brand profile dropdown, webhook secret with generate/copy buttons |
| `GateResultsDashboard` | `components/gates/GateResultsDashboard.tsx` | Stats: pass/fail/warn counts, pass rate %, recent results table. Filterable by verdict, date range |
| `GateApiDocs` | `components/gates/GateApiDocs.tsx` | In-app API reference showing endpoint URLs, example curl commands, request/response schemas. Auto-includes the selected gate's ID and webhook secret in examples |
| `GateTestPanel` | `components/gates/GateTestPanel.tsx` | Upload a test image and run it against selected gate config. Shows full GateEvaluation result with pass/fail badges per check |

**Modified components:**
- `App.tsx`: Add "Quality Gate" nav item in sidebar
- Sidebar: Add gate icon

### Phase 6: Frontend — API Client

**File:** `apps/web/src/lib/api.ts` (extend)

Add:
- `createGateConfig(data): Promise<QualityGateConfig>`
- `getGateConfigs(): Promise<QualityGateConfig[]>`
- `getGateConfig(id): Promise<QualityGateConfig>`
- `updateGateConfig(id, data): Promise<QualityGateConfig>`
- `deleteGateConfig(id): Promise<void>`
- `validateImage(gateId, file: File): Promise<GateEvaluation>`
- `getGateHistory(gateId, params): Promise<PaginatedResults<GateResult>>`

---

## TDD Test Plan

### Test Infrastructure

**Backend:**
```
apps/api/src/__tests__/
├── services/
│   └── quality-gate.test.ts
├── middleware/
│   └── webhook-auth.test.ts
├── routes/
│   └── quality-gates.test.ts
└── helpers/
    └── gate-fixtures.ts   — sample configs, analysis results
```

**Frontend:**
```
apps/web/src/__tests__/
├── stores/
│   └── gate-store.test.ts
├── components/
│   ├── GateConfigForm.test.tsx
│   ├── GateResultsDashboard.test.tsx
│   ├── GateTestPanel.test.tsx
│   └── GateApiDocs.test.tsx
└── lib/
    └── api-gates.test.ts
```

### Backend Tests

#### 1. Quality Gate Evaluation Service (`quality-gate.test.ts`)

Write FIRST — pure function, no dependencies:

```
describe("evaluateGate")
  describe("quality score check")
    ✓ passes when score >= min_quality_score
    ✓ fails when score < min_quality_score
    ✓ includes correct failure message in Portuguese
    ✓ details.score_check has correct required/actual/passed values

  describe("blur check")
    ✓ passes when require_no_blur=true and blur_detected=false
    ✓ fails when require_no_blur=true and blur_detected=true
    ✓ skips check when require_no_blur=false (always passes)

  describe("resolution check")
    ✓ passes when require_no_low_resolution=true and low_resolution=false
    ✓ fails when require_no_low_resolution=true and low_resolution=true
    ✓ skips check when require_no_low_resolution=false

  describe("dimension check")
    ✓ passes when image dimensions >= required minimums
    ✓ fails when width < require_min_width
    ✓ fails when height < require_min_height
    ✓ skips check when require_min_width and require_min_height are null

  describe("content type check - whitelist")
    ✓ passes when content type is in allowed_content_types
    ✓ fails when content type is not in allowed_content_types
    ✓ skips check when allowed_content_types is null

  describe("content type check - blacklist")
    ✓ passes when content type is not in blocked_content_types
    ✓ fails when content type is in blocked_content_types
    ✓ skips check when blocked_content_types is null

  describe("file size check")
    ✓ passes when sizeKb <= max_file_size_kb
    ✓ fails when sizeKb > max_file_size_kb
    ✓ skips check when max_file_size_kb is null

  describe("brand check")
    ✓ adds warning (not failure) when brand score below threshold
    ✓ no warning when brand score above threshold
    ✓ skips check when no brand result provided

  describe("verdict determination")
    ✓ returns 'pass' when zero failures and zero warnings
    ✓ returns 'fail' when one or more failures
    ✓ returns 'warn' when zero failures but warnings present
    ✓ returns all failure messages in failures array
    ✓ returns all warning messages in warnings array

  describe("combined scenarios")
    ✓ image with score=9, no blur, high res, valid type → pass
    ✓ image with score=3, blur, low res → fail with 3 failures
    ✓ image with score=8, no issues, low brand score → warn
    ✓ config with all checks disabled → always pass (only score matters)
```

#### 2. Webhook Auth Middleware (`webhook-auth.test.ts`)

```
describe("verifyWebhookSignature")
  ✓ returns true for valid HMAC-SHA256 signature
  ✓ returns false for invalid signature
  ✓ returns false for empty signature
  ✓ returns false for malformed signature (missing sha256= prefix)
  ✓ is timing-safe (uses timingSafeEqual)
  ✓ handles different payload lengths correctly
```

#### 3. Quality Gate Routes Integration (`quality-gates.test.ts`)

```
describe("Config CRUD")
  describe("POST /api/v1/quality-gates")
    ✓ creates config with required fields, returns 201
    ✓ defaults min_quality_score to 6
    ✓ defaults require_no_blur to true
    ✓ accepts all optional fields
    ✓ generates webhook_secret when requested

  describe("GET /api/v1/quality-gates")
    ✓ returns all configs
    ✓ returns empty array when none exist

  describe("GET /api/v1/quality-gates/:id")
    ✓ returns config details
    ✓ returns 404 for non-existent id

  describe("PUT /api/v1/quality-gates/:id")
    ✓ updates specified fields
    ✓ returns 404 for non-existent id

  describe("DELETE /api/v1/quality-gates/:id")
    ✓ deletes config
    ✓ returns 404 for non-existent id

describe("Validation endpoints")
  describe("POST /api/v1/quality-gates/:id/validate")
    ✓ accepts image file via multipart form
    ✓ uploads image, runs AI analysis, evaluates gate
    ✓ returns GateEvaluation with verdict, score, failures, warnings
    ✓ creates gate_results record
    ✓ stores source and source_reference from form fields
    ✓ returns 404 for non-existent gate config
    ✓ returns 400 for missing file
    ✓ returns 400 for invalid file type

  describe("POST /api/v1/quality-gates/:id/validate-url")
    ✓ downloads image from URL
    ✓ processes same as file upload after download
    ✓ returns 400 for unreachable URL
    ✓ returns 400 for non-image URL

  describe("GET /api/v1/quality-gates/:id/history")
    ✓ returns paginated gate results
    ✓ filters by verdict when query param provided
    ✓ sorted by checked_at desc

describe("Webhook endpoint")
  describe("POST /api/v1/webhooks/quality-gate")
    ✓ returns 401 when X-Woli-Signature header missing
    ✓ returns 401 when signature invalid
    ✓ returns 202 when signature valid (async processing)
    ✓ processes image and POSTs result to callback_url
    ✓ creates gate_results record with source='webhook'
```

### Frontend Tests

#### 4. Gate Store (`gate-store.test.ts`)

```
describe("useGateStore")
  ✓ initializes with empty configs, null selectedConfigId, empty results
  ✓ setConfigs stores configs array
  ✓ setSelectedConfig sets ID
  ✓ setResults stores results array
```

#### 5. GateConfigForm Component (`GateConfigForm.test.tsx`)

```
describe("GateConfigForm")
  ✓ renders all form fields with correct defaults
  ✓ min score slider shows value and updates on drag
  ✓ blur toggle defaults to checked
  ✓ resolution toggle defaults to checked
  ✓ min dimensions inputs accept numbers only
  ✓ content type multi-select shows all 7 types
  ✓ brand profile dropdown populated from API
  ✓ webhook secret field shows with copy-to-clipboard button
  ✓ "Gerar Segredo" button creates random 64-char hex string
  ✓ submit calls createGateConfig with correct payload
  ✓ in edit mode, pre-populates all fields from existing config
```

#### 6. GateTestPanel Component (`GateTestPanel.test.tsx`)

```
describe("GateTestPanel")
  ✓ renders upload zone for test image
  ✓ "Testar" button calls validateImage API
  ✓ shows spinner during validation
  ✓ shows green "APROVADO" badge for pass verdict
  ✓ shows red "REPROVADO" badge for fail verdict
  ✓ shows yellow "ALERTA" badge for warn verdict
  ✓ shows quality score with color coding
  ✓ lists individual check results with pass/fail icons
  ✓ shows failure reasons in Portuguese
  ✓ shows warning reasons in Portuguese
```

#### 7. GateResultsDashboard Component (`GateResultsDashboard.test.tsx`)

```
describe("GateResultsDashboard")
  ✓ shows pass/fail/warn count cards
  ✓ shows pass rate percentage
  ✓ renders recent results table with columns: date, source, score, verdict
  ✓ verdict column shows colored badge
  ✓ filters table by verdict when filter button clicked
  ✓ shows empty state when no results
```

#### 8. GateApiDocs Component (`GateApiDocs.test.tsx`)

```
describe("GateApiDocs")
  ✓ renders endpoint URL with selected gate's ID
  ✓ shows curl example for file upload validation
  ✓ shows curl example for URL validation
  ✓ shows curl example for webhook with signature
  ✓ shows request schema
  ✓ shows response schema
  ✓ "Copiar" button copies curl command to clipboard
```

### Test Execution Order (TDD Flow)

```
1. quality-gate.test.ts (evaluateGate)        → implement evaluation logic (pure function)
2. webhook-auth.test.ts                        → implement HMAC verification
3. quality-gates.test.ts (CRUD)                → implement config routes + schema
4. quality-gates.test.ts (validation)          → implement validation endpoints
5. quality-gates.test.ts (webhook)             → implement webhook endpoint
6. gate-store.test.ts                          → implement Zustand store
7. api-gates.test.ts                           → implement API client
8. GateConfigForm.test.tsx                     → implement component
9. GateTestPanel.test.tsx                      → implement component
10. GateResultsDashboard.test.tsx              → implement component
11. GateApiDocs.test.tsx                       → implement component
```

---

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Autor-IA integration requires their team's cooperation | Design API first, share OpenAPI spec. Woli Pixel side is self-contained. Webhook provides async alternative |
| Validation latency (AI analysis takes 3-5s) | For sync endpoint: acceptable for single images. For batch: use webhook with callback. Frontend shows clear loading state |
| Webhook callback security | Callback URL must be HTTPS. Include gate_result_id in callback payload for verification |
| Config changes affecting in-flight validations | Gate config is snapshot at validation time (stored in metadata_json). Config changes don't retroactively affect past results |
| Feature depends on brand checker (Feature 2) | brand_profile_id is optional/nullable. Gate works without it. Brand check adds a warning, not a failure |
