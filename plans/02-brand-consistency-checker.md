# Feature 2: Brand Consistency Checker

## Overview

Woli operates 70%+ of Brazil's territory with white-label LMS instances — each client has distinct brand colors, logos, and visual identity. Currently, there's no automated way to validate that uploaded images align with a client's brand guidelines. This feature lets administrators define a brand profile (colors, logo) and automatically checks every uploaded image for brand consistency using color distance algorithms + AI analysis.

---

## Implementation Plan

### Phase 1: Database Schema

**New table: `brand_profiles`**

```
brand_profiles
├── id (UUID, PK)
├── name (VARCHAR 100) — e.g. "Localiza", "Rede Tauá", "G10 Transportes"
├── is_default (BOOLEAN, default false) — one profile can be the active default
├── primary_color (VARCHAR 7) — hex, e.g. "#1A73E8"
├── secondary_color (VARCHAR 7, nullable)
├── accent_color (VARCHAR 7, nullable)
├── neutral_color (VARCHAR 7, nullable)
├── forbidden_colors (TEXT[], nullable) — hex array of colors to flag
├── logo_upload_id (UUID, nullable, FK → image_uploads.id) — reference logo for visual comparison
├── tolerance (INT, default 25) — max Delta-E distance before flagging (0-100 scale)
├── notes (TEXT, nullable) — free-form brand guidelines notes
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

**Modify table: `image_uploads`**

```
+ brand_profile_id (UUID, nullable, FK → brand_profiles.id) — which brand was checked against
+ brand_score (INT, nullable) — 0-100 brand alignment score
+ brand_issues (TEXT[], nullable) — array of brand consistency issues
```

**File:** `apps/api/src/db/schema.ts`

### Phase 2: Color Distance Service

**New file:** `apps/api/src/services/color-analysis.ts`

Core functions:
- `hexToLab(hex: string): [number, number, number]` — Convert hex → sRGB → CIELAB
- `deltaE2000(lab1, lab2): number` — CIE Delta-E 2000 (perceptually uniform distance)
- `findClosestBrandColor(imageColor: string, brandColors: string[]): { color: string; distance: number }`
- `analyzeBrandConsistency(dominantColors: string[], brandProfile: BrandProfile): BrandConsistencyResult`

**`BrandConsistencyResult` type:**
```ts
{
  score: number;                  // 0-100
  issues: string[];               // Portuguese descriptions
  color_matches: Array<{
    image_color: string;          // hex from AI analysis
    closest_brand_color: string;  // hex from brand profile
    distance: number;             // Delta-E value
    within_tolerance: boolean;
  }>;
  has_forbidden_colors: boolean;
  forbidden_matches: string[];    // which forbidden colors were found
}
```

**Scoring logic:**
- Start at 100
- For each dominant color: deduct points proportional to Delta-E distance beyond tolerance
- Deduct 20 points per forbidden color match
- Floor at 0

### Phase 3: AI Integration Enhancement

**File:** `apps/api/src/services/ai.ts` (modify existing)

Extend the Step 1 system prompt to optionally include brand context:

```
When brand context is provided, also evaluate:
- Whether the image's color palette aligns with the brand colors
- Whether the image style matches corporate/professional branding expectations
- Whether any text in the image uses brand-inappropriate fonts or colors
```

Add a new optional parameter to `analyzeImage()`:
```ts
export async function analyzeImage(
  base64DataUrl: string,
  imageTypesContext: ImageTypeForContext[],
  brandContext?: { name: string; colors: string[]; notes?: string }  // NEW
): Promise<AnalysisResult>
```

Extend the `analysisSchema` to include an optional `brand_alignment` field in the response:
```ts
brand_alignment: {
  style_appropriate: boolean,
  color_harmony: "high" | "medium" | "low",
  notes: string  // Portuguese
}
```

### Phase 4: Backend API

**New file:** `apps/api/src/routes/brands.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/brands` | Create brand profile |
| `GET` | `/api/v1/brands` | List all brand profiles |
| `GET` | `/api/v1/brands/:id` | Get brand profile details |
| `PUT` | `/api/v1/brands/:id` | Update brand profile |
| `DELETE` | `/api/v1/brands/:id` | Delete brand profile |
| `POST` | `/api/v1/brands/:id/set-default` | Set as default brand profile |
| `POST` | `/api/v1/brands/:id/check` | Check a single image against this brand (accepts `{ upload_id: string }`) |

**Modify existing route:** `POST /api/v1/images/:id/analyze`

After AI analysis completes, if a default brand profile exists (or `brand_profile_id` query param is provided):
1. Run `analyzeBrandConsistency()` with the AI's `dominant_colors`
2. Pass brand context to AI for `brand_alignment` assessment
3. Store `brand_score` and `brand_issues` on the `image_uploads` row
4. Include brand results in the API response

### Phase 5: Frontend — Brand Management

**New file:** `apps/web/src/stores/brand-store.ts`

```ts
type BrandProfile = {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string | null;
  accentColor: string | null;
  neutralColor: string | null;
  forbiddenColors: string[];
  tolerance: number;
  isDefault: boolean;
};

type BrandState = {
  profiles: BrandProfile[];
  activeProfileId: string | null;
  // Actions
  setProfiles: (profiles: BrandProfile[]) => void;
  setActiveProfile: (id: string | null) => void;
};
```

**New components:**

| Component | File | Description |
|-----------|------|-------------|
| `BrandProfileManager` | `components/BrandProfileManager.tsx` | Full CRUD interface for brand profiles. Color picker inputs for primary/secondary/accent/neutral. Forbidden colors list with add/remove. Tolerance slider (0-100). Logo upload zone |
| `BrandColorPicker` | `components/BrandColorPicker.tsx` | Individual color input: hex text field + visual swatch + optional color picker popup |
| `BrandConsistencyResults` | `components/BrandConsistencyResults.tsx` | Brand score gauge (0-100), color match visualization (side-by-side swatches showing image color vs nearest brand color with Delta-E distance), issue list, AI style notes |
| `BrandSelector` | `components/BrandSelector.tsx` | Dropdown in header/sidebar to select active brand profile for validation. Shows color dots preview |

**Modified components:**
- `AIAnalysisPanel.tsx`: Add brand consistency section below quality analysis (only shown when brand profile is active)
- `App.tsx`: Add "Marcas" nav item in sidebar, route to BrandProfileManager
- Sidebar nav: Add a `BrandSelector` dropdown below the nav items

### Phase 6: Frontend — API Client

**File:** `apps/web/src/lib/api.ts` (extend)

Add:
- `createBrand(data): Promise<BrandProfile>`
- `getBrands(): Promise<BrandProfile[]>`
- `updateBrand(id, data): Promise<BrandProfile>`
- `deleteBrand(id): Promise<void>`
- `setDefaultBrand(id): Promise<void>`
- `checkBrand(brandId, uploadId): Promise<BrandConsistencyResult>`

---

## TDD Test Plan

### Test Infrastructure

**Backend:**
```
apps/api/src/__tests__/
├── services/
│   └── color-analysis.test.ts
├── routes/
│   └── brands.test.ts
└── helpers/
    └── brand-fixtures.ts   — sample brand profiles
```

**Frontend:**
```
apps/web/src/__tests__/
├── stores/
│   └── brand-store.test.ts
├── components/
│   ├── BrandProfileManager.test.tsx
│   ├── BrandColorPicker.test.tsx
│   ├── BrandConsistencyResults.test.tsx
│   └── BrandSelector.test.tsx
└── lib/
    └── api-brands.test.ts
```

### Backend Tests

#### 1. Color Analysis Service (`color-analysis.test.ts`)

Write these FIRST — pure math, no dependencies:

```
describe("hexToLab")
  ✓ converts pure white #FFFFFF to LAB [100, 0, 0]
  ✓ converts pure black #000000 to LAB [0, 0, 0]
  ✓ converts known red #FF0000 to expected LAB values (within ±1)
  ✓ converts known blue #0000FF to expected LAB values (within ±1)
  ✓ handles lowercase hex (#ff5733)
  ✓ throws on invalid hex string

describe("deltaE2000")
  ✓ returns 0 for identical colors
  ✓ returns small value (< 2) for perceptually similar colors
  ✓ returns large value (> 50) for opposite colors (black vs white)
  ✓ is symmetric: deltaE(a,b) === deltaE(b,a)
  ✓ matches known reference values from CIE test dataset

describe("findClosestBrandColor")
  ✓ returns exact match with distance 0 when image color is in brand palette
  ✓ returns closest brand color when no exact match
  ✓ handles single-color brand palette
  ✓ handles empty brand palette gracefully

describe("analyzeBrandConsistency")
  ✓ returns score 100 when all dominant colors are within tolerance
  ✓ deducts points proportionally when colors exceed tolerance
  ✓ deducts 20 points per forbidden color found
  ✓ floors score at 0 (never negative)
  ✓ returns has_forbidden_colors: true when forbidden color detected
  ✓ returns color_matches array with correct distances
  ✓ generates Portuguese issue descriptions for each violation
  ✓ returns score 100 for empty brand profile (no colors defined)
  ✓ tolerance=0 requires exact matches; tolerance=100 accepts anything
```

#### 2. Brand Routes Integration (`brands.test.ts`)

```
describe("POST /api/v1/brands")
  ✓ creates brand profile with required fields, returns 201
  ✓ validates primary_color is valid hex format
  ✓ accepts optional secondary, accent, neutral colors
  ✓ accepts forbidden_colors array
  ✓ defaults tolerance to 25
  ✓ defaults is_default to false

describe("GET /api/v1/brands")
  ✓ returns all brand profiles
  ✓ returns empty array when none exist

describe("GET /api/v1/brands/:id")
  ✓ returns brand profile by ID
  ✓ returns 404 for non-existent ID

describe("PUT /api/v1/brands/:id")
  ✓ updates specified fields, preserves others
  ✓ validates color format on update
  ✓ returns 404 for non-existent ID

describe("DELETE /api/v1/brands/:id")
  ✓ deletes brand profile
  ✓ nullifies brand_profile_id on associated image_uploads
  ✓ returns 404 for non-existent ID

describe("POST /api/v1/brands/:id/set-default")
  ✓ sets is_default to true for target profile
  ✓ sets is_default to false for all other profiles (only one default)
  ✓ returns 404 for non-existent ID

describe("POST /api/v1/brands/:id/check")
  ✓ runs brand consistency check against specified upload
  ✓ returns brand_score and brand_issues
  ✓ returns color_matches array
  ✓ stores results on image_uploads row
  ✓ returns 404 for non-existent brand or upload

describe("POST /api/v1/images/:id/analyze (brand integration)")
  ✓ includes brand results when default brand profile exists
  ✓ includes brand results when brand_profile_id query param provided
  ✓ omits brand results when no brand profile active
  ✓ passes brand context to AI system prompt
```

### Frontend Tests

#### 3. Brand Store (`brand-store.test.ts`)

```
describe("useBrandStore")
  ✓ initializes with empty profiles and null activeProfileId
  ✓ setProfiles replaces profiles array
  ✓ setActiveProfile sets the active profile ID
  ✓ setActiveProfile with null clears active profile
```

#### 4. BrandColorPicker Component (`BrandColorPicker.test.tsx`)

```
describe("BrandColorPicker")
  ✓ renders hex input field and color swatch
  ✓ shows swatch with background-color matching input value
  ✓ calls onChange with valid hex on input change
  ✓ shows validation error for invalid hex (e.g., "#GGG")
  ✓ accepts lowercase and uppercase hex input
  ✓ renders label prop text
```

#### 5. BrandProfileManager Component (`BrandProfileManager.test.tsx`)

```
describe("BrandProfileManager")
  ✓ renders list of existing brand profiles
  ✓ renders "Criar Perfil" button
  ✓ opens creation form on button click
  ✓ creation form has fields: name, primary color, secondary, accent, neutral, tolerance slider
  ✓ submits form and calls createBrand API
  ✓ shows edit/delete actions per profile row
  ✓ edit mode populates form with existing values
  ✓ delete shows confirmation dialog
  ✓ tolerance slider shows current value (0-100)
  ✓ "Definir como Padrão" button calls setDefaultBrand
  ✓ default profile shows active indicator badge
```

#### 6. BrandConsistencyResults Component (`BrandConsistencyResults.test.tsx`)

```
describe("BrandConsistencyResults")
  ✓ renders brand score gauge with correct color (green >= 80, yellow >= 50, red < 50)
  ✓ renders color match swatches: image color on left, brand color on right
  ✓ shows Delta-E distance value per color pair
  ✓ shows checkmark for within-tolerance matches, X for violations
  ✓ renders forbidden color warning when has_forbidden_colors is true
  ✓ renders issue list in Portuguese
  ✓ renders nothing when no brand results available
```

#### 7. BrandSelector Component (`BrandSelector.test.tsx`)

```
describe("BrandSelector")
  ✓ renders dropdown with brand profile options
  ✓ shows color dot swatches next to each profile name
  ✓ shows "Nenhum" option to deactivate brand checking
  ✓ pre-selects default brand profile on mount
  ✓ calls setActiveProfile on selection change
```

### Test Execution Order (TDD Flow)

```
1. color-analysis.test.ts           → implement hexToLab, deltaE2000, analyzeBrandConsistency
2. brands.test.ts                   → implement brand routes + DB schema
3. brand-store.test.ts              → implement Zustand store
4. api-brands.test.ts               → implement API client functions
5. BrandColorPicker.test.tsx         → implement component
6. BrandProfileManager.test.tsx      → implement component
7. BrandConsistencyResults.test.tsx   → implement component
8. BrandSelector.test.tsx            → implement component
```

---

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Delta-E 2000 formula complexity | Use well-tested reference implementation; validate against CIE test dataset in unit tests |
| AI brand_alignment may be subjective | Use AI assessment as supplementary insight alongside deterministic color math. Score is math-driven, not AI-driven |
| Color extraction depends on AI dominant_colors accuracy | dominant_colors from Step 1 is already working; brand check runs after analysis, so data is available |
| Multiple brands active simultaneously | Only one `is_default` at a time; explicit `brand_profile_id` param for specific checks |
