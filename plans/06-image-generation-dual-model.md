# Plan 06 — Image Generation: Recraft V3 + FLUX.2 Pro Dual-Model Strategy

> Generate images for all 19 Woli Pixel presets using the optimal model per preset type.

## Strategy

| Model | Role | Presets | Strength |
|-------|------|:-------:|----------|
| **Recraft V3** | Primary — design assets | 12 | Logos, icons, badges, avatars, transparent PNGs, brand consistency |
| **FLUX.2 Pro** | Secondary — photorealism | 7 | Backgrounds, covers, content images, banners |

## Preset-to-Model Mapping

### Recraft V3 (12 presets)

| # | Preset | Size (WxH) | Recraft Size | Style | Needs Transparency |
|---|--------|-----------|--------------|-------|--------------------|
| 1 | logo_topo | variable | 1024x1024 | `logo_raster` | Yes → removeBackground |
| 2 | logo_relatorios | 650x200 | 1024x1024 | `logo_raster` | Yes → removeBackground |
| 3 | icone_pilula | 72x72 | 1024x1024 | `digital_illustration` | Yes → removeBackground |
| 4 | favicon | 128x128 | 1024x1024 | `digital_illustration` | Yes → removeBackground |
| 5 | logo_app | variable | 1024x1024 | `logo_raster` | Yes → removeBackground |
| 6 | logo_dispersao | 27x27 | 1024x1024 | `digital_illustration` | Yes → removeBackground |
| 7 | icone_curso | 256x256 | 1024x1024 | `digital_illustration` | No |
| 8 | foto_aluno | 256x256 | 1024x1024 | `realistic_image` | No |
| 9 | badge_conquista | 128x128 | 1024x1024 | `digital_illustration` | Yes → removeBackground |
| 10 | medalha_ranking | 96x96 | 1024x1024 | `digital_illustration` | Yes → removeBackground |
| 11 | icone_recompensa | 200x200 | 1024x1024 | `digital_illustration` | No |
| 12 | avatar_personagem | 256x256 | 1024x1024 | `digital_illustration` | Yes → removeBackground |

**Notes:**
- All Recraft presets generate at 1024x1024 (smallest supported size), then Sharp resizes to target.
- Transparency-required presets (8 of 12) need a second API call to Recraft's `/images/removeBackground` (+$0.01).
- Style is chosen based on preset category: `logo_raster` for logos, `digital_illustration` for icons/badges/gamification, `realistic_image` for photo-style (foto_aluno).

### FLUX.2 Pro (7 presets)

| # | Preset | Size (WxH) | FLUX Size (mult. of 16) | Notes |
|---|--------|-----------|------------------------|-------|
| 1 | fundo_login | 1600x900 | 1600x896 | Sharp trims 4px height |
| 2 | fundo_login_mobile | 375x820 | 384x832 | Sharp crops to exact |
| 3 | testeira_email | 600x100 | 608x112 | Sharp crops to exact |
| 4 | conteudo_imagem | 1920x1080 | 1920x1088 | Sharp trims 8px height |
| 5 | capa_workspace | 300x300 | 304x304 | Sharp crops to exact |
| 6 | fundo_workspace | 1920x1080 | 1920x1088 | Sharp trims 8px height |
| 7 | banner_campanha | 1200x300 | 1200x304 | Sharp crops to exact |

**Notes:**
- BFL API requires width/height as multiples of 16. We round up each dimension: `Math.ceil(dim / 16) * 16`.
- Sharp center-crops the extra pixels (≤15px per axis — imperceptible).
- No transparency needed for any FLUX preset.

---

## Cost Analysis

### Per-Preset Costs

| Model | Base Cost | + removeBackground | Presets | Total |
|-------|:---------:|:-------------------:|:-------:|:-----:|
| Recraft V3 (no transparency) | $0.04 | — | 4 | $0.16 |
| Recraft V3 (with transparency) | $0.04 | +$0.01 | 8 | $0.40 |
| FLUX.2 Pro (≤1MP) | $0.03 | — | 3 | $0.09 |
| FLUX.2 Pro (>1MP, ≤2MP) | $0.045 | — | 4 | $0.18 |
| **Total (19 presets)** | | | **19** | **$0.83** |

### Quality Tier Multipliers

The quality tier selector (Rascunho / Padrão / Alta Qualidade) maps to generation parameters, NOT to separate pricing:

| Tier | Recraft V3 | FLUX.2 Pro | Cost Impact |
|------|-----------|-----------|:-----------:|
| **Rascunho** | `artistic_level: 1`, substyle: generic | `output_format: jpeg` (lower quality) | Same |
| **Padrão** | `artistic_level: 3`, substyle: per-preset | `output_format: png` | Same |
| **Alta Qualidade** | `artistic_level: 5`, substyle: per-preset | `output_format: png`, `prompt_upsampling: true` | Same |

Unlike gpt-image-1-mini, neither Recraft nor FLUX charge differently based on quality — the cost is per-image/per-megapixel regardless. Quality is a parameter, not a pricing tier.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│ Frontend                                              │
│                                                       │
│  TypeConfirmation ──> QualitySelector                 │
│        │                     │                        │
│        ▼                     ▼                        │
│  GenerateButton ──────> POST /api/v1/generate         │
│        │                                              │
│        ▼                                              │
│  GenerationProgress ──> GET /api/v1/generate/:id      │
│        │                                              │
│        ▼                                              │
│  GenerationResult ──> download / use as preset        │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ Backend                                               │
│                                                       │
│  POST /api/v1/generate                                │
│    ├── resolveModel(typeKey) → "recraft" | "flux"     │
│    ├── buildPrompt(userPrompt, presetContext)          │
│    ├── resolveGenerationSize(preset, model)            │
│    │                                                  │
│    ├─── if recraft:                                   │
│    │      1. POST recraft /images/generations         │
│    │      2. if needsTransparency:                    │
│    │           POST recraft /images/removeBackground  │
│    │      3. Download image → Sharp resize to target  │
│    │                                                  │
│    ├─── if flux:                                      │
│    │      1. POST bfl /flux-2-pro (async)             │
│    │      2. Poll until Ready                         │
│    │      3. Download image → Sharp crop to target    │
│    │                                                  │
│    └── Save to DB + disk, return result               │
└──────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Environment & Dependencies

**Files:** `.env`, `apps/api/package.json`

- Add environment variables:
  ```
  RECRAFT_API_KEY=your_recraft_token
  FAL_API_KEY=your_fal_key
  ```
- Install fal.ai SDK:
  ```bash
  cd apps/api && bun add @fal-ai/client
  ```
- No new dependency for Recraft — use direct `fetch` (OpenAI SDK approach adds unnecessary weight since we only need one endpoint).

### Step 2: Database Schema — Generation Records

**File:** `apps/api/src/db/schema.ts`

Add a new `generationJobs` table:

```
generationJobs
├── id: uuid PK
├── imageTypeId: FK → imageTypes
├── model: varchar ("recraft_v3" | "flux2_pro")
├── prompt: text (user's input prompt)
├── enhancedPrompt: text (prompt after system augmentation)
├── qualityTier: varchar ("low" | "medium" | "high")
├── style: varchar (recraft style used, null for flux)
├── generationSizeW: integer (size sent to API)
├── generationSizeH: integer
├── targetSizeW: integer (final target after Sharp)
├── targetSizeH: integer
├── status: varchar ("pending" | "generating" | "processing" | "completed" | "error")
├── generatedImageUrl: text (temporary URL from provider)
├── processedPath: text (final file on disk)
├── processedFormat: varchar
├── processedSizeKb: integer
├── costUsd: numeric(6,4) (actual cost of this generation)
├── providerRequestId: varchar (for debugging)
├── errorMessage: text
├── createdAt: timestamp
└── updatedAt: timestamp
```

Run `drizzle-kit generate` after schema change.

### Step 3: Generation Service — Model Router

**File:** `apps/api/src/services/image-generation.ts`

This is the core service. Exports:

#### `resolveModel(typeKey: string): "recraft" | "flux"`
Lookup map based on preset-to-model mapping above. Returns which provider to use.

#### `resolveRecraftStyle(typeKey: string): { style: string; substyle?: string }`
Maps preset to the appropriate Recraft style:
- `logo_*` → `logo_raster`
- `icone_*`, `badge_*`, `medalha_*`, `avatar_*` → `digital_illustration`
- `foto_aluno` → `realistic_image`

#### `resolveGenerationSize(preset: { width, height }, model: "recraft" | "flux"): { w: number, h: number }`
- **Recraft:** Always 1024x1024 (smallest supported, then Sharp downscales)
- **FLUX:** Round each dimension up to nearest multiple of 16: `Math.ceil(dim / 16) * 16`. Null dimensions default to 1024.

#### `buildPrompt(userPrompt: string, preset: ImageType, qualityTier: QualityTier): string`
Enhances the user's prompt with preset-specific context:
- Prepend style guidance: "A professional [preset description] for a corporate education platform."
- Append dimension context: "The image should work well at [W]x[H] pixels."
- For icons/badges: "Clean, simple design with clear silhouette, suitable for small display sizes."
- For backgrounds: "Full-bleed background image, no text, no UI elements."
- For logos: "Professional logo mark, clean edges, [brand colors if available]."

#### `estimateCost(typeKey: string): number`
Returns the USD cost for generating one image for this preset:
- Recraft: $0.04 + ($0.01 if transparency needed) = $0.04 or $0.05
- FLUX: $0.03 per MP (first) + $0.015 per extra MP, based on `resolveGenerationSize()` pixel count.

### Step 4: Recraft Client

**File:** `apps/api/src/services/providers/recraft.ts`

```typescript
async function generateWithRecraft(params: {
  prompt: string;
  style: string;
  substyle?: string;
  size: string; // "1024x1024"
  qualityTier: QualityTier;
  needsTransparency: boolean;
}): Promise<{ imageBuffer: Buffer; cost: number }>
```

Implementation:
1. POST to `https://external.api.recraft.ai/v1/images/generations`
   - `response_format: "url"` (download separately — avoids base64 overhead)
   - Set `controls.artistic_level` per quality tier
   - Set `controls.no_text: true` for icons/badges
   - If logo with brand colors available, set `controls.colors`
2. Download the generated image URL to a Buffer
3. If `needsTransparency`:
   - POST the image to `/images/removeBackground`
   - Download the transparent PNG result
   - cost += $0.01
4. Return `{ imageBuffer, cost }`

### Step 5: FLUX.2 Pro Client

**File:** `apps/api/src/services/providers/flux.ts`

```typescript
async function generateWithFlux(params: {
  prompt: string;
  width: number;
  height: number;
  qualityTier: QualityTier;
}): Promise<{ imageBuffer: Buffer; cost: number }>
```

Implementation (using BFL direct API for more control):
1. POST to `https://api.bfl.ai/v1/flux-2-pro`
   - `width`, `height` (already multiples of 16)
   - `output_format: "png"`
   - `prompt_upsampling: true` for "high" quality tier
2. Receive `{ id, polling_url }`
3. Poll `polling_url` every 1s (max 60s timeout) until `status === "Ready"`
4. Download the signed image URL to a Buffer
5. Calculate cost: `$0.03 + Math.max(0, Math.ceil(w*h/1_000_000) - 1) * $0.015`
6. Return `{ imageBuffer, cost }`

### Step 6: Post-Processing with Sharp

**File:** Update `apps/api/src/services/image-processor.ts`

Add a new function (do NOT modify the existing `processImage` — it handles uploaded images):

```typescript
async function postProcessGenerated(
  imageBuffer: Buffer,
  targetSpec: ImageTypeSpec,
): Promise<ProcessResult>
```

This is simpler than `processImage` — no user crop, no format detection:
1. Resize/crop to exact target dimensions using `sharp.resize(w, h, { fit: "cover", position: "centre" })`
2. For transparency presets: use `fit: "contain"` with transparent background
3. Convert to `recommendedFormat` (PNG for transparency, JPEG/PNG for others)
4. Compress within `maxFileSizeKb`
5. Save to disk, return `ProcessResult`

### Step 7: Generation Route

**File:** `apps/api/src/routes/generate.ts`

#### `POST /api/v1/generate`

Request body:
```json
{
  "image_type_id": "uuid (required)",
  "prompt": "string (required, min 10 chars)",
  "quality_tier": "low | medium | high (default: medium)"
}
```

Flow:
1. Validate input (Zod schema)
2. Look up imageType from DB
3. Create `generationJobs` record with status "pending"
4. Resolve model, style, generation size, enhanced prompt
5. Update status to "generating"
6. Call provider (Recraft or FLUX)
7. Update status to "processing"
8. Post-process with Sharp
9. Save final image, update DB with processedPath, cost, status "completed"
10. Return result

Response (201):
```json
{
  "id": "generation-job-uuid",
  "status": "completed",
  "model": "recraft_v3",
  "prompt": "original prompt",
  "enhanced_prompt": "augmented prompt",
  "quality_tier": "medium",
  "cost_usd": 0.05,
  "image": {
    "width": 128,
    "height": 128,
    "format": "png",
    "size_kb": 45,
    "download_url": "/api/v1/generate/uuid/download"
  }
}
```

#### `GET /api/v1/generate/:id`
Returns the generation job record.

#### `GET /api/v1/generate/:id/download`
Returns the processed image binary. Same pattern as existing `/images/:id/download`.

#### `GET /api/v1/generate/history`
List generation jobs, paginated, most recent first.

### Step 8: Update Cost Service

**File:** `apps/api/src/services/generation-cost.ts`

Replace the gpt-image-1-mini pricing with the dual-model pricing:

- Update `PRICING` constants to reflect Recraft ($0.04 + $0.01 remove-bg) and FLUX ($0.03/MP) costs
- Update `resolveOpenAISize` → `resolveGenerationSize` + `resolveModel`
- Update `QUALITY_LABELS` — keep same PT-BR labels, update descriptions to mention that quality is a parameter not a cost multiplier
- Keep the same `buildCostSummary` / `buildPresetCost` interface so the frontend doesn't break

### Step 9: Register Route

**File:** `apps/api/src/index.ts`

```typescript
import { generateRouter } from "./routes/generate";
app.route("/api/v1/generate", generateRouter);
```

### Step 10: Frontend — API Client

**File:** `apps/web/src/lib/api.ts`

```typescript
export async function generateImage(
  imageTypeId: string,
  prompt: string,
  qualityTier: "low" | "medium" | "high"
) { ... }

export async function getGenerationJob(id: string) { ... }

export async function getGenerationHistory(page?: number) { ... }
```

### Step 11: Frontend — Generation UI Components

#### `apps/web/src/components/GeneratePanel.tsx`

New panel in the single-image mode (or as a separate nav item). Contains:

1. **Prompt input** — textarea with placeholder "Descreva a imagem que deseja gerar..."
2. **Type selector** — reuse the existing TypeConfirmation grid to pick target preset
3. **Quality selector** — reuse existing `QualitySelector` component
4. **Model indicator** — read-only badge showing "Recraft V3" or "FLUX.2 Pro" based on selected type (auto-resolved, user doesn't choose)
5. **Cost preview** — shows estimated cost for the selected preset: "$0.04" or "$0.045"
6. **Generate button** — triggers generation
7. **Progress state** — spinner with status text ("Gerando...", "Processando...", "Removendo fundo...")
8. **Result display** — shows the generated image with download button

#### `apps/web/src/stores/generation-store.ts`

New Zustand store:
```typescript
type GenerationStep = "idle" | "prompting" | "generating" | "processing" | "completed" | "error";

type GenerationState = {
  step: GenerationStep;
  selectedTypeId: string | null;
  prompt: string;
  qualityTier: QualityTier;
  currentJobId: string | null;
  result: GenerationResult | null;
  error: string | null;
  // actions
  setPrompt: (prompt: string) => void;
  setSelectedTypeId: (id: string | null) => void;
  setQualityTier: (tier: QualityTier) => void;
  setStep: (step: GenerationStep) => void;
  setResult: (result: GenerationResult) => void;
  setError: (error: string) => void;
  reset: () => void;
};
```

### Step 12: Frontend — Navigation Integration

**File:** `apps/web/src/App.tsx`

Add a new navigation mode `"generate"` to `AppMode`:

```typescript
type AppMode = "single" | "batch" | "brands" | "audit" | "gates" | "generate";
```

Add nav item with a sparkle/wand icon and label "Gerar Imagem".

Render `<GeneratePanel />` when `activeNav === "generate"`.

---

## Testing Strategy (TDD)

All new code follows TDD per CLAUDE.md.

### Backend Tests

| File | Tests | What |
|------|:-----:|------|
| `services/image-generation.test.ts` | ~15 | `resolveModel`, `resolveRecraftStyle`, `resolveGenerationSize`, `buildPrompt`, `estimateCost` — all pure functions |
| `services/providers/recraft.test.ts` | ~8 | Mock fetch, verify request bodies, handle errors, test removeBackground flow |
| `services/providers/flux.test.ts` | ~8 | Mock fetch, verify polling loop, handle timeouts, calculate cost |
| `routes/generate.test.ts` | ~12 | Validation (missing prompt, missing type), success flows, error handling, history pagination |
| `services/generation-cost.test.ts` | Update | Adjust existing 33 tests to reflect new pricing model |

### Frontend Tests

| File | Tests | What |
|------|:-----:|------|
| `stores/generation-store.test.ts` | ~8 | State transitions, prompt/type/quality setters, reset |
| `components/GeneratePanel.test.tsx` | ~10 | Prompt input, type selection, model indicator, cost preview, generate flow |

---

## Migration Plan

### Phase 1 — Backend (Steps 1-7, 9)
Independent of existing features. New table, new routes, new service. No changes to existing code.

### Phase 2 — Cost Update (Step 8)
Update the generation-cost service and its tests. The CostEstimationPanel will automatically reflect new pricing.

### Phase 3 — Frontend (Steps 10-12)
New store, new components, new nav item. No changes to existing components.

### Rollback
Each phase is independently deployable and revertable. Phase 1 adds a route nobody calls yet. Phase 2 changes pricing data. Phase 3 adds UI. Rolling back any phase doesn't break the others.

---

## Environment Variables Summary

```bash
# Existing
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=postgresql://...

# New
RECRAFT_API_KEY=recraft_token_from_app.recraft.ai/profile/api
FAL_API_KEY=fal_key_from_fal.ai/dashboard/keys
```

## API Specs Reference

### Recraft V3
- Base: `https://external.api.recraft.ai/v1`
- Auth: `Authorization: Bearer $RECRAFT_API_KEY`
- Generate: `POST /images/generations` → `{ prompt, model: "recraftv3", style, size: "1024x1024", response_format: "url", controls }`
- Remove BG: `POST /images/removeBackground` → multipart file upload → PNG with alpha
- Docs: `https://external.api.recraft.ai/doc/#/`

### FLUX.2 Pro (via BFL)
- Base: `https://api.bfl.ai/v1`
- Auth: `x-key: $FAL_API_KEY`
- Generate: `POST /flux-2-pro` → `{ prompt, width, height, output_format: "png" }`
- Response: `{ id, polling_url }` → poll until `status: "Ready"` → `{ result: { sample: "url" } }`
- Docs: `https://docs.bfl.ai`

### Cost Summary
| Operation | Cost |
|-----------|:----:|
| Recraft generate (raster) | $0.04 |
| Recraft removeBackground | $0.01 |
| FLUX.2 Pro (≤1MP) | $0.03 |
| FLUX.2 Pro (per extra MP) | +$0.015 |
| **All 19 presets (1 image each)** | **~$0.83** |
