# Test Plan 07 — Generation Cost Analysis

> Covers: OpenAI size resolution, pricing calculation, cost matrix API, quality selector UI, cost estimation panel.

## Feature Surface

### Backend
- **Service:** `apps/api/src/services/generation-cost.ts`
  - `resolveOpenAISize()` — maps preset dimensions to closest OpenAI output size
  - `getCostForSize()` — price for one size + quality
  - `getCostsForSize()` — all 3 quality prices for one size
  - `buildPresetCost()` — full cost info for one preset
  - `buildCostSummary()` — full matrix for all presets
  - `QUALITY_LABELS` — PT-BR tier labels
- **Routes:** `apps/api/src/routes/generation-cost.ts`
  - `GET /` — full cost matrix (all 19 presets x 3 qualities)
  - `GET /:typeKey` — single preset cost

### Frontend
- **Components:** `QualitySelector.tsx`, `CostEstimationPanel.tsx`
- **API Client:** `fetchGenerationCosts()`, `fetchPresetCost()`
- **Integration:** QualitySelector embedded in `TypeConfirmation.tsx`

---

## Backend Tests

### `apps/api/src/services/generation-cost.test.ts`

#### `resolveOpenAISize`

| # | Test | Input (w, h) | Expected |
|---|------|-------------|----------|
| 1 | Null dimensions -> square | (null, null) | "1024x1024" |
| 2 | Null width -> square | (null, 256) | "1024x1024" |
| 3 | Null height -> square | (256, null) | "1024x1024" |
| 4 | Small square -> square | (128, 128) | "1024x1024" |
| 5 | Medium square -> square | (256, 256) | "1024x1024" |
| 6 | At boundary (1024x1024) -> square | (1024, 1024) | "1024x1024" |
| 7 | Landscape > 1024 -> landscape | (1920, 1080) | "1536x1024" |
| 8 | Landscape (1600x900) -> landscape | (1600, 900) | "1536x1024" |
| 9 | Landscape (1200x300) -> landscape | (1200, 300) | "1536x1024" |
| 10 | Portrait (375x820) -> portrait | (375, 820) | "1024x1536" |
| 11 | Tiny square (27x27) -> square | (27, 27) | "1024x1024" |
| 12 | Tiny square (72x72) -> square | (72, 72) | "1024x1024" |
| 13 | Wide landscape (650x200) -> landscape | (650, 200) | "1024x1024" |
| 14 | Wide landscape (600x100) -> square | (600, 100) | "1024x1024" |

Note: Tests 13-14 verify that 650x200 and 600x100 fit within 1024x1024 (both dims <= 1024).

#### `getCostForSize` / `getCostsForSize`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 15 | Square low cost | "1024x1024", "low" | 0.005 |
| 16 | Square medium cost | "1024x1024", "medium" | 0.011 |
| 17 | Square high cost | "1024x1024", "high" | 0.036 |
| 18 | Landscape low cost | "1536x1024", "low" | 0.006 |
| 19 | Landscape medium cost | "1536x1024", "medium" | 0.015 |
| 20 | Landscape high cost | "1536x1024", "high" | 0.052 |
| 21 | Portrait prices match landscape | "1024x1536" | Same prices as "1536x1024" |
| 22 | `getCostsForSize` returns all 3 tiers | "1024x1024" | `{ low, medium, high }` |

#### `buildPresetCost`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 23 | Favicon preset | (128, 128) | openaiSize="1024x1024", costs match square pricing |
| 24 | Conteudo preset | (1920, 1080) | openaiSize="1536x1024", notes mentions upscale |
| 25 | Logo dispersao preset | (27, 27) | openaiSize="1024x1024", notes mentions downscale |
| 26 | Variable width preset | (null, null) | openaiSize="1024x1024", notes is null |
| 27 | typeKey and displayName preserved | Any | Exact values passed through |

#### `buildCostSummary`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 28 | 19 presets produces correct totals | All seed presets | low=$0.102, medium=$0.237, high=$0.796 |
| 29 | squareCount is 12 | All seed presets | 12 |
| 30 | nonSquareCount is 7 | All seed presets | 7 |
| 31 | presets array has same length as input | 19 presets | 19 items |
| 32 | Totals have no floating-point drift | Any | Rounded to 3 decimal places |
| 33 | Empty input produces zero totals | [] | totals all 0, counts all 0 |

### `apps/api/src/routes/generation-cost.test.ts`

| # | Test | Method | Expected |
|---|------|--------|----------|
| 1 | Full matrix returns 19 presets | GET / | 200, presets.length === 19 |
| 2 | Response includes model name | GET / | model === "gpt-image-1-mini" |
| 3 | Response includes qualityLabels | GET / | low/medium/high labels in PT-BR |
| 4 | Response includes totals | GET / | totals.low, totals.medium, totals.high |
| 5 | Response includes notes | GET / | pricing, batch, upscaling, downscaling notes |
| 6 | Single preset returns correct type | GET /favicon | typeKey === "favicon" |
| 7 | Single preset includes costs | GET /favicon | costs.low === 0.005, costs.medium === 0.011, costs.high === 0.036 |
| 8 | Single preset 404 for unknown | GET /nonexistent | 404 |

---

## Frontend Tests

### `apps/web/src/components/QualitySelector.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Renders 3 quality tier buttons | "Rascunho", "Padrao", "Alta Qualidade" visible |
| 2 | Selected tier is visually highlighted | Active button has primary styling |
| 3 | Clicking a tier calls onSelect | Callback fired with tier value |
| 4 | Cost displayed when typeKey provided | Dollar amounts shown on buttons |
| 5 | No cost shown when typeKey is null | No dollar amounts |
| 6 | Note shown for presets needing upscale | Info text about Sharp upscale |
| 7 | Medium is default selected state | "Padrao" highlighted initially |
| 8 | Descriptions shown for each tier | "Preview rapido", "Uso geral", "Producao" |

### `apps/web/src/components/CostEstimationPanel.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Initially collapsed | Table not visible, only header |
| 2 | Click expands panel | Table becomes visible |
| 3 | Shows 3 total summary cards | Low, medium, high totals displayed |
| 4 | Table has 19 rows | One row per preset |
| 5 | Table columns: Preset, Alvo, OpenAI, Rascunho, Padrao, Alta | Headers present |
| 6 | Footer row shows totals | Total row with summed costs |
| 7 | Notes section renders | Pricing, batch, upscaling, downscaling notes |
| 8 | Loading state shown while fetching | "Carregando custos..." text |
| 9 | Data not fetched until panel opened | Query enabled only when isOpen |
| 10 | Square/non-square counts shown | "12 presets quadrados + 7 landscape/portrait" |

### Integration: `TypeConfirmation.tsx` with QualitySelector

| # | Test | What it verifies |
|---|------|------------------|
| 11 | QualitySelector hidden until type selected | Not rendered without selectedTypeId |
| 12 | QualitySelector appears after selecting type | Rendered between grid and button |
| 13 | Quality state defaults to "medium" | Initial render shows Padrao selected |
