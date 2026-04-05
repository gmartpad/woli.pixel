# Test Plan 04 — Brand Consistency Checker (Feature 2)

> Covers: Brand profile CRUD, Delta-E color analysis, brand consistency checking.

## Feature Surface

### Backend
- **Routes:** `apps/api/src/routes/brands.ts`
  - `POST /` — create brand profile
  - `GET /` — list brands
  - `GET /:id` — get brand
  - `PUT /:id` — update brand
  - `DELETE /:id` — delete brand (nullifies upload references)
  - `POST /:id/set-default` — mark as default
  - `POST /:id/check` — check image against brand palette
- **Services:**
  - `color-analysis.ts` — `hexToLab()`, `deltaE2000()`, `findClosestBrandColor()`, `analyzeBrandConsistency()`
- **DB:** `brandProfiles` table + `imageUploads.brandProfileId`, `.brandScore`, `.brandIssues`

### Frontend
- **Components:** `BrandProfileManager.tsx`, `BrandConsistencyResults.tsx`, `BrandSelector.tsx`
- **Store:** `brand-store.ts`
- **API Client:** `createBrand()`, `getBrands()`, `updateBrand()`, `deleteBrand()`, `setDefaultBrand()`, `checkBrand()`

---

## Backend Tests

### `apps/api/src/services/color-analysis.test.ts` — Core Color Math

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | `hexToLab` converts pure white | "#ffffff" | L ≈ 100, a ≈ 0, b ≈ 0 |
| 2 | `hexToLab` converts pure black | "#000000" | L ≈ 0, a ≈ 0, b ≈ 0 |
| 3 | `hexToLab` converts pure red | "#ff0000" | L ≈ 53, a > 0 |
| 4 | `hexToLab` handles lowercase hex | "#aabbcc" | Valid Lab output |
| 5 | `hexToLab` handles uppercase hex | "#AABBCC" | Same result as lowercase |
| 6 | `deltaE2000` identical colors = 0 | Same Lab twice | 0 |
| 7 | `deltaE2000` similar colors < 5 | Two close blues | < 5 |
| 8 | `deltaE2000` different colors > 20 | Red vs Blue | > 20 |
| 9 | `deltaE2000` is symmetric | Swap inputs | Same result |
| 10 | `findClosestBrandColor` finds exact match | "#ff0000" in palette with "#ff0000" | distance ≈ 0 |
| 11 | `findClosestBrandColor` picks nearest | Color between two palette colors | Returns closer one |
| 12 | `analyzeBrandConsistency` perfect match = score 100 | All colors within tolerance | score === 100, no issues |
| 13 | `analyzeBrandConsistency` mismatch reduces score | 1 color outside tolerance | score < 100, issues non-empty |
| 14 | `analyzeBrandConsistency` forbidden color detected | Image has forbidden color | has_forbidden_colors === true, forbidden_matches non-empty |
| 15 | `analyzeBrandConsistency` score never below 0 | Many mismatches | score >= 0 |
| 16 | `analyzeBrandConsistency` with empty palette | No brand colors | Handles gracefully (no crash) |
| 17 | `analyzeBrandConsistency` tolerance affects matching | Same colors, tolerance 10 vs 50 | Different match results |

### `apps/api/src/routes/brands.test.ts` — Brand CRUD + Check

| # | Test | Method | Expected |
|---|------|--------|----------|
| 1 | Create brand with valid data | POST / | 201, all fields persisted |
| 2 | Create rejects missing name | POST / `{ primary_color }` only | 400 |
| 3 | Create rejects invalid hex color | POST / `{ primary_color: "not-hex" }` | 400 |
| 4 | Create accepts optional colors | POST / with secondary, accent, neutral | 201, all stored |
| 5 | Create stores forbidden colors array | POST / with forbidden_colors | 201, array stored |
| 6 | List brands returns all, ordered by name | GET / | 200, sorted array |
| 7 | Get brand returns full profile | GET /:id | 200, matches created |
| 8 | Get brand returns 404 for missing | GET /fake-id | 404 |
| 9 | Update brand modifies fields | PUT /:id | 200, updated fields |
| 10 | Delete brand removes record | DELETE /:id | 200, GET /:id returns 404 |
| 11 | Delete brand nullifies upload references | DELETE /:id | imageUploads.brandProfileId set to null |
| 12 | Set-default unsets other defaults | POST /:id/set-default | Only one isDefault=true |
| 13 | Check requires analyzed image | POST /:id/check `{ upload_id }` (unanalyzed) | 400, needs analysis first |
| 14 | Check returns brand consistency result | POST /:id/check `{ upload_id }` (analyzed) | 200, score, issues, matches |
| 15 | Check stores result on imageUpload | POST /:id/check | brandScore and brandIssues persisted |
| 16 | Check returns 404 for missing brand | POST /fake/check | 404 |
| 17 | Check returns 404 for missing upload | POST /:id/check `{ upload_id: "fake" }` | 404 |

---

## Frontend Tests

### `apps/web/src/components/brand/BrandProfileManager.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Renders brand list from API | Brands displayed |
| 2 | Create form validates required fields | Name and primary color required |
| 3 | Color picker inputs accept hex values | Valid color format |
| 4 | Delete button removes brand after confirmation | Brand removed from list |
| 5 | Edit mode populates form with existing values | Fields pre-filled |
| 6 | Default badge shown on default brand | Visual indicator |

### `apps/web/src/components/brand/BrandConsistencyResults.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Shows brand score with color indicator | Green >= 80, Yellow >= 60, Red < 60 |
| 2 | Lists issues in PT-BR | Issues array rendered |
| 3 | Shows color match details | Palette color, image color, distance |
| 4 | Flags forbidden colors | Forbidden matches highlighted |

### `apps/web/src/components/brand/BrandSelector.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Renders brand dropdown in sidebar | Selector visible |
| 2 | Shows default brand as selected | Pre-selected if isDefault |
| 3 | Selecting brand updates store | Brand ID stored |
