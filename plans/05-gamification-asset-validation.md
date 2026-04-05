# Feature 5: Gamification Asset Validation

## Overview

Woli's gamification engine uses badges, medals, achievement icons, and virtual store product images — all with strict visual requirements (transparent backgrounds, consistent sizing, icon-style composition). Currently, these assets are uploaded without automated validation, leading to inconsistent visual quality across the gamification layer. This feature extends the existing `image_types` system with gamification-specific types, adds transparency and icon composition validation, and introduces gamification-specific preview contexts.

This is the most architecturally simple Tier 1 feature because it extends existing patterns rather than creating new systems.

---

## Implementation Plan

### Phase 1: Database — New Image Type Seeds

**File:** `apps/api/src/db/seed.ts` (extend existing seed array)

Add new entries to `IMAGE_TYPES_SEED`:

```ts
// Category D — Gamification (500 KB max, strict icon requirements)
{
  category: "gamification",
  typeKey: "badge_conquista",
  displayName: "Badge de Conquista",
  description: "Badge circular exibido no perfil do aluno ao completar um marco",
  width: 128,
  height: 128,
  aspectRatio: "1:1",
  maxFileSizeKb: 500,
  allowedFormats: ["png"],
  recommendedFormat: "png",
  requiresTransparency: true,
  minWidth: null,
  previewContext: "gamification_badge",
},
{
  category: "gamification",
  typeKey: "medalha_ranking",
  displayName: "Medalha de Ranking",
  description: "Medalha exibida no ranking de gamificação (ouro, prata, bronze)",
  width: 96,
  height: 96,
  aspectRatio: "1:1",
  maxFileSizeKb: 500,
  allowedFormats: ["png"],
  recommendedFormat: "png",
  requiresTransparency: true,
  minWidth: null,
  previewContext: "gamification_ranking",
},
{
  category: "gamification",
  typeKey: "icone_recompensa",
  displayName: "Ícone de Recompensa",
  description: "Ícone de item na loja virtual de recompensas",
  width: 200,
  height: 200,
  aspectRatio: "1:1",
  maxFileSizeKb: 500,
  allowedFormats: ["png", "jpeg"],
  recommendedFormat: "png",
  requiresTransparency: false,
  minWidth: null,
  previewContext: "gamification_store",
},
{
  category: "gamification",
  typeKey: "banner_campanha",
  displayName: "Banner de Campanha de Gamificação",
  description: "Banner exibido no topo da seção de gamificação para campanhas especiais",
  width: 1200,
  height: 300,
  aspectRatio: "4:1",
  maxFileSizeKb: 500,
  allowedFormats: ["png", "jpeg"],
  recommendedFormat: "jpeg",
  requiresTransparency: false,
  minWidth: null,
  previewContext: "gamification_campaign",
},
{
  category: "gamification",
  typeKey: "avatar_personagem",
  displayName: "Avatar de Personagem",
  description: "Avatar/mascote usado em interações gamificadas",
  width: 256,
  height: 256,
  aspectRatio: "1:1",
  maxFileSizeKb: 500,
  allowedFormats: ["png"],
  recommendedFormat: "png",
  requiresTransparency: true,
  minWidth: null,
  previewContext: "gamification_avatar",
},
```

**Schema update:** Add `"gamification"` to the category options in `imageTypes.category`. Currently the column is `varchar(20)` with no enum constraint, so no schema migration needed — just extend the seed data and update any frontend category filters.

### Phase 2: Transparency Validation Service

**New file:** `apps/api/src/services/transparency-validator.ts`

```ts
export type TransparencyAnalysis = {
  has_alpha_channel: boolean;
  transparency_percentage: number;  // 0-100: what % of pixels are transparent
  background_is_solid: boolean;     // true if non-transparent area forms a solid rectangle
  edge_transparency: boolean;       // true if edges have transparent pixels (typical for cut-out icons)
  issues: string[];                 // Portuguese descriptions
};

export async function analyzeTransparency(imagePath: string): Promise<TransparencyAnalysis>
```

**Implementation approach using Sharp:**
1. `sharp(imagePath).metadata()` → check `hasAlpha` and `channels === 4`
2. `sharp(imagePath).raw().toBuffer()` → read raw RGBA pixel data
3. Iterate pixels: count transparent (alpha < 128) vs opaque
4. Check edge rows/columns for transparency (typical for well-cut icons)
5. Detect if opaque area forms a rectangle (solid background = bad for icons that need transparency)

### Phase 3: Icon Composition Quality Checks

**Extend AI analysis:** `apps/api/src/services/ai.ts`

Add an optional gamification-specific prompt extension when the target type is `category === "gamification"`:

```
When analyzing gamification assets (badges, medals, icons):
- Verify the subject is centered and fills 70-90% of the canvas
- Check for clean edges (no jagged cutouts or white fringing)
- Verify visual clarity at small display sizes (96px, 128px)
- Check icon consistency: is this a flat/outline icon, 3D icon, photo, or illustration?
- Rate suitability as a gamification element (1-10)
```

Add to the analysis response schema:
```ts
gamification_suitability?: {
  icon_style: "flat" | "outline" | "3d" | "photo" | "illustration" | "mixed";
  subject_centered: boolean;
  subject_fill_percentage: number;  // 0-100
  clear_at_small_sizes: boolean;
  suitability_score: number;        // 1-10
  notes: string;                    // Portuguese
};
```

### Phase 4: Image Processing Enhancements

**File:** `apps/api/src/services/image-processor.ts` (extend)

Add transparency-aware processing logic:

```ts
// When processing gamification types that requiresTransparency:
// 1. If source is JPEG (no alpha), convert to PNG and add transparency
//    - Use Sharp's removeAlpha() → ensureAlpha() pipeline
//    - Attempt background removal for simple solid backgrounds
// 2. If source is PNG with solid background, warn user
// 3. Preserve transparency during resize (use fit: "contain" + transparent background instead of "cover")
```

Update `processImage()` to handle gamification types:
- When `requiresTransparency === true` and target format is PNG:
  - Use `fit: "contain"` with `background: { r: 0, g: 0, b: 0, alpha: 0 }` instead of `fit: "cover"`
  - This ensures the icon is centered with transparent padding rather than cropped

### Phase 5: Frontend — Preview Contexts

**File:** `apps/web/src/components/ContextPreview.tsx` (extend)

Add 5 new preview mockup contexts:

| Context Key | Visual Mockup Description |
|-------------|--------------------------|
| `gamification_badge` | Achievement profile section: shows badge in a row of 4 placeholder badges with user name and stats. Badge is 64px displayed in a circle with subtle shadow |
| `gamification_ranking` | Ranking leaderboard mockup: shows medal next to 3 user rows (1st, 2nd, 3rd). Medal is 48px next to name and points |
| `gamification_store` | Virtual store grid: 4 product cards, one showing the uploaded icon at 120px with mock price and "Resgatar" button |
| `gamification_campaign` | Campaign hero section: banner at full width above a grid of challenge cards with progress bars |
| `gamification_avatar` | Chat/interaction mockup: avatar at 80px in a speech bubble next to motivational text |

Each mockup uses the same Tailwind CSS + Material Design 3 tokens already established in the existing preview contexts.

### Phase 6: Frontend — Type Confirmation Enhancement

**File:** `apps/web/src/components/TypeConfirmation.tsx` (extend)

Add "Gamificação" as a fourth tab alongside "Admin/Marca", "Conteúdo", "Usuário". Show the 5 new gamification types in this tab with their specs.

Add a visual indicator when `requiresTransparency === true`:
- Small icon/badge on the type card: "Requer transparência"
- If the uploaded image does NOT have alpha channel and a transparency-requiring type is selected, show a warning: "Esta imagem não possui canal alfa. A transparência será simulada durante o processamento."

### Phase 7: Frontend — Transparency Results Display

**File:** `apps/web/src/components/AIAnalysisPanel.tsx` (extend)

When a gamification type is suggested or selected, show additional transparency info:
- Alpha channel: Yes/No badge
- Transparency coverage: percentage bar
- Edge transparency: Yes/No
- Gamification suitability score (from extended AI analysis)
- Icon style badge (flat, 3D, etc.)

---

## TDD Test Plan

### Test Infrastructure

**Backend:**
```
apps/api/src/__tests__/
├── services/
│   ├── transparency-validator.test.ts
│   └── image-processor-gamification.test.ts
├── routes/
│   └── image-types-gamification.test.ts
└── fixtures/
    ├── transparent-icon-128x128.png      — valid badge with transparency
    ├── solid-bg-icon-128x128.png         — icon with white background (no alpha)
    ├── jpeg-icon-128x128.jpg             — icon in wrong format
    ├── partial-transparency-128x128.png  — some transparent, some opaque edges
    └── photo-256x256.png                 — photo (unsuitable as icon)
```

**Frontend:**
```
apps/web/src/__tests__/
├── components/
│   ├── ContextPreview-gamification.test.tsx
│   └── TypeConfirmation-gamification.test.tsx
```

**Test fixture generation:** Create minimal test images programmatically with Sharp in a setup script:
```ts
// fixtures/generate.ts
import sharp from "sharp";

// 1x1 transparent PNG
await sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp({ create: { width: 80, height: 80, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 255 } } }).png().toBuffer(), gravity: "centre" }])
  .png().toFile("transparent-icon-128x128.png");

// Solid white background icon
await sharp({ create: { width: 128, height: 128, channels: 3, background: { r: 255, g: 255, b: 255 } } })
  .jpeg().toFile("solid-bg-icon-128x128.jpg");
// etc.
```

### Backend Tests

#### 1. Transparency Validator (`transparency-validator.test.ts`)

Write FIRST — depends only on Sharp (available):

```
describe("analyzeTransparency")
  describe("alpha channel detection")
    ✓ detects alpha channel in 4-channel PNG
    ✓ reports no alpha channel in 3-channel JPEG
    ✓ reports no alpha channel in 3-channel PNG (without alpha)

  describe("transparency percentage")
    ✓ returns 0% for fully opaque image
    ✓ returns 100% for fully transparent image
    ✓ returns correct percentage for partially transparent image (within ±2%)
    ✓ counts pixels with alpha < 128 as transparent

  describe("background analysis")
    ✓ background_is_solid=true for image with rectangular opaque area on transparent bg
    ✓ background_is_solid=false for cutout icon with irregular transparency edges
    ✓ background_is_solid=true for fully opaque image (no transparency at all)

  describe("edge transparency")
    ✓ edge_transparency=true when border pixels are mostly transparent (icon cutout)
    ✓ edge_transparency=false when border pixels are mostly opaque (photo/banner)
    ✓ checks all 4 edges (top, bottom, left, right rows)

  describe("issues generation")
    ✓ returns "Imagem não possui canal alfa" when no alpha channel
    ✓ returns "Fundo sólido detectado — o ícone deve ter fundo transparente" when solid background on transparency-required type
    ✓ returns "Bordas opacas — recorte pode ser necessário" when no edge transparency on badge/icon type
    ✓ returns empty issues array for properly transparent icon
```

#### 2. Image Processor — Gamification Extensions (`image-processor-gamification.test.ts`)

```
describe("processImage — gamification types")
  describe("transparency-requiring types")
    ✓ uses fit:'contain' with transparent background (not 'cover')
    ✓ processed image has alpha channel (4 channels)
    ✓ preserves existing transparency during resize
    ✓ output format is always PNG for transparency-requiring types
    ✓ centers icon subject within target dimensions

  describe("non-transparency types (banner, recompensa)")
    ✓ uses normal 'cover' fit like other types
    ✓ applies standard compression pipeline

  describe("format conversion for gamification")
    ✓ converts JPEG input to PNG when requiresTransparency=true
    ✓ marks 'format_converted' in adjustments
    ✓ keeps JPEG for gamification types that allow JPEG (banner, recompensa)
```

#### 3. Image Types — Gamification Seed (`image-types-gamification.test.ts`)

```
describe("Gamification image types seed")
  ✓ seed creates 5 new gamification types
  ✓ all gamification types have category='gamification'
  ✓ badge_conquista: 128x128, PNG only, requires transparency
  ✓ medalha_ranking: 96x96, PNG only, requires transparency
  ✓ icone_recompensa: 200x200, PNG+JPEG, no transparency required
  ✓ banner_campanha: 1200x300, PNG+JPEG, no transparency required
  ✓ avatar_personagem: 256x256, PNG only, requires transparency
  ✓ all gamification types have maxFileSizeKb=500
  ✓ seed is idempotent (running twice doesn't create duplicates)
  ✓ GET /api/v1/image-types returns gamification types alongside existing types
  ✓ GET /api/v1/image-types groups gamification types under 'gamification' category
```

#### 4. AI Analysis — Gamification Extension (`ai-gamification.test.ts`)

```
describe("analyzeImage — gamification context")
  ✓ includes gamification_suitability in response when gamification context flag is set
  ✓ gamification_suitability.icon_style is one of: flat, outline, 3d, photo, illustration, mixed
  ✓ gamification_suitability.subject_centered is boolean
  ✓ gamification_suitability.subject_fill_percentage is 0-100
  ✓ gamification_suitability.suitability_score is 1-10
  ✓ gamification_suitability.notes is in Portuguese
  ✓ omits gamification_suitability when gamification context flag is not set
```

### Frontend Tests

#### 5. TypeConfirmation — Gamification Tab (`TypeConfirmation-gamification.test.tsx`)

```
describe("TypeConfirmation — gamification")
  ✓ renders 4 tabs: Admin/Marca, Conteúdo, Usuário, Gamificação
  ✓ Gamificação tab shows 5 type cards
  ✓ each card shows type name, dimensions, format badge
  ✓ cards with requiresTransparency show "Requer transparência" indicator
  ✓ selecting a transparency-requiring type when image has no alpha shows warning
  ✓ warning text: "Esta imagem não possui canal alfa..."
  ✓ no warning shown when image has alpha channel
```

#### 6. ContextPreview — Gamification Contexts (`ContextPreview-gamification.test.tsx`)

```
describe("ContextPreview — gamification mockups")
  describe("gamification_badge")
    ✓ renders achievement section mockup
    ✓ shows uploaded image in badge slot
    ✓ shows 3 placeholder badges alongside
    ✓ badge displayed at 64px with circular clip

  describe("gamification_ranking")
    ✓ renders leaderboard mockup with 3 rows
    ✓ shows medal image at 48px next to user name
    ✓ shows points column

  describe("gamification_store")
    ✓ renders 4-item grid
    ✓ one card shows uploaded icon at 120px
    ✓ card has mock price and "Resgatar" button

  describe("gamification_campaign")
    ✓ renders banner at full container width
    ✓ shows challenge cards below banner

  describe("gamification_avatar")
    ✓ renders chat-style mockup
    ✓ shows avatar at 80px in speech bubble context
```

### Test Execution Order (TDD Flow)

```
1. transparency-validator.test.ts              → implement transparency analysis service
2. image-processor-gamification.test.ts         → extend processImage for gamification
3. image-types-gamification.test.ts             → add seed data + verify API response
4. ai-gamification.test.ts                      → extend AI prompt + schema (mock OpenAI in tests)
5. TypeConfirmation-gamification.test.tsx        → extend component with gamification tab
6. ContextPreview-gamification.test.tsx          → implement 5 new preview mockups
```

---

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Transparency analysis pixel iteration may be slow for large images | Downsample to 256x256 before analysis (transparency patterns are preserved at lower res). Sharp resize is fast |
| Background removal for JPEG→PNG conversion is imperfect | Don't auto-remove background. Instead, warn user and suggest re-uploading with transparency. Conversion only adds alpha channel, doesn't remove background |
| AI gamification_suitability adds latency | Optional: only request when gamification type is selected/suggested. Cache with rest of analysis |
| Existing seed uses `onConflictDoUpdate` on typeKey | New types have unique typeKeys, so no conflicts. Idempotent by design |
| No actual gamification UI in Woli Pixel to test against | Preview mockups are self-contained visual approximations. Verify dimensions and formats match Woli platform specs |
