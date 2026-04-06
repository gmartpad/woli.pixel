# Custom Resolution & Custom Presets — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to generate images at arbitrary custom resolutions and to create/manage reusable custom resolution presets, extending the existing 19 system presets.

**Architecture:** Add a `custom_presets` database table for user-created presets (separate from the system `image_types` table so system presets remain immutable). Extend the generation pipeline to accept either a system preset ID OR custom resolution dimensions. On the frontend, add a "Resolução Personalizada" tab to the type selector that offers both free-form W×H input and a list of saved custom presets. The generation backend resolves the optimal AI provider size and uses Sharp for final resize — same pipeline, just with user-supplied dimensions instead of system-preset dimensions.

**Tech Stack:** Drizzle ORM (PostgreSQL), Hono routes, Sharp, Zustand, React + TailwindCSS 4, Vitest, bun:test

---

## Key Design Decisions

### Provider Resolution Constraints

Neither Recraft V3 nor FLUX.2 Pro support truly arbitrary output sizes:

| Provider | Constraints | Strategy for Custom Sizes |
|----------|------------|--------------------------|
| **Recraft V3** | Fixed 1024×1024 minimum | Always generate 1024×1024, Sharp resizes to custom target |
| **FLUX.2 Pro** | Width/height must be multiples of 16, flexible sizing | Round up to nearest 16px, Sharp crops/resizes to exact target |

**Model selection for custom resolutions:** Use the same heuristic as system presets — default to FLUX.2 Pro for photorealistic/background content (large sizes, landscape/portrait) and Recraft V3 for icon/logo-style content (small sizes, square). The user can also choose "estilo" (style) which maps to the model.

### Custom Presets vs System Presets

| Aspect | System Presets (`image_types`) | Custom Presets (`custom_presets`) |
|--------|-------------------------------|----------------------------------|
| Source | Seed data, 19 fixed presets | User-created, unlimited |
| Mutability | Immutable (admin only) | Full CRUD by the user who created it |
| Model routing | Hardcoded `FLUX_PRESETS` set | User selects style (mapped to model) |
| Prompt context | `PRESET_CONTEXT` map | User-defined (optional) |
| Transparency | Per-preset flag | User-defined |
| Format/compression | Per-preset spec | User-defined (defaults: PNG, 500KB max) |

### Dimension Validation Rules

```
MIN_DIMENSION = 16        # Below 16px is impractical for AI generation
MAX_DIMENSION = 4096      # Beyond this, generation quality degrades / cost explodes
FLUX_ALIGNMENT = 16       # FLUX requires multiples of 16
MAX_MEGAPIXELS = 4.2      # ~4.2MP max (e.g., 2048×2048) — keeps FLUX cost reasonable
```

### Cost Calculation for Custom Resolutions

Reuse the existing cost model:
- **Recraft**: $0.04 base (always 1024×1024 generation) + $0.01 if transparency
- **FLUX**: $0.03 + $0.015 per extra megapixel beyond 1MP (based on generation size, not target size)

---

## Database Design

### New Table: `custom_presets`

```sql
CREATE TABLE custom_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  width INTEGER NOT NULL,           -- Target width in px
  height INTEGER NOT NULL,          -- Target height in px
  style VARCHAR(20) NOT NULL DEFAULT 'auto',  -- 'auto' | 'illustration' | 'photorealistic' | 'logo'
  output_format VARCHAR(10) NOT NULL DEFAULT 'png',  -- 'png' | 'jpeg' | 'webp'
  max_file_size_kb INTEGER NOT NULL DEFAULT 500,
  requires_transparency BOOLEAN NOT NULL DEFAULT false,
  prompt_context TEXT,              -- Optional context prepended to user prompt
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)            -- No duplicate names per user
);

CREATE INDEX idx_custom_presets_user ON custom_presets(user_id);
```

---

## Task 1: Database — `custom_presets` Table + Migration

**Files:**
- Modify: `apps/api/src/db/schema.ts` (add `customPresets` table after `imageTypes`)
- Run: `bun run db:generate` to create migration
- Run: `bun run db:push` to apply (dev only)

### Step 1: Write the failing test

Create test file `apps/api/src/db/custom-presets-schema.test.ts`:

```ts
import { describe, test, expect } from "bun:test";
import { customPresets } from "./schema";

describe("customPresets schema", () => {
  test("table has required columns", () => {
    const columns = Object.keys(customPresets);
    expect(columns).toContain("id");
    expect(columns).toContain("userId");
    expect(columns).toContain("name");
    expect(columns).toContain("width");
    expect(columns).toContain("height");
    expect(columns).toContain("style");
    expect(columns).toContain("outputFormat");
    expect(columns).toContain("maxFileSizeKb");
    expect(columns).toContain("requiresTransparency");
    expect(columns).toContain("promptContext");
    expect(columns).toContain("createdAt");
    expect(columns).toContain("updatedAt");
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/api && bun test src/db/custom-presets-schema.test.ts`
Expected: FAIL — `customPresets` is not exported from `./schema`

### Step 3: Write minimal implementation

Add to `apps/api/src/db/schema.ts` after the `imageTypes` table:

```ts
// ── Custom Presets (User-Created) ────────────
export const customPresets = pgTable("custom_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  style: varchar("style", { length: 20 }).notNull().default("auto"),
  outputFormat: varchar("output_format", { length: 10 }).notNull().default("png"),
  maxFileSizeKb: integer("max_file_size_kb").notNull().default(500),
  requiresTransparency: boolean("requires_transparency").notNull().default(false),
  promptContext: text("prompt_context"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_custom_presets_user").on(table.userId),
]);
```

### Step 4: Run test to verify it passes

Run: `cd apps/api && bun test src/db/custom-presets-schema.test.ts`
Expected: PASS

### Step 5: Generate and push migration

Run: `cd apps/api && bun run db:generate && bun run db:push`

### Step 6: Commit

```
feat(db): add custom_presets table for user-created resolution presets
```

---

## Task 2: Backend — Custom Presets CRUD API Routes

**Files:**
- Create: `apps/api/src/routes/custom-presets.ts`
- Modify: `apps/api/src/index.ts` (register route)
- Test: `apps/api/src/routes/custom-presets.test.ts`

### Step 1: Write the failing tests

Create `apps/api/src/routes/custom-presets.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterEach } from "bun:test";
import app from "../index";

// Use a mock user session or test auth bypass
describe("Custom Presets API", () => {
  describe("POST /api/v1/custom-presets", () => {
    test("creates a preset with valid dimensions", async () => {
      const res = await app.request("/api/v1/custom-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Banner HD",
          width: 1920,
          height: 1080,
          style: "photorealistic",
          output_format: "jpeg",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.name).toBe("Banner HD");
      expect(body.data.width).toBe(1920);
      expect(body.data.height).toBe(1080);
    });

    test("rejects width below 16", async () => {
      const res = await app.request("/api/v1/custom-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tiny", width: 8, height: 100 }),
      });
      expect(res.status).toBe(400);
    });

    test("rejects width above 4096", async () => {
      const res = await app.request("/api/v1/custom-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Huge", width: 5000, height: 1000 }),
      });
      expect(res.status).toBe(400);
    });

    test("rejects megapixels above 4.2MP", async () => {
      const res = await app.request("/api/v1/custom-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "TooManyPixels", width: 4096, height: 4096 }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/custom-presets", () => {
    test("returns user presets", async () => {
      const res = await app.request("/api/v1/custom-presets");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe("DELETE /api/v1/custom-presets/:id", () => {
    test("returns 404 for non-existent preset", async () => {
      const res = await app.request(
        "/api/v1/custom-presets/00000000-0000-0000-0000-000000000000",
        { method: "DELETE" },
      );
      expect(res.status).toBe(404);
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/api && bun test src/routes/custom-presets.test.ts`
Expected: FAIL — route not registered, 404

### Step 3: Write minimal implementation

Create `apps/api/src/routes/custom-presets.ts`:

```ts
import { Hono } from "hono";
import { db } from "../db";
import { customPresets } from "../db/schema";
import { eq, and } from "drizzle-orm";

const MIN_DIM = 16;
const MAX_DIM = 4096;
const MAX_MP = 4.2;

const customPresetsRouter = new Hono();

// POST / — Create a custom preset
customPresetsRouter.post("/", async (c) => {
  // TODO: Get userId from auth session
  const userId = c.get("userId") as string;

  let body: {
    name?: string;
    width?: number;
    height?: number;
    style?: string;
    output_format?: string;
    max_file_size_kb?: number;
    requires_transparency?: boolean;
    prompt_context?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Body JSON inválido" }, 400);
  }

  const { name, width, height, style = "auto", output_format = "png",
          max_file_size_kb = 500, requires_transparency = false, prompt_context } = body;

  // Validation
  if (!name || name.trim().length === 0) {
    return c.json({ error: "name é obrigatório" }, 400);
  }
  if (!width || !height) {
    return c.json({ error: "width e height são obrigatórios" }, 400);
  }
  if (width < MIN_DIM || height < MIN_DIM) {
    return c.json({ error: `Dimensões mínimas: ${MIN_DIM}×${MIN_DIM}px` }, 400);
  }
  if (width > MAX_DIM || height > MAX_DIM) {
    return c.json({ error: `Dimensões máximas: ${MAX_DIM}×${MAX_DIM}px` }, 400);
  }
  const megapixels = (width * height) / 1_000_000;
  if (megapixels > MAX_MP) {
    return c.json({ error: `Resolução máxima: ${MAX_MP}MP (${width}×${height} = ${megapixels.toFixed(1)}MP)` }, 400);
  }
  if (!["auto", "illustration", "photorealistic", "logo"].includes(style)) {
    return c.json({ error: "style deve ser: auto, illustration, photorealistic ou logo" }, 400);
  }
  if (!["png", "jpeg", "webp"].includes(output_format)) {
    return c.json({ error: "output_format deve ser: png, jpeg ou webp" }, 400);
  }

  const [preset] = await db.insert(customPresets).values({
    userId,
    name: name.trim(),
    width,
    height,
    style,
    outputFormat: output_format,
    maxFileSizeKb: max_file_size_kb,
    requiresTransparency: requires_transparency,
    promptContext: prompt_context?.trim() || null,
  }).returning();

  return c.json({ data: preset }, 201);
});

// GET / — List user's custom presets
customPresetsRouter.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const presets = await db
    .select()
    .from(customPresets)
    .where(eq(customPresets.userId, userId))
    .orderBy(customPresets.createdAt);

  return c.json({ data: presets });
});

// PUT /:id — Update a custom preset
customPresetsRouter.put("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(customPresets)
    .where(and(eq(customPresets.id, id), eq(customPresets.userId, userId)));

  if (!existing) {
    return c.json({ error: "Preset não encontrado" }, 404);
  }

  let body: Record<string, any>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Body JSON inválido" }, 400);
  }

  const width = body.width ?? existing.width;
  const height = body.height ?? existing.height;

  // Re-validate dimensions if changed
  if (width < MIN_DIM || height < MIN_DIM) {
    return c.json({ error: `Dimensões mínimas: ${MIN_DIM}×${MIN_DIM}px` }, 400);
  }
  if (width > MAX_DIM || height > MAX_DIM) {
    return c.json({ error: `Dimensões máximas: ${MAX_DIM}×${MAX_DIM}px` }, 400);
  }
  const megapixels = (width * height) / 1_000_000;
  if (megapixels > MAX_MP) {
    return c.json({ error: `Resolução máxima: ${MAX_MP}MP` }, 400);
  }

  const [updated] = await db
    .update(customPresets)
    .set({
      name: body.name?.trim() ?? existing.name,
      width,
      height,
      style: body.style ?? existing.style,
      outputFormat: body.output_format ?? existing.outputFormat,
      maxFileSizeKb: body.max_file_size_kb ?? existing.maxFileSizeKb,
      requiresTransparency: body.requires_transparency ?? existing.requiresTransparency,
      promptContext: body.prompt_context !== undefined ? body.prompt_context?.trim() || null : existing.promptContext,
      updatedAt: new Date(),
    })
    .where(and(eq(customPresets.id, id), eq(customPresets.userId, userId)))
    .returning();

  return c.json({ data: updated });
});

// DELETE /:id — Delete a custom preset
customPresetsRouter.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");

  const [deleted] = await db
    .delete(customPresets)
    .where(and(eq(customPresets.id, id), eq(customPresets.userId, userId)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Preset não encontrado" }, 404);
  }

  return c.json({ data: { deleted: true } });
});

export { customPresetsRouter };
```

### Step 4: Register route in `apps/api/src/index.ts`

Add alongside other route registrations:

```ts
import { customPresetsRouter } from "./routes/custom-presets";
// ...
app.route("/api/v1/custom-presets", customPresetsRouter);
```

### Step 5: Run test to verify it passes

Run: `cd apps/api && bun test src/routes/custom-presets.test.ts`
Expected: PASS

### Step 6: Commit

```
feat(api): add CRUD routes for custom resolution presets
```

---

## Task 3: Backend — Extend Generation Route to Accept Custom Dimensions

**Files:**
- Modify: `apps/api/src/routes/generate.ts` (accept `custom_width`, `custom_height`, `custom_preset_id` as alternatives to `image_type_id`)
- Modify: `apps/api/src/services/image-generation.ts` (add `resolveModelForCustom`, `estimateCostCustom`)
- Test: `apps/api/src/routes/generate-custom.test.ts`

### Step 1: Write the failing test

Create `apps/api/src/routes/generate-custom.test.ts`:

```ts
import { describe, test, expect } from "bun:test";
import {
  resolveModelForCustom,
  resolveGenerationSizeCustom,
  estimateCostCustom,
} from "../services/image-generation";

describe("Custom resolution generation helpers", () => {
  describe("resolveModelForCustom", () => {
    test("returns flux2_pro for 'photorealistic' style", () => {
      expect(resolveModelForCustom("photorealistic")).toBe("flux2_pro");
    });

    test("returns recraft_v3 for 'logo' style", () => {
      expect(resolveModelForCustom("logo")).toBe("recraft_v3");
    });

    test("returns recraft_v3 for 'illustration' style", () => {
      expect(resolveModelForCustom("illustration")).toBe("recraft_v3");
    });

    test("returns flux2_pro for 'auto' with landscape dimensions", () => {
      expect(resolveModelForCustom("auto", 1920, 1080)).toBe("flux2_pro");
    });

    test("returns recraft_v3 for 'auto' with small square", () => {
      expect(resolveModelForCustom("auto", 128, 128)).toBe("recraft_v3");
    });

    test("returns flux2_pro for 'auto' with large square", () => {
      expect(resolveModelForCustom("auto", 1024, 1024)).toBe("flux2_pro");
    });
  });

  describe("resolveGenerationSizeCustom", () => {
    test("returns 1024x1024 for recraft_v3", () => {
      const size = resolveGenerationSizeCustom(500, 300, "recraft_v3");
      expect(size).toEqual({ w: 1024, h: 1024 });
    });

    test("rounds up to 16px multiples for flux2_pro", () => {
      const size = resolveGenerationSizeCustom(1920, 1080, "flux2_pro");
      expect(size.w % 16).toBe(0);
      expect(size.h % 16).toBe(0);
      expect(size.w).toBeGreaterThanOrEqual(1920);
      expect(size.h).toBeGreaterThanOrEqual(1080);
    });

    test("does not exceed max generation size for flux2_pro", () => {
      const size = resolveGenerationSizeCustom(4096, 1024, "flux2_pro");
      // Should cap or align without exceeding safe limits
      expect(size.w).toBeLessThanOrEqual(4096);
    });
  });

  describe("estimateCostCustom", () => {
    test("returns recraft base cost for logo style", () => {
      const cost = estimateCostCustom(128, 128, "logo", false);
      expect(cost).toBe(0.04);
    });

    test("adds transparency cost for recraft", () => {
      const cost = estimateCostCustom(128, 128, "logo", true);
      expect(cost).toBe(0.05);
    });

    test("returns flux cost based on megapixels", () => {
      const cost = estimateCostCustom(1920, 1080, "photorealistic", false);
      // ~2MP → $0.03 + $0.015 = $0.045
      expect(cost).toBeGreaterThan(0.03);
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/api && bun test src/routes/generate-custom.test.ts`
Expected: FAIL — functions not exported

### Step 3: Write implementation

Add to `apps/api/src/services/image-generation.ts`:

```ts
// ── Custom Resolution Helpers ────────────────

export type CustomStyle = "auto" | "illustration" | "photorealistic" | "logo";

/**
 * Determines the optimal AI model for custom resolution based on style.
 * "auto" uses dimension heuristics: small squares → Recraft, large/landscape → FLUX.
 */
export function resolveModelForCustom(
  style: CustomStyle,
  width?: number,
  height?: number,
): GenerationModel {
  switch (style) {
    case "photorealistic":
      return "flux2_pro";
    case "logo":
    case "illustration":
      return "recraft_v3";
    case "auto":
    default: {
      // Heuristic: small icons/squares → Recraft; large/photo → FLUX
      const w = width ?? 512;
      const h = height ?? 512;
      const isSmallSquare = w <= 512 && h <= 512 && Math.abs(w - h) <= 64;
      return isSmallSquare ? "recraft_v3" : "flux2_pro";
    }
  }
}

/**
 * Resolves the generation size for custom dimensions.
 * Same logic as resolveGenerationSize but accepts raw numbers.
 */
export function resolveGenerationSizeCustom(
  targetWidth: number,
  targetHeight: number,
  model: GenerationModel,
): { w: number; h: number } {
  if (model === "recraft_v3") {
    return { w: 1024, h: 1024 };
  }

  // FLUX: round up to nearest 16px
  return {
    w: Math.ceil(targetWidth / 16) * 16,
    h: Math.ceil(targetHeight / 16) * 16,
  };
}

/**
 * Estimates cost for custom resolution generation.
 */
export function estimateCostCustom(
  width: number,
  height: number,
  style: CustomStyle,
  requiresTransparency: boolean,
): number {
  const model = resolveModelForCustom(style, width, height);

  if (model === "recraft_v3") {
    const base = 0.04;
    const removeBg = requiresTransparency ? 0.01 : 0;
    return base + removeBg;
  }

  // FLUX: $0.03 + $0.015 per extra MP
  const genSize = resolveGenerationSizeCustom(width, height, "flux2_pro");
  const megapixels = Math.ceil((genSize.w * genSize.h) / 1_000_000);
  return 0.03 + Math.max(0, megapixels - 1) * 0.015;
}
```

### Step 4: Modify `POST /api/v1/generate` route

Extend `apps/api/src/routes/generate.ts` to accept alternative input:

```ts
// In the POST handler, after parsing body:
const { image_type_id, prompt, quality_tier = "medium",
        custom_width, custom_height, custom_preset_id, custom_style = "auto" } = body;

// Validation: must provide EITHER image_type_id OR custom dimensions OR custom_preset_id
const hasSystemPreset = !!image_type_id;
const hasCustomDimensions = !!(custom_width && custom_height);
const hasCustomPreset = !!custom_preset_id;
const sourceCount = [hasSystemPreset, hasCustomDimensions, hasCustomPreset].filter(Boolean).length;

if (sourceCount !== 1) {
  return c.json({
    error: "Forneça exatamente uma opção: image_type_id, custom_preset_id, ou custom_width + custom_height",
  }, 400);
}
```

Then add handling for the two new paths (custom preset lookup, or raw custom dimensions), constructing the same `ImageTypeSpec` object for `postProcessGenerated`.

### Step 5: Run tests

Run: `cd apps/api && bun test src/routes/generate-custom.test.ts`
Expected: PASS

### Step 6: Commit

```
feat(api): extend generation route to accept custom resolutions and custom presets
```

---

## Task 4: Backend — Custom Resolution Cost Estimate Endpoint

**Files:**
- Modify: `apps/api/src/routes/generate.ts` (add `GET /cost/custom` endpoint)
- Test: `apps/api/src/routes/generate-custom-cost.test.ts`

### Step 1: Write the failing test

```ts
import { describe, test, expect } from "bun:test";
import app from "../index";

describe("GET /api/v1/generate/cost/custom", () => {
  test("returns cost for custom dimensions", async () => {
    const res = await app.request(
      "/api/v1/generate/cost/custom?width=1920&height=1080&style=photorealistic",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estimatedCostUsd).toBeGreaterThan(0);
    expect(body.model).toBe("flux2_pro");
    expect(body.generationSize).toBeDefined();
  });

  test("rejects invalid dimensions", async () => {
    const res = await app.request("/api/v1/generate/cost/custom?width=5&height=5");
    expect(res.status).toBe(400);
  });
});
```

### Step 2: Run test, verify it fails

### Step 3: Add endpoint to `apps/api/src/routes/generate.ts`

```ts
// GET /cost/custom — Estimate cost for custom resolution
// IMPORTANT: Register this BEFORE /cost/:typeKey to avoid route collision
generateRouter.get("/cost/custom", async (c) => {
  const width = parseInt(c.req.query("width") || "0");
  const height = parseInt(c.req.query("height") || "0");
  const style = (c.req.query("style") || "auto") as CustomStyle;
  const requiresTransparency = c.req.query("transparency") === "true";

  if (width < 16 || height < 16 || width > 4096 || height > 4096) {
    return c.json({ error: "Dimensões devem estar entre 16 e 4096px" }, 400);
  }
  const mp = (width * height) / 1_000_000;
  if (mp > 4.2) {
    return c.json({ error: `Resolução máxima: 4.2MP (${mp.toFixed(1)}MP excede)` }, 400);
  }

  const model = resolveModelForCustom(style, width, height);
  const genSize = resolveGenerationSizeCustom(width, height, model);
  const cost = estimateCostCustom(width, height, style, requiresTransparency);

  return c.json({
    width,
    height,
    style,
    model,
    generationSize: `${genSize.w}x${genSize.h}`,
    targetSize: `${width}x${height}`,
    estimatedCostUsd: cost,
    needsTransparency: requiresTransparency,
  });
});
```

### Step 4: Run tests, verify pass

### Step 5: Commit

```
feat(api): add custom resolution cost estimation endpoint
```

---

## Task 5: Frontend — API Client Functions for Custom Presets

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/lib/api-custom-presets.test.ts`

### Step 1: Write the failing test

```ts
import { describe, it, expect, vi } from "vitest";
import { createCustomPreset, fetchCustomPresets, deleteCustomPreset,
         getCustomResolutionCostEstimate } from "@/lib/api";

// These tests verify the functions exist and have correct signatures
describe("Custom Presets API client", () => {
  it("createCustomPreset sends POST with correct body", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "1", name: "Test" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await createCustomPreset({
      name: "Banner HD",
      width: 1920,
      height: 1080,
    });

    expect(spy).toHaveBeenCalledOnce();
    const [url, opts] = spy.mock.calls[0];
    expect(url).toContain("/custom-presets");
    expect(opts?.method).toBe("POST");
    expect(result.id).toBe("1");

    spy.mockRestore();
  });
});
```

### Step 2: Run test, verify fail

### Step 3: Add functions to `apps/web/src/lib/api.ts`

```ts
// ── Custom Presets Endpoints ────────────────

export type CustomPreset = {
  id: string;
  name: string;
  width: number;
  height: number;
  style: string;
  outputFormat: string;
  maxFileSizeKb: number;
  requiresTransparency: boolean;
  promptContext: string | null;
  createdAt: string;
};

export async function fetchCustomPresets(): Promise<CustomPreset[]> {
  const res = await apiFetch(`${API_URL}/custom-presets`);
  if (!res.ok) throw new Error("Erro ao carregar presets personalizados");
  const body = await res.json();
  return body.data;
}

export async function createCustomPreset(data: {
  name: string;
  width: number;
  height: number;
  style?: string;
  output_format?: string;
  max_file_size_kb?: number;
  requires_transparency?: boolean;
  prompt_context?: string;
}): Promise<CustomPreset> {
  const res = await apiFetch(`${API_URL}/custom-presets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao criar preset");
  }
  const body = await res.json();
  return body.data;
}

export async function updateCustomPreset(id: string, data: Record<string, any>): Promise<CustomPreset> {
  const res = await apiFetch(`${API_URL}/custom-presets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao atualizar preset");
  }
  const body = await res.json();
  return body.data;
}

export async function deleteCustomPreset(id: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/custom-presets/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erro ao excluir preset");
}

export async function getCustomResolutionCostEstimate(
  width: number,
  height: number,
  style = "auto",
  transparency = false,
) {
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    style,
    transparency: String(transparency),
  });
  const res = await apiFetch(`${API_URL}/generate/cost/custom?${params}`);
  if (!res.ok) throw new Error("Erro ao estimar custo personalizado");
  return res.json();
}

export async function generateImageCustom(
  width: number,
  height: number,
  prompt: string,
  qualityTier: "low" | "medium" | "high" = "medium",
  style = "auto",
) {
  const res = await apiFetch(`${API_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      custom_width: width,
      custom_height: height,
      prompt,
      quality_tier: qualityTier,
      custom_style: style,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    if (res.status === 422 && err.moderation) {
      throw new ModerationRejectedError(err);
    }
    throw new Error(err.error || "Erro na geração");
  }
  return res.json();
}

export async function generateImageFromPreset(
  customPresetId: string,
  prompt: string,
  qualityTier: "low" | "medium" | "high" = "medium",
) {
  const res = await apiFetch(`${API_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      custom_preset_id: customPresetId,
      prompt,
      quality_tier: qualityTier,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    if (res.status === 422 && err.moderation) {
      throw new ModerationRejectedError(err);
    }
    throw new Error(err.error || "Erro na geração");
  }
  return res.json();
}
```

### Step 4: Run tests, verify pass

### Step 5: Commit

```
feat(web): add API client functions for custom presets and custom resolution generation
```

---

## Task 6: Frontend — Extend Generation Store

**Files:**
- Modify: `apps/web/src/stores/generation-store.ts`
- Test: `apps/web/src/stores/generation-store-custom.test.ts`

### Step 1: Write the failing test

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGenerationStore } from "@/stores/generation-store";

describe("generation-store custom resolution", () => {
  beforeEach(() => {
    useGenerationStore.getState().reset();
  });

  it("has customWidth and customHeight fields", () => {
    const state = useGenerationStore.getState();
    expect(state.customWidth).toBeNull();
    expect(state.customHeight).toBeNull();
  });

  it("has customStyle field defaulting to 'auto'", () => {
    expect(useGenerationStore.getState().customStyle).toBe("auto");
  });

  it("has generationMode defaulting to 'preset'", () => {
    expect(useGenerationStore.getState().generationMode).toBe("preset");
  });

  it("setCustomDimensions updates width, height, and clears selectedTypeId", () => {
    useGenerationStore.getState().setSelectedTypeId("some-id");
    useGenerationStore.getState().setCustomDimensions(1920, 1080);

    const state = useGenerationStore.getState();
    expect(state.customWidth).toBe(1920);
    expect(state.customHeight).toBe(1080);
    expect(state.selectedTypeId).toBeNull();
    expect(state.generationMode).toBe("custom");
  });

  it("setSelectedTypeId clears custom dimensions", () => {
    useGenerationStore.getState().setCustomDimensions(1920, 1080);
    useGenerationStore.getState().setSelectedTypeId("some-id");

    const state = useGenerationStore.getState();
    expect(state.customWidth).toBeNull();
    expect(state.customHeight).toBeNull();
    expect(state.generationMode).toBe("preset");
  });

  it("setCustomPresetId sets mode and clears other selections", () => {
    useGenerationStore.getState().setSelectedTypeId("some-id");
    useGenerationStore.getState().setCustomPresetId("preset-id");

    const state = useGenerationStore.getState();
    expect(state.customPresetId).toBe("preset-id");
    expect(state.selectedTypeId).toBeNull();
    expect(state.generationMode).toBe("custom-preset");
  });

  it("reset clears all custom fields", () => {
    useGenerationStore.getState().setCustomDimensions(1920, 1080);
    useGenerationStore.getState().reset();

    const state = useGenerationStore.getState();
    expect(state.customWidth).toBeNull();
    expect(state.customHeight).toBeNull();
    expect(state.customStyle).toBe("auto");
    expect(state.generationMode).toBe("preset");
  });
});
```

### Step 2: Run test, verify fail

### Step 3: Extend the store

Add to `apps/web/src/stores/generation-store.ts`:

```ts
export type GenerationMode = "preset" | "custom" | "custom-preset";
export type CustomStyle = "auto" | "illustration" | "photorealistic" | "logo";

// Add to GenerationState type:
generationMode: GenerationMode;
customWidth: number | null;
customHeight: number | null;
customStyle: CustomStyle;
customPresetId: string | null;

// Add to actions:
setCustomDimensions: (w: number, h: number) => void;
setCustomStyle: (style: CustomStyle) => void;
setCustomPresetId: (id: string | null) => void;

// Implementations:
generationMode: "preset",
customWidth: null,
customHeight: null,
customStyle: "auto",
customPresetId: null,

setCustomDimensions: (w, h) => set({
  customWidth: w,
  customHeight: h,
  selectedTypeId: null,
  customPresetId: null,
  generationMode: "custom",
}),

setCustomStyle: (style) => set({ customStyle: style }),

setCustomPresetId: (id) => set({
  customPresetId: id,
  selectedTypeId: null,
  customWidth: null,
  customHeight: null,
  generationMode: "custom-preset",
}),

// Modify setSelectedTypeId to clear custom state:
setSelectedTypeId: (id) => set({
  selectedTypeId: id,
  customWidth: null,
  customHeight: null,
  customPresetId: null,
  generationMode: "preset",
}),

// Update reset to clear custom fields:
// Add customWidth: null, customHeight: null, customStyle: "auto",
// customPresetId: null, generationMode: "preset"
```

### Step 4: Run tests, verify pass

### Step 5: Commit

```
feat(web): extend generation store with custom resolution and custom preset state
```

---

## Task 7: Frontend — Custom Resolution Input Component

**Files:**
- Create: `apps/web/src/components/CustomResolutionInput.tsx`
- Test: `apps/web/src/components/CustomResolutionInput.test.tsx`

### Step 1: Write the failing test

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CustomResolutionInput } from "./CustomResolutionInput";

describe("CustomResolutionInput", () => {
  it("renders width and height inputs", () => {
    render(<CustomResolutionInput width={null} height={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Largura (px)")).toBeInTheDocument();
    expect(screen.getByLabelText("Altura (px)")).toBeInTheDocument();
  });

  it("calls onChange when both dimensions are valid", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CustomResolutionInput width={null} height={null} onChange={onChange} />);

    await user.type(screen.getByLabelText("Largura (px)"), "1920");
    await user.type(screen.getByLabelText("Altura (px)"), "1080");

    expect(onChange).toHaveBeenCalledWith(1920, 1080);
  });

  it("shows error for dimensions below minimum", async () => {
    const user = userEvent.setup();
    render(<CustomResolutionInput width={null} height={null} onChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Largura (px)"), "8");
    await user.tab(); // blur to trigger validation

    expect(screen.getByText(/mínimo/i)).toBeInTheDocument();
  });

  it("shows megapixel count", async () => {
    render(<CustomResolutionInput width={1920} height={1080} onChange={vi.fn()} />);
    expect(screen.getByText(/2\.1\s*MP/i)).toBeInTheDocument();
  });

  it("shows aspect ratio label", async () => {
    render(<CustomResolutionInput width={1920} height={1080} onChange={vi.fn()} />);
    expect(screen.getByText("16:9")).toBeInTheDocument();
  });

  it("has swap dimensions button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CustomResolutionInput width={1920} height={1080} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /trocar/i }));
    expect(onChange).toHaveBeenCalledWith(1080, 1920);
  });
});
```

### Step 2: Run test, verify fail

### Step 3: Write implementation

Create `apps/web/src/components/CustomResolutionInput.tsx`:

```tsx
import { useState } from "react";

type Props = {
  width: number | null;
  height: number | null;
  onChange: (w: number, h: number) => void;
};

const MIN_DIM = 16;
const MAX_DIM = 4096;
const MAX_MP = 4.2;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function getAspectRatio(w: number, h: number): string {
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

export function CustomResolutionInput({ width, height, onChange }: Props) {
  const [wInput, setWInput] = useState(width?.toString() ?? "");
  const [hInput, setHInput] = useState(height?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);

  const validate = (w: number, h: number): string | null => {
    if (w < MIN_DIM || h < MIN_DIM) return `Dimensão mínimo: ${MIN_DIM}px`;
    if (w > MAX_DIM || h > MAX_DIM) return `Dimensão máximo: ${MAX_DIM}px`;
    const mp = (w * h) / 1_000_000;
    if (mp > MAX_MP) return `Máximo ${MAX_MP}MP (atual: ${mp.toFixed(1)}MP)`;
    return null;
  };

  const tryEmit = (wStr: string, hStr: string) => {
    const w = parseInt(wStr);
    const h = parseInt(hStr);
    if (isNaN(w) || isNaN(h)) return;
    const err = validate(w, h);
    setError(err);
    if (!err) onChange(w, h);
  };

  const mp = width && height ? ((width * height) / 1_000_000).toFixed(1) : null;
  const ratio = width && height ? getAspectRatio(width, height) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="custom-w" className="block text-xs text-on-surface-variant mb-1">
            Largura (px)
          </label>
          <input
            id="custom-w"
            type="number"
            min={MIN_DIM}
            max={MAX_DIM}
            value={wInput}
            onChange={(e) => {
              setWInput(e.target.value);
              tryEmit(e.target.value, hInput);
            }}
            onBlur={() => tryEmit(wInput, hInput)}
            placeholder="1920"
            className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-3 py-2 text-on-surface font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setWInput(hInput);
            setHInput(wInput);
            tryEmit(hInput, wInput);
          }}
          aria-label="Trocar dimensões"
          className="mb-0.5 rounded-lg p-2 text-outline hover:bg-surface-container-high hover:text-on-surface-variant"
        >
          {/* Swap icon */}
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </button>

        <div className="flex-1">
          <label htmlFor="custom-h" className="block text-xs text-on-surface-variant mb-1">
            Altura (px)
          </label>
          <input
            id="custom-h"
            type="number"
            min={MIN_DIM}
            max={MAX_DIM}
            value={hInput}
            onChange={(e) => {
              setHInput(e.target.value);
              tryEmit(wInput, e.target.value);
            }}
            onBlur={() => tryEmit(wInput, hInput)}
            placeholder="1080"
            className="w-full rounded-lg bg-surface-container-low border border-outline-variant/20 px-3 py-2 text-on-surface font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Meta row */}
      {mp && ratio && (
        <div className="flex gap-2 text-xs">
          <span className="rounded-md bg-surface-container-high px-2 py-1 text-on-surface-variant">
            {ratio}
          </span>
          <span className="rounded-md bg-surface-container-high px-2 py-1 text-on-surface-variant font-mono">
            {mp} MP
          </span>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
```

### Step 4: Run test, verify pass

### Step 5: Commit

```
feat(web): add CustomResolutionInput component with validation
```

---

## Task 8: Frontend — Custom Presets Manager Component

**Files:**
- Create: `apps/web/src/components/CustomPresetManager.tsx`
- Test: `apps/web/src/components/CustomPresetManager.test.tsx`

### Step 1: Write the failing test

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import { CustomPresetManager } from "./CustomPresetManager";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("CustomPresetManager", () => {
  it("renders 'Salvar como Preset' button", () => {
    render(
      <CustomPresetManager width={1920} height={1080} onSelectPreset={vi.fn()} />,
      { wrapper },
    );
    expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
  });

  it("shows preset list when presets exist", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        data: [{ id: "1", name: "Banner HD", width: 1920, height: 1080, style: "auto" }],
      })),
    );

    render(
      <CustomPresetManager width={null} height={null} onSelectPreset={vi.fn()} />,
      { wrapper },
    );

    expect(await screen.findByText("Banner HD")).toBeInTheDocument();
  });
});
```

### Step 2-5: Red-green-refactor cycle

The component shows:
1. A list of user's saved custom presets (fetched via `fetchCustomPresets`)
2. Each preset is a clickable card showing name + dimensions + style badge
3. A "Salvar como Preset" button that opens a small form (name input) when the user has typed custom dimensions
4. Delete button on each preset (with confirmation)
5. Clicking a preset calls `onSelectPreset(preset)`

### Step 6: Commit

```
feat(web): add CustomPresetManager component for CRUD on saved presets
```

---

## Task 9: Frontend — Style Selector Component

**Files:**
- Create: `apps/web/src/components/StyleSelector.tsx`
- Test: `apps/web/src/components/StyleSelector.test.tsx`

### Step 1: Write the failing test

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { StyleSelector } from "./StyleSelector";

describe("StyleSelector", () => {
  it("renders four style options", () => {
    render(<StyleSelector selected="auto" onSelect={vi.fn()} />);
    expect(screen.getByText("Automático")).toBeInTheDocument();
    expect(screen.getByText("Ilustração")).toBeInTheDocument();
    expect(screen.getByText("Fotorrealista")).toBeInTheDocument();
    expect(screen.getByText("Logo")).toBeInTheDocument();
  });

  it("calls onSelect when a style is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<StyleSelector selected="auto" onSelect={onSelect} />);

    await user.click(screen.getByText("Fotorrealista"));
    expect(onSelect).toHaveBeenCalledWith("photorealistic");
  });

  it("highlights the selected style", () => {
    render(<StyleSelector selected="photorealistic" onSelect={vi.fn()} />);
    const btn = screen.getByText("Fotorrealista").closest("button");
    expect(btn?.className).toContain("border-primary");
  });
});
```

### Step 2-5: Red-green-refactor cycle

The component renders a horizontal button group with 4 style options:
- **Automático** (`auto`) — Model chosen by dimensions
- **Ilustração** (`illustration`) — Recraft V3 / digital illustration
- **Fotorrealista** (`photorealistic`) — FLUX.2 Pro / photorealistic
- **Logo** (`logo`) — Recraft V3 / logo raster

Each shows a small icon + label + subtitle with model name.

### Step 6: Commit

```
feat(web): add StyleSelector component for custom resolution style choice
```

---

## Task 10: Frontend — Integrate Custom Resolution Tab into GeneratePanel

**Files:**
- Modify: `apps/web/src/components/GeneratePanel.tsx`
- Test: `apps/web/src/components/GeneratePanel.test.tsx` (modify existing tests if they exist, or create integration tests)

### Step 1: Write the failing test

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeneratePanel } from "./GeneratePanel";
import { useGenerationStore } from "@/stores/generation-store";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("GeneratePanel custom resolution integration", () => {
  beforeEach(() => {
    useGenerationStore.getState().reset();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ grouped: {} })),
    );
  });

  it("renders 'Personalizado' tab in type selection", async () => {
    render(<GeneratePanel />, { wrapper });
    expect(screen.getByText("Personalizado")).toBeInTheDocument();
  });

  it("shows custom resolution inputs when Personalizado tab is active", async () => {
    const user = userEvent.setup();
    render(<GeneratePanel />, { wrapper });

    await user.click(screen.getByText("Personalizado"));

    expect(screen.getByLabelText("Largura (px)")).toBeInTheDocument();
    expect(screen.getByLabelText("Altura (px)")).toBeInTheDocument();
  });
});
```

### Step 2: Run test, verify fail

### Step 3: Modify GeneratePanel.tsx

Key changes to `GeneratePanel.tsx`:

1. **Add a "Personalizado" tab** to the category tabs (after the system categories)
2. **When "Personalizado" is active**, show:
   - `<CustomResolutionInput>` for free-form W×H
   - `<StyleSelector>` for choosing generation style
   - `<CustomPresetManager>` showing saved presets + "save current" button
3. **Update the cost estimate query** to use `getCustomResolutionCostEstimate` when in custom mode
4. **Update `handleGenerate`** to call `generateImageCustom` or `generateImageFromPreset` instead of `generateImage`
5. **Update `canGenerate`** to check `(selectedTypeId || (customWidth && customHeight) || customPresetId) && prompt >= 10`

The tab structure becomes:

```
[Admin/Branding] [Conteúdo] [Gamificação] [Usuário] [Personalizado]
```

When "Personalizado" is selected:
```
┌─────────────────────────────────────────────────────┐
│  Resolução Personalizada                            │
│                                                      │
│  ┌─ W ──┐  ↔  ┌─ H ──┐   [16:9] [2.1 MP]          │
│  │ 1920 │     │ 1080 │                              │
│  └──────┘     └──────┘                              │
│                                                      │
│  Estilo                                              │
│  [Automático] [Ilustração] [Fotorrealista] [Logo]   │
│                                                      │
│  ── Seus Presets ──────────────────────────          │
│  ┌──────────┐ ┌──────────┐                          │
│  │Banner HD │ │Thumbnail │  [+ Salvar como Preset]  │
│  │1920×1080 │ │800×600   │                          │
│  └──────────┘ └──────────┘                          │
└─────────────────────────────────────────────────────┘
```

### Step 4: Run all frontend tests

Run: `cd apps/web && bunx vitest run`
Expected: All pass

### Step 5: Commit

```
feat(web): integrate custom resolution tab into GeneratePanel
```

---

## Task 11: Backend — Update Generation Job Schema for Custom Resolutions

**Files:**
- Modify: `apps/api/src/db/schema.ts` (add `customPresetId` nullable FK to `generationJobs`)
- Run: migration

### Step 1: Write test verifying the column exists

### Step 2: Add column

Add to `generationJobs` table:

```ts
customPresetId: uuid("custom_preset_id").references(() => customPresets.id),
```

This allows tracking whether a generation used a system preset or a custom preset. For free-form custom dimensions (no saved preset), this stays null but `targetSizeW`/`targetSizeH` capture the requested size.

### Step 3: Generate + push migration

### Step 4: Commit

```
feat(db): add custom_preset_id FK to generation_jobs for tracking custom preset usage
```

---

## Task 12: Integration Testing — End-to-End Custom Resolution Flow

**Files:**
- Test: `apps/api/src/routes/generate-custom-e2e.test.ts`
- Test: `apps/web/src/components/GeneratePanel-custom.test.tsx`

### Tests to write:

**Backend E2E:**
1. POST `/generate` with `custom_width=1920, custom_height=1080, custom_style=photorealistic` → verify job created with correct `generationSizeW/H` (FLUX-aligned) and `targetSizeW/H` (exact)
2. POST `/generate` with `custom_preset_id` → verify preset lookup, job creation
3. POST `/generate` with both `image_type_id` and `custom_width` → 400 error

**Frontend Integration:**
1. Full flow: click Personalizado → enter dimensions → select style → type prompt → generate button enabled
2. Save preset flow: enter dimensions → click "Salvar" → enter name → verify preset appears in list
3. Select saved preset → verify dimensions auto-fill → generate button enabled

### Commit

```
test: add E2E tests for custom resolution generation flow
```

---

## Summary: File Change Map

### New Files (6)
| File | Purpose |
|------|---------|
| `apps/api/src/routes/custom-presets.ts` | CRUD API for user presets |
| `apps/api/src/db/custom-presets-schema.test.ts` | Schema test |
| `apps/api/src/routes/custom-presets.test.ts` | Route tests |
| `apps/web/src/components/CustomResolutionInput.tsx` | W×H input with validation |
| `apps/web/src/components/CustomPresetManager.tsx` | Saved presets CRUD UI |
| `apps/web/src/components/StyleSelector.tsx` | Style selection buttons |

### Modified Files (6)
| File | Changes |
|------|---------|
| `apps/api/src/db/schema.ts` | Add `customPresets` table + `customPresetId` FK on `generationJobs` |
| `apps/api/src/index.ts` | Register `/custom-presets` route |
| `apps/api/src/services/image-generation.ts` | Add `resolveModelForCustom`, `resolveGenerationSizeCustom`, `estimateCostCustom` |
| `apps/api/src/routes/generate.ts` | Accept custom dims / custom preset ID, add `GET /cost/custom` |
| `apps/web/src/lib/api.ts` | Add custom preset + custom generation API client functions |
| `apps/web/src/stores/generation-store.ts` | Add custom resolution state fields + actions |
| `apps/web/src/components/GeneratePanel.tsx` | Add "Personalizado" tab with custom resolution UI |

### Migration Files (auto-generated)
- `apps/api/src/db/migrations/XXXX_add_custom_presets.sql`
- `apps/api/src/db/migrations/XXXX_add_custom_preset_id_to_generation_jobs.sql`
