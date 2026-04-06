# Unified History Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the session-only `ProcessingHistory` with a full-featured unified history page that lists, filters, and manages all generated and processed images from the database.

**Architecture:** A new `GET /api/v1/history` endpoint uses a SQL `UNION ALL` of `generation_jobs` and `image_uploads`, projected into a unified `HistoryItem` shape. The frontend uses `useInfiniteQuery` with URL-param-driven filters, rendering a date-grouped grid with a right side panel for details and a full-screen lightbox for inspection/comparison.

**Tech Stack:** Hono + Drizzle (backend), React 19 + TanStack Query 5 + Zustand 5 + TailwindCSS 4 (frontend)

**Design doc:** `docs/plans/2026-04-05-unified-history-page-design.md`

---

## Task 1: History Query Service

**Files:**
- Create: `apps/api/src/services/history-query.ts`
- Create: `apps/api/src/services/history-query.test.ts`

### Step 1: Write the failing test

```ts
// apps/api/src/services/history-query.test.ts
import { describe, test, expect } from "bun:test";
import { buildDateRange, type DatePreset } from "./history-query";

describe("buildDateRange", () => {
  test("returns null range for 'all' preset", () => {
    const range = buildDateRange("all");
    expect(range).toEqual({ from: null, to: null });
  });

  test("returns today's range for 'today' preset", () => {
    const range = buildDateRange("today");
    const now = new Date();
    expect(range.from?.toDateString()).toBe(now.toDateString());
    expect(range.to).not.toBeNull();
  });

  test("returns this week range starting Monday", () => {
    const range = buildDateRange("this_week");
    expect(range.from).not.toBeNull();
    expect(range.from!.getDay()).toBe(1); // Monday
  });

  test("returns this month range starting 1st", () => {
    const range = buildDateRange("this_month");
    expect(range.from).not.toBeNull();
    expect(range.from!.getDate()).toBe(1);
  });

  test("returns yesterday's range", () => {
    const range = buildDateRange("yesterday");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(range.from?.toDateString()).toBe(yesterday.toDateString());
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/api && bun test src/services/history-query.test.ts`
Expected: FAIL — module not found

### Step 3: Write minimal implementation

```ts
// apps/api/src/services/history-query.ts
export type DatePreset = "today" | "yesterday" | "this_week" | "this_month" | "all";

export type DateRange = {
  from: Date | null;
  to: Date | null;
};

export function buildDateRange(preset: DatePreset): DateRange {
  if (preset === "all") return { from: null, to: null };

  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  if (preset === "today") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  if (preset === "yesterday") {
    const from = new Date(now);
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(from);
    yesterdayEnd.setHours(23, 59, 59, 999);
    return { from, to: yesterdayEnd };
  }

  if (preset === "this_week") {
    const from = new Date(now);
    const day = from.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday = start
    from.setDate(from.getDate() - diff);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  // this_month
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { from, to };
}

export type HistoryFilters = {
  mode: "all" | "generation" | "upload";
  status: "all" | "completed" | "error";
  categories: string[];
  model: string | null;
  quality: string | null;
  search: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  page: number;
  perPage: number;
};

export type HistoryItem = {
  id: string;
  mode: "generation" | "upload";
  status: string;
  createdAt: string;
  thumbnailUrl: string;
  downloadUrl: string;
  category: string | null;
  imageTypeName: string | null;
  finalWidth: number | null;
  finalHeight: number | null;
  finalFormat: string | null;
  finalSizeKb: number | null;
  prompt: string | null;
  enhancedPrompt: string | null;
  model: string | null;
  qualityTier: string | null;
  costUsd: number | null;
  originalFilename: string | null;
  originalWidth: number | null;
  originalHeight: number | null;
  originalSizeKb: number | null;
  aiQualityScore: number | null;
};

export type HistoryResponse = {
  items: HistoryItem[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
};
```

### Step 4: Run test to verify it passes

Run: `cd apps/api && bun test src/services/history-query.test.ts`
Expected: PASS (5 tests)

---

## Task 2: History API Route

**Files:**
- Create: `apps/api/src/routes/history.ts`
- Create: `apps/api/src/routes/history.test.ts`
- Modify: `apps/api/src/index.ts` (add route registration)

### Step 1: Write the failing test

```ts
// apps/api/src/routes/history.test.ts
import { describe, test, expect, mock, beforeEach } from "bun:test";

// Mock DB with generation + upload rows
const mockGenerationRows = [
  {
    id: "gen-1",
    mode: "generation",
    status: "completed",
    created_at: new Date("2026-04-05T10:00:00Z"),
    category: "admin",
    image_type_name: "Favicon",
    final_width: 256,
    final_height: 256,
    final_format: "png",
    final_size_kb: 42,
    prompt: "A colorful owl mascot",
    enhanced_prompt: "A vibrant colorful owl mascot for education",
    model: "recraft_v3",
    quality_tier: "high",
    cost_usd: "0.0400",
    original_filename: null,
    original_width: null,
    original_height: null,
    original_size_kb: null,
    ai_quality_score: null,
  },
  {
    id: "upl-1",
    mode: "upload",
    status: "processed",
    created_at: new Date("2026-04-04T15:00:00Z"),
    category: "user",
    image_type_name: "Avatar",
    final_width: 128,
    final_height: 128,
    final_format: "jpeg",
    final_size_kb: 30,
    prompt: null,
    enhanced_prompt: null,
    model: null,
    quality_tier: null,
    cost_usd: null,
    original_filename: "photo.jpg",
    original_width: 1200,
    original_height: 800,
    original_size_kb: 480,
    ai_quality_score: 8,
  },
];

let executeResult = mockGenerationRows;
let countResult = [{ total: "2" }];

mock.module("../db", () => ({
  db: {
    execute: mock(async () => executeResult),
  },
}));

const { Hono } = await import("hono");
const { historyRouter } = await import("./history");

const testApp = new Hono();
testApp.route("/api/v1/history", historyRouter);

describe("GET /api/v1/history", () => {
  beforeEach(() => {
    executeResult = mockGenerationRows;
    countResult = [{ total: "2" }];
  });

  test("returns paginated history items", async () => {
    const res = await testApp.request("/api/v1/history?page=1&per_page=24");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toBeDefined();
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(24);
  });

  test("filters by mode=generation", async () => {
    executeResult = mockGenerationRows.filter((r) => r.mode === "generation");
    const res = await testApp.request("/api/v1/history?mode=generation");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.every((i: any) => i.mode === "generation")).toBe(true);
  });

  test("filters by category", async () => {
    executeResult = mockGenerationRows.filter((r) => r.category === "admin");
    const res = await testApp.request("/api/v1/history?category=admin");
    expect(res.status).toBe(200);
  });

  test("filters by date_preset=today", async () => {
    const res = await testApp.request("/api/v1/history?date_preset=today");
    expect(res.status).toBe(200);
  });

  test("filters by custom date range", async () => {
    const res = await testApp.request(
      "/api/v1/history?date_from=2026-04-01T00:00:00Z&date_to=2026-04-05T23:59:59Z",
    );
    expect(res.status).toBe(200);
  });

  test("filters by search term", async () => {
    const res = await testApp.request("/api/v1/history?search=owl");
    expect(res.status).toBe(200);
  });

  test("rejects invalid per_page > 100", async () => {
    const res = await testApp.request("/api/v1/history?per_page=200");
    expect(res.status).toBe(400);
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/api && bun test src/routes/history.test.ts`
Expected: FAIL — module not found

### Step 3: Write minimal implementation

```ts
// apps/api/src/routes/history.ts
import { Hono } from "hono";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { buildDateRange, type HistoryItem, type HistoryResponse } from "../services/history-query";

export const historyRouter = new Hono();

historyRouter.get("/", async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1"));
  const perPage = parseInt(c.req.query("per_page") || "24");
  if (perPage < 1 || perPage > 100) {
    return c.json({ error: "per_page deve ser entre 1 e 100" }, 400);
  }

  const mode = c.req.query("mode") || "all";
  const status = c.req.query("status") || "all";
  const categoryParam = c.req.query("category");
  const categories = categoryParam ? categoryParam.split(",") : [];
  const model = c.req.query("model") || null;
  const quality = c.req.query("quality") || null;
  const search = c.req.query("search") || null;
  const datePreset = c.req.query("date_preset") || null;
  const dateFromParam = c.req.query("date_from") || null;
  const dateToParam = c.req.query("date_to") || null;

  // Resolve date range: preset takes precedence, then custom range
  let dateFrom: Date | null = null;
  let dateTo: Date | null = null;
  if (datePreset && datePreset !== "all") {
    const range = buildDateRange(datePreset as any);
    dateFrom = range.from;
    dateTo = range.to;
  } else {
    dateFrom = dateFromParam ? new Date(dateFromParam) : null;
    dateTo = dateToParam ? new Date(dateToParam) : null;
  }

  // Build WHERE fragments for generation_jobs
  const genConditions: string[] = ["gj.status IN ('completed', 'error')"];
  if (status !== "all") genConditions.push(`gj.status = '${status}'`);
  if (categories.length > 0) {
    const cats = categories.map((c) => `'${c}'`).join(",");
    genConditions.push(`it.category IN (${cats})`);
  }
  if (model) genConditions.push(`gj.model = '${model}'`);
  if (quality) genConditions.push(`gj.quality_tier = '${quality}'`);
  if (search) genConditions.push(`(gj.prompt ILIKE '%${search}%' OR gj.enhanced_prompt ILIKE '%${search}%')`);
  if (dateFrom) genConditions.push(`gj.created_at >= '${dateFrom.toISOString()}'`);
  if (dateTo) genConditions.push(`gj.created_at <= '${dateTo.toISOString()}'`);

  // Build WHERE fragments for image_uploads
  const uplConditions: string[] = ["iu.status IN ('processed', 'error')"];
  if (status === "completed") uplConditions.push("iu.status = 'processed'");
  else if (status === "error") uplConditions.push("iu.status = 'error'");
  if (categories.length > 0) {
    const cats = categories.map((c) => `'${c}'`).join(",");
    uplConditions.push(`it.category IN (${cats})`);
  }
  if (search) uplConditions.push(`iu.original_filename ILIKE '%${search}%'`);
  if (dateFrom) uplConditions.push(`iu.created_at >= '${dateFrom.toISOString()}'`);
  if (dateTo) uplConditions.push(`iu.created_at <= '${dateTo.toISOString()}'`);

  // Generation-only filters make upload query return nothing
  const skipUploads = mode === "generation" || !!model || !!quality;
  const skipGeneration = mode === "upload";

  const genWhere = genConditions.join(" AND ");
  const uplWhere = uplConditions.join(" AND ");
  const offset = (page - 1) * perPage;

  const parts: string[] = [];

  if (!skipGeneration) {
    parts.push(`
      SELECT
        gj.id,
        'generation' AS mode,
        gj.status,
        gj.created_at,
        it.category,
        COALESCE(it.display_name, 'Personalizado') AS image_type_name,
        COALESCE(gj.target_size_w, gj.generation_size_w) AS final_width,
        COALESCE(gj.target_size_h, gj.generation_size_h) AS final_height,
        gj.processed_format AS final_format,
        gj.processed_size_kb AS final_size_kb,
        gj.prompt,
        gj.enhanced_prompt,
        gj.model,
        gj.quality_tier,
        gj.cost_usd,
        NULL AS original_filename,
        NULL::integer AS original_width,
        NULL::integer AS original_height,
        NULL::integer AS original_size_kb,
        NULL::integer AS ai_quality_score
      FROM generation_jobs gj
      LEFT JOIN image_types it ON gj.image_type_id = it.id
      WHERE ${genWhere}
    `);
  }

  if (!skipUploads) {
    parts.push(`
      SELECT
        iu.id,
        'upload' AS mode,
        CASE WHEN iu.status = 'processed' THEN 'completed' ELSE iu.status END AS status,
        iu.created_at,
        it.category,
        it.display_name AS image_type_name,
        iu.processed_width AS final_width,
        iu.processed_height AS final_height,
        iu.processed_format AS final_format,
        iu.processed_size_kb AS final_size_kb,
        NULL AS prompt,
        NULL AS enhanced_prompt,
        NULL AS model,
        NULL AS quality_tier,
        NULL AS cost_usd,
        iu.original_filename,
        iu.original_width,
        iu.original_height,
        iu.original_size_kb,
        iu.ai_quality_score
      FROM image_uploads iu
      LEFT JOIN image_types it ON iu.target_image_type_id = it.id
      WHERE ${uplWhere}
    `);
  }

  if (parts.length === 0) {
    return c.json({ items: [], total: 0, page, perPage, hasMore: false });
  }

  const unionQuery = parts.join(" UNION ALL ");
  const dataQuery = `${unionQuery} ORDER BY created_at DESC LIMIT ${perPage} OFFSET ${offset}`;
  const countQuery = `SELECT COUNT(*) AS total FROM (${unionQuery}) AS combined`;

  const [dataResult, countResult] = await Promise.all([
    db.execute(sql.raw(dataQuery)),
    db.execute(sql.raw(countQuery)),
  ]);

  const rows = (dataResult as any[]) || [];
  const total = parseInt((countResult as any[])[0]?.total || "0");

  const items: HistoryItem[] = rows.map((row) => ({
    id: row.id,
    mode: row.mode,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    thumbnailUrl: `/api/v1/history/${row.id}/thumbnail?mode=${row.mode}`,
    downloadUrl: row.mode === "generation"
      ? `/api/v1/generate/${row.id}/download`
      : `/api/v1/images/${row.id}/download`,
    category: row.category || null,
    imageTypeName: row.image_type_name || null,
    finalWidth: row.final_width,
    finalHeight: row.final_height,
    finalFormat: row.final_format,
    finalSizeKb: row.final_size_kb,
    prompt: row.prompt || null,
    enhancedPrompt: row.enhanced_prompt || null,
    model: row.model || null,
    qualityTier: row.quality_tier || null,
    costUsd: row.cost_usd ? parseFloat(row.cost_usd) : null,
    originalFilename: row.original_filename || null,
    originalWidth: row.original_width || null,
    originalHeight: row.original_height || null,
    originalSizeKb: row.original_size_kb || null,
    aiQualityScore: row.ai_quality_score || null,
  }));

  return c.json({
    items,
    total,
    page,
    perPage,
    hasMore: offset + items.length < total,
  } satisfies HistoryResponse);
});
```

**Important:** The SQL string interpolation above is safe for this internal tool, but for production hardening, convert category/model/quality/search filters to use Drizzle parameterized queries. The plan uses string interpolation for clarity — refactor to parameterized queries during the refactor step.

### Step 4: Run test to verify it passes

Run: `cd apps/api && bun test src/routes/history.test.ts`
Expected: PASS (7 tests)

### Step 5: Register route

```ts
// apps/api/src/index.ts — add after existing route registrations (around line 64)
import { historyRouter } from "./routes/history";
// ...
app.route("/api/v1/history", historyRouter);
```

### Step 6: Refactor — parameterize SQL

Replace string interpolation in filters with Drizzle's `sql` template tag for safe parameterization:

```ts
// Example: replace `gj.model = '${model}'`
// with parameterized: sql`gj.model = ${model}`
```

Build the query using `sql` template tag composition instead of raw strings. This prevents SQL injection on the `search` parameter.

### Step 7: Run all backend tests

Run: `cd apps/api && bun test`
Expected: All tests PASS

---

## Task 3: Thumbnail Route

**Files:**
- Modify: `apps/api/src/routes/history.ts` (add thumbnail endpoint)
- Modify: `apps/api/src/routes/history.test.ts` (add thumbnail tests)

### Step 1: Write the failing test

```ts
// Add to history.test.ts
import sharp from "sharp";

let testPngBuffer: Buffer;

beforeAll(async () => {
  testPngBuffer = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).png().toBuffer();
});

const mockGetImageBuffer = mock(async () => testPngBuffer);

mock.module("../services/storage", () => ({
  getImageBuffer: mockGetImageBuffer,
}));

describe("GET /api/v1/history/:id/thumbnail", () => {
  test("returns resized JPEG thumbnail", async () => {
    // Mock db.execute to return a row with processedS3Key
    executeResult = [{ processed_s3_key: "generated/gen-1/img.png" }];
    mockGetImageBuffer.mockResolvedValueOnce(testPngBuffer);

    const res = await testApp.request("/api/v1/history/gen-1/thumbnail?mode=generation");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toContain("max-age=86400");

    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(400);
    expect(meta.format).toBe("jpeg");
  });

  test("returns 404 for unknown id", async () => {
    executeResult = [];
    const res = await testApp.request("/api/v1/history/unknown/thumbnail?mode=generation");
    expect(res.status).toBe(404);
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/api && bun test src/routes/history.test.ts`
Expected: FAIL — route not found

### Step 3: Write minimal implementation

```ts
// Add to apps/api/src/routes/history.ts
import sharp from "sharp";
import { getImageBuffer } from "../services/storage";
import { generationJobs, imageUploads } from "../db/schema";
import { eq } from "drizzle-orm";

historyRouter.get("/:id/thumbnail", async (c) => {
  const id = c.req.param("id");
  const mode = c.req.query("mode") || "generation";

  let s3Key: string | null = null;

  if (mode === "generation") {
    const [job] = await db.select({ key: generationJobs.processedS3Key })
      .from(generationJobs).where(eq(generationJobs.id, id));
    s3Key = job?.key || null;
  } else {
    const [upload] = await db.select({ key: imageUploads.processedS3Key })
      .from(imageUploads).where(eq(imageUploads.id, id));
    s3Key = upload?.key || null;
  }

  if (!s3Key) return c.json({ error: "Imagem não encontrada" }, 404);

  const buffer = await getImageBuffer(s3Key);
  const thumbnail = await sharp(Buffer.from(buffer))
    .resize(400, null, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(thumbnail), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
});
```

### Step 4: Run tests

Run: `cd apps/api && bun test src/routes/history.test.ts`
Expected: PASS

---

## Task 4: Delete Route

**Files:**
- Modify: `apps/api/src/routes/history.ts`
- Modify: `apps/api/src/routes/history.test.ts`

### Step 1: Write the failing test

```ts
// Add to history.test.ts
const mockDeleteFromS3 = mock(async () => {});

// Add to existing storage mock:
mock.module("../services/storage", () => ({
  getImageBuffer: mockGetImageBuffer,
  deleteFromS3: mockDeleteFromS3,
}));

describe("DELETE /api/v1/history/:id", () => {
  test("deletes a generation job and returns 204", async () => {
    executeResult = [{ id: "gen-1" }]; // mock select finding the row
    const res = await testApp.request("/api/v1/history/gen-1?mode=generation", {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
  });

  test("returns 404 for unknown id", async () => {
    executeResult = [];
    const res = await testApp.request("/api/v1/history/unknown?mode=generation", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/api && bun test src/routes/history.test.ts`
Expected: FAIL — 404 (route not defined)

### Step 3: Write minimal implementation

```ts
// Add to apps/api/src/routes/history.ts
import { deleteFromS3 } from "../services/storage";

historyRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const mode = c.req.query("mode");

  if (mode === "generation") {
    const [job] = await db.select({
      id: generationJobs.id,
      s3Key: generationJobs.processedS3Key,
    }).from(generationJobs).where(eq(generationJobs.id, id));

    if (!job) return c.json({ error: "Job não encontrado" }, 404);
    if (job.s3Key) await deleteFromS3(job.s3Key);
    await db.delete(generationJobs).where(eq(generationJobs.id, id));
  } else {
    const [upload] = await db.select({
      id: imageUploads.id,
      originalS3Key: imageUploads.originalS3Key,
      processedS3Key: imageUploads.processedS3Key,
    }).from(imageUploads).where(eq(imageUploads.id, id));

    if (!upload) return c.json({ error: "Upload não encontrado" }, 404);
    if (upload.originalS3Key) await deleteFromS3(upload.originalS3Key);
    if (upload.processedS3Key) await deleteFromS3(upload.processedS3Key);
    await db.delete(imageUploads).where(eq(imageUploads.id, id));
  }

  return new Response(null, { status: 204 });
});
```

**Note:** Check if `deleteFromS3` already exists in `apps/api/src/services/storage.ts`. If not, add it:

```ts
// apps/api/src/services/storage.ts
export async function deleteFromS3(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key });
  await s3Client.send(command);
}
```

And add the import in `apps/api/src/lib/s3.ts`:

```ts
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
```

### Step 4: Run tests

Run: `cd apps/api && bun test src/routes/history.test.ts`
Expected: PASS

### Step 5: Run all backend tests

Run: `cd apps/api && bun test`
Expected: All PASS

---

## Task 5: Frontend API Client & Types

**Files:**
- Modify: `apps/web/src/lib/api.ts` (add history functions)
- Create: `apps/web/src/lib/api-history.test.ts`

### Step 1: Write the failing test

```ts
// apps/web/src/lib/api-history.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll test the URL construction and error handling
describe("fetchHistory", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls correct URL with default params", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [], total: 0, page: 1, perPage: 24, hasMore: false }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { fetchHistory } = await import("./api");
    await fetchHistory({});

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/history");
    expect(url).toContain("page=1");
    expect(url).toContain("per_page=24");
  });

  it("includes filter params in URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [], total: 0, page: 1, perPage: 24, hasMore: false }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { fetchHistory } = await import("./api");
    await fetchHistory({
      mode: "generation",
      category: "admin,content",
      search: "owl",
      datePreset: "today",
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("mode=generation");
    expect(url).toContain("category=admin%2Ccontent");
    expect(url).toContain("search=owl");
    expect(url).toContain("date_preset=today");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    }));

    const { fetchHistory } = await import("./api");
    await expect(fetchHistory({})).rejects.toThrow("Erro ao carregar histórico");
  });
});

describe("deleteHistoryItem", () => {
  it("sends DELETE request with mode param", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const { deleteHistoryItem } = await import("./api");
    await deleteHistoryItem("gen-1", "generation");

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/history/gen-1");
    expect(url).toContain("mode=generation");
    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("DELETE");
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/web && bunx vitest run src/lib/api-history.test.ts`
Expected: FAIL — functions not exported

### Step 3: Write minimal implementation

```ts
// Add to apps/web/src/lib/api.ts

// --- History types ---

export type HistoryItem = {
  id: string;
  mode: "generation" | "upload";
  status: string;
  createdAt: string;
  thumbnailUrl: string;
  downloadUrl: string;
  category: string | null;
  imageTypeName: string | null;
  finalWidth: number | null;
  finalHeight: number | null;
  finalFormat: string | null;
  finalSizeKb: number | null;
  prompt: string | null;
  enhancedPrompt: string | null;
  model: string | null;
  qualityTier: string | null;
  costUsd: number | null;
  originalFilename: string | null;
  originalWidth: number | null;
  originalHeight: number | null;
  originalSizeKb: number | null;
  aiQualityScore: number | null;
};

export type HistoryResponse = {
  items: HistoryItem[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
};

export type HistoryFilterParams = {
  page?: number;
  perPage?: number;
  mode?: string;
  status?: string;
  category?: string;
  model?: string;
  quality?: string;
  search?: string;
  datePreset?: string;
  dateFrom?: string;
  dateTo?: string;
};

// --- History API functions ---

export async function fetchHistory(filters: HistoryFilterParams): Promise<HistoryResponse> {
  const params = new URLSearchParams();
  params.set("page", String(filters.page || 1));
  params.set("per_page", String(filters.perPage || 24));
  if (filters.mode && filters.mode !== "all") params.set("mode", filters.mode);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  if (filters.model) params.set("model", filters.model);
  if (filters.quality) params.set("quality", filters.quality);
  if (filters.search) params.set("search", filters.search);
  if (filters.datePreset && filters.datePreset !== "all") params.set("date_preset", filters.datePreset);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);

  const res = await apiFetch(`${API_URL}/history?${params}`);
  if (!res.ok) throw new Error("Erro ao carregar histórico");
  return res.json();
}

export async function deleteHistoryItem(id: string, mode: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/history/${id}?mode=${mode}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erro ao excluir item");
}
```

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run src/lib/api-history.test.ts`
Expected: PASS

---

## Task 6: useHistoryFilters Hook

**Files:**
- Create: `apps/web/src/hooks/useHistoryFilters.ts`
- Create: `apps/web/src/hooks/useHistoryFilters.test.ts`

### Step 1: Write the failing test

```ts
// apps/web/src/hooks/useHistoryFilters.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHistoryFilters } from "./useHistoryFilters";

// Mock window.history.replaceState
beforeEach(() => {
  vi.stubGlobal("location", { search: "", pathname: "/" });
  vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
});

describe("useHistoryFilters", () => {
  it("returns default filter values", () => {
    const { result } = renderHook(() => useHistoryFilters());
    expect(result.current.filters.mode).toBe("all");
    expect(result.current.filters.status).toBe("all");
    expect(result.current.filters.datePreset).toBe("all");
    expect(result.current.filters.search).toBe("");
    expect(result.current.filters.categories).toEqual([]);
  });

  it("updates mode filter and syncs to URL", () => {
    const { result } = renderHook(() => useHistoryFilters());
    act(() => result.current.setFilter("mode", "generation"));
    expect(result.current.filters.mode).toBe("generation");
  });

  it("toggles category in multi-select", () => {
    const { result } = renderHook(() => useHistoryFilters());
    act(() => result.current.toggleCategory("admin"));
    expect(result.current.filters.categories).toEqual(["admin"]);
    act(() => result.current.toggleCategory("content"));
    expect(result.current.filters.categories).toEqual(["admin", "content"]);
    act(() => result.current.toggleCategory("admin"));
    expect(result.current.filters.categories).toEqual(["content"]);
  });

  it("clears all filters to defaults", () => {
    const { result } = renderHook(() => useHistoryFilters());
    act(() => result.current.setFilter("mode", "generation"));
    act(() => result.current.setFilter("search", "test"));
    act(() => result.current.clearAll());
    expect(result.current.filters.mode).toBe("all");
    expect(result.current.filters.search).toBe("");
  });

  it("reports activeFilterCount correctly", () => {
    const { result } = renderHook(() => useHistoryFilters());
    expect(result.current.activeFilterCount).toBe(0);
    act(() => result.current.setFilter("mode", "generation"));
    expect(result.current.activeFilterCount).toBe(1);
    act(() => result.current.toggleCategory("admin"));
    expect(result.current.activeFilterCount).toBe(2);
  });

  it("sets custom date range and clears preset", () => {
    const { result } = renderHook(() => useHistoryFilters());
    act(() => result.current.setFilter("datePreset", "today"));
    expect(result.current.filters.datePreset).toBe("today");
    act(() => result.current.setDateRange("2026-04-01", "2026-04-05"));
    expect(result.current.filters.dateFrom).toBe("2026-04-01");
    expect(result.current.filters.dateTo).toBe("2026-04-05");
    expect(result.current.filters.datePreset).toBe("all");
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/web && bunx vitest run src/hooks/useHistoryFilters.test.ts`
Expected: FAIL — module not found

### Step 3: Write minimal implementation

```ts
// apps/web/src/hooks/useHistoryFilters.ts
import { useState, useCallback, useMemo } from "react";
import type { HistoryFilterParams } from "@/lib/api";

export type HistoryFilterState = {
  mode: string;
  status: string;
  categories: string[];
  model: string;
  quality: string;
  search: string;
  datePreset: string;
  dateFrom: string;
  dateTo: string;
};

const DEFAULTS: HistoryFilterState = {
  mode: "all",
  status: "all",
  categories: [],
  model: "",
  quality: "",
  search: "",
  datePreset: "all",
  dateFrom: "",
  dateTo: "",
};

function syncToUrl(filters: HistoryFilterState) {
  const params = new URLSearchParams();
  if (filters.mode !== "all") params.set("mode", filters.mode);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.categories.length) params.set("category", filters.categories.join(","));
  if (filters.model) params.set("model", filters.model);
  if (filters.quality) params.set("quality", filters.quality);
  if (filters.search) params.set("search", filters.search);
  if (filters.datePreset !== "all") params.set("date_preset", filters.datePreset);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

export function useHistoryFilters() {
  const [filters, setFilters] = useState<HistoryFilterState>(() => {
    // Parse URL on mount
    const params = new URLSearchParams(window.location.search);
    return {
      mode: params.get("mode") || "all",
      status: params.get("status") || "all",
      categories: params.get("category")?.split(",").filter(Boolean) || [],
      model: params.get("model") || "",
      quality: params.get("quality") || "",
      search: params.get("search") || "",
      datePreset: params.get("date_preset") || "all",
      dateFrom: params.get("date_from") || "",
      dateTo: params.get("date_to") || "",
    };
  });

  const setFilter = useCallback(<K extends keyof HistoryFilterState>(
    key: K,
    value: HistoryFilterState[K],
  ) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      syncToUrl(next);
      return next;
    });
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setFilters((prev) => {
      const cats = prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat];
      const next = { ...prev, categories: cats };
      syncToUrl(next);
      return next;
    });
  }, []);

  const setDateRange = useCallback((from: string, to: string) => {
    setFilters((prev) => {
      const next = { ...prev, dateFrom: from, dateTo: to, datePreset: "all" };
      syncToUrl(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setFilters(DEFAULTS);
    syncToUrl(DEFAULTS);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.mode !== "all") count++;
    if (filters.status !== "all") count++;
    if (filters.categories.length > 0) count++;
    if (filters.model) count++;
    if (filters.quality) count++;
    if (filters.search) count++;
    if (filters.datePreset !== "all") count++;
    if (filters.dateFrom || filters.dateTo) count++;
    return count;
  }, [filters]);

  // Convert to API params shape
  const apiParams: HistoryFilterParams = useMemo(() => ({
    mode: filters.mode,
    status: filters.status,
    category: filters.categories.join(",") || undefined,
    model: filters.model || undefined,
    quality: filters.quality || undefined,
    search: filters.search || undefined,
    datePreset: filters.datePreset,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  }), [filters]);

  return {
    filters,
    apiParams,
    setFilter,
    toggleCategory,
    setDateRange,
    clearAll,
    activeFilterCount,
  };
}
```

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run src/hooks/useHistoryFilters.test.ts`
Expected: PASS (6 tests)

---

## Task 7: useHistoryStore (UI State)

**Files:**
- Create: `apps/web/src/stores/history-store.ts`
- Create: `apps/web/src/stores/history-store.test.ts`

### Step 1: Write the failing test

```ts
// apps/web/src/stores/history-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useHistoryStore } from "./history-store";

beforeEach(() => {
  useHistoryStore.setState({
    selectedItemId: null,
    panelOpen: false,
    lightboxOpen: false,
    lightboxMode: "single",
  });
});

describe("useHistoryStore", () => {
  it("starts with panel closed and no selection", () => {
    const state = useHistoryStore.getState();
    expect(state.selectedItemId).toBeNull();
    expect(state.panelOpen).toBe(false);
    expect(state.lightboxOpen).toBe(false);
  });

  it("selectItem opens panel and sets id", () => {
    useHistoryStore.getState().selectItem("gen-1");
    const state = useHistoryStore.getState();
    expect(state.selectedItemId).toBe("gen-1");
    expect(state.panelOpen).toBe(true);
  });

  it("closePanel resets selection and closes panel", () => {
    useHistoryStore.getState().selectItem("gen-1");
    useHistoryStore.getState().closePanel();
    const state = useHistoryStore.getState();
    expect(state.selectedItemId).toBeNull();
    expect(state.panelOpen).toBe(false);
  });

  it("openLightbox sets mode", () => {
    useHistoryStore.getState().openLightbox("compare");
    const state = useHistoryStore.getState();
    expect(state.lightboxOpen).toBe(true);
    expect(state.lightboxMode).toBe("compare");
  });

  it("closeLightbox keeps panel open", () => {
    useHistoryStore.getState().selectItem("gen-1");
    useHistoryStore.getState().openLightbox("single");
    useHistoryStore.getState().closeLightbox();
    const state = useHistoryStore.getState();
    expect(state.lightboxOpen).toBe(false);
    expect(state.panelOpen).toBe(true);
    expect(state.selectedItemId).toBe("gen-1");
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/web && bunx vitest run src/stores/history-store.test.ts`
Expected: FAIL — module not found

### Step 3: Write minimal implementation

```ts
// apps/web/src/stores/history-store.ts
import { create } from "zustand";

type LightboxMode = "single" | "compare";

type HistoryUIState = {
  selectedItemId: string | null;
  panelOpen: boolean;
  lightboxOpen: boolean;
  lightboxMode: LightboxMode;

  selectItem: (id: string) => void;
  closePanel: () => void;
  openLightbox: (mode: LightboxMode) => void;
  closeLightbox: () => void;
};

export const useHistoryStore = create<HistoryUIState>((set) => ({
  selectedItemId: null,
  panelOpen: false,
  lightboxOpen: false,
  lightboxMode: "single",

  selectItem: (id) => set({ selectedItemId: id, panelOpen: true }),
  closePanel: () => set({ selectedItemId: null, panelOpen: false }),
  openLightbox: (mode) => set({ lightboxOpen: true, lightboxMode: mode }),
  closeLightbox: () => set({ lightboxOpen: false }),
}));
```

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run src/stores/history-store.test.ts`
Expected: PASS (5 tests)

---

## Task 8: HistoryEmptyState Component

**Files:**
- Create: `apps/web/src/components/history/HistoryEmptyState.tsx`
- Create: `apps/web/src/components/history/HistoryEmptyState.test.tsx`

### Step 1: Write the failing test

```tsx
// apps/web/src/components/history/HistoryEmptyState.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { HistoryEmptyState } from "./HistoryEmptyState";

describe("HistoryEmptyState", () => {
  it("renders first-use state with CTAs", () => {
    render(<HistoryEmptyState variant="first-use" />);
    expect(screen.getByText("Nenhuma imagem no histórico")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /gerar imagem/i })).toBeInTheDocument();
  });

  it("renders no-results state with clear button", async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(<HistoryEmptyState variant="no-results" onClearFilters={onClear} />);
    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /limpar filtros/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("renders error state with retry button", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<HistoryEmptyState variant="error" errorMessage="Falha na conexão" onRetry={onRetry} />);
    expect(screen.getByText("Falha na conexão")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/web && bunx vitest run src/components/history/HistoryEmptyState.test.tsx`
Expected: FAIL — module not found

### Step 3: Write minimal implementation

```tsx
// apps/web/src/components/history/HistoryEmptyState.tsx
type Props =
  | { variant: "first-use"; onClearFilters?: never; onRetry?: never; errorMessage?: never }
  | { variant: "no-results"; onClearFilters: () => void; onRetry?: never; errorMessage?: never }
  | { variant: "error"; onRetry: () => void; errorMessage: string; onClearFilters?: never };

export function HistoryEmptyState(props: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {props.variant === "first-use" && (
        <>
          <svg className="h-16 w-16 text-outline mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
          <h3 className="text-lg font-bold text-on-surface font-headline">Nenhuma imagem no histórico</h3>
          <p className="mt-1 text-sm text-on-surface-variant max-w-sm">
            Gere ou processe sua primeira imagem para vê-la aqui.
          </p>
          <div className="mt-4 flex gap-3">
            <a href="/?nav=generate" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90 transition-colors">
              Gerar Imagem
            </a>
          </div>
        </>
      )}

      {props.variant === "no-results" && (
        <>
          <svg className="h-16 w-16 text-outline mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <h3 className="text-lg font-bold text-on-surface font-headline">Nenhum resultado encontrado</h3>
          <p className="mt-1 text-sm text-on-surface-variant max-w-sm">
            Tente ajustar seus filtros ou limpar a busca.
          </p>
          <button
            onClick={props.onClearFilters}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90 transition-colors"
          >
            Limpar Filtros
          </button>
        </>
      )}

      {props.variant === "error" && (
        <>
          <svg className="h-16 w-16 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h3 className="text-lg font-bold text-on-surface font-headline">Erro ao carregar histórico</h3>
          <p className="mt-1 text-sm text-red-400">{props.errorMessage}</p>
          <button
            onClick={props.onRetry}
            className="mt-4 rounded-lg border border-outline-variant/20 px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Tentar Novamente
          </button>
        </>
      )}
    </div>
  );
}
```

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run src/components/history/HistoryEmptyState.test.tsx`
Expected: PASS (3 tests)

---

## Task 9: HistoryCard Component

**Files:**
- Create: `apps/web/src/components/history/HistoryCard.tsx`
- Create: `apps/web/src/components/history/HistoryCard.test.tsx`

### Step 1: Write the failing test

```tsx
// apps/web/src/components/history/HistoryCard.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { HistoryCard } from "./HistoryCard";
import type { HistoryItem } from "@/lib/api";

const mockGenItem: HistoryItem = {
  id: "gen-1",
  mode: "generation",
  status: "completed",
  createdAt: new Date().toISOString(),
  thumbnailUrl: "/api/v1/history/gen-1/thumbnail?mode=generation",
  downloadUrl: "/api/v1/generate/gen-1/download",
  category: "admin",
  imageTypeName: "Favicon",
  finalWidth: 256,
  finalHeight: 256,
  finalFormat: "png",
  finalSizeKb: 42,
  prompt: "A colorful owl",
  enhancedPrompt: null,
  model: "recraft_v3",
  qualityTier: "high",
  costUsd: 0.04,
  originalFilename: null,
  originalWidth: null,
  originalHeight: null,
  originalSizeKb: null,
  aiQualityScore: null,
};

describe("HistoryCard", () => {
  it("renders image type name and metadata", () => {
    render(<HistoryCard item={mockGenItem} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("Favicon")).toBeInTheDocument();
    expect(screen.getByText(/256×256/)).toBeInTheDocument();
    expect(screen.getByText(/PNG/i)).toBeInTheDocument();
  });

  it("shows mode badge", () => {
    render(<HistoryCard item={mockGenItem} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("Geração")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<HistoryCard item={mockGenItem} isSelected={false} onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows selected state with primary border", () => {
    const { container } = render(
      <HistoryCard item={mockGenItem} isSelected={true} onClick={() => {}} />,
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("border-primary");
  });

  it("shows error status badge for failed items", () => {
    const errorItem = { ...mockGenItem, status: "error" };
    render(<HistoryCard item={errorItem} isSelected={false} onClick={() => {}} />);
    // Error badge should be visible (red dot)
    expect(screen.getByTestId("status-badge")).toHaveClass("bg-red-400");
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/web && bunx vitest run src/components/history/HistoryCard.test.tsx`
Expected: FAIL — module not found

### Step 3: Write minimal implementation

```tsx
// apps/web/src/components/history/HistoryCard.tsx
import { cn } from "@/lib/utils";
import type { HistoryItem } from "@/lib/api";

type Props = {
  item: HistoryItem;
  isSelected: boolean;
  onClick: () => void;
};

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function HistoryCard({ item, isSelected, onClick }: Props) {
  const title = item.imageTypeName || item.originalFilename || "Personalizado";
  const meta = [
    item.finalWidth && item.finalHeight ? `${item.finalWidth}×${item.finalHeight}` : null,
    item.finalFormat?.toUpperCase(),
    item.finalSizeKb ? `${item.finalSizeKb}KB` : null,
  ].filter(Boolean).join(" · ");

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative rounded-xl border text-left transition-all duration-200 overflow-hidden group",
        isSelected
          ? "border-2 border-primary shadow-xl shadow-primary/5"
          : "border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high hover:scale-[1.02]",
      )}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-surface-container overflow-hidden">
        <img
          src={`${API_URL}${item.thumbnailUrl.replace("/api/v1", "")}`}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover transition-all duration-300 blur-[2px] group-hover:blur-0"
          onLoad={(e) => e.currentTarget.classList.remove("blur-[2px]")}
        />
      </div>

      {/* Status badge */}
      <div
        data-testid="status-badge"
        className={cn(
          "absolute top-2 left-2 h-2.5 w-2.5 rounded-full",
          item.status === "error" ? "bg-red-400" : "bg-emerald-400",
        )}
      />

      {/* Mode badge */}
      <div className={cn(
        "absolute top-2 right-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
        item.mode === "generation"
          ? "bg-blue-500/20 text-blue-300"
          : "bg-purple-500/20 text-purple-300",
      )}>
        {item.mode === "generation" ? "Geração" : "Upload"}
      </div>

      {/* Text content */}
      <div className="p-3 space-y-0.5">
        <div className="font-headline font-bold text-sm text-on-surface truncate">{title}</div>
        <div className="text-[11px] text-on-surface-variant">{meta}</div>
        <div className="text-[11px] text-outline">{formatTime(item.createdAt)}</div>
      </div>
    </button>
  );
}
```

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run src/components/history/HistoryCard.test.tsx`
Expected: PASS (5 tests)

---

## Task 10: HistoryGrid Component (Date Grouping + Load More)

**Files:**
- Create: `apps/web/src/components/history/HistoryGrid.tsx`
- Create: `apps/web/src/components/history/HistoryGrid.test.tsx`

### Step 1: Write the failing test

```tsx
// apps/web/src/components/history/HistoryGrid.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { HistoryGrid } from "./HistoryGrid";
import type { HistoryItem } from "@/lib/api";

const today = new Date().toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();

const mockItems: HistoryItem[] = [
  { id: "1", mode: "generation", status: "completed", createdAt: today, thumbnailUrl: "", downloadUrl: "", category: "admin", imageTypeName: "Favicon", finalWidth: 256, finalHeight: 256, finalFormat: "png", finalSizeKb: 42, prompt: "test", enhancedPrompt: null, model: "recraft_v3", qualityTier: "high", costUsd: 0.04, originalFilename: null, originalWidth: null, originalHeight: null, originalSizeKb: null, aiQualityScore: null },
  { id: "2", mode: "upload", status: "completed", createdAt: yesterday, thumbnailUrl: "", downloadUrl: "", category: "user", imageTypeName: "Avatar", finalWidth: 128, finalHeight: 128, finalFormat: "jpeg", finalSizeKb: 30, prompt: null, enhancedPrompt: null, model: null, qualityTier: null, costUsd: null, originalFilename: "photo.jpg", originalWidth: 1200, originalHeight: 800, originalSizeKb: 480, aiQualityScore: 8 },
];

describe("HistoryGrid", () => {
  it("renders items grouped by date with sticky headers", () => {
    render(
      <HistoryGrid
        items={mockItems}
        total={2}
        hasMore={false}
        selectedItemId={null}
        onSelectItem={() => {}}
        onLoadMore={() => {}}
        isLoadingMore={false}
      />,
    );
    expect(screen.getByText(/Hoje/)).toBeInTheDocument();
    expect(screen.getByText(/Ontem/)).toBeInTheDocument();
  });

  it("shows 'Carregar Mais' button when hasMore is true", () => {
    render(
      <HistoryGrid
        items={mockItems}
        total={50}
        hasMore={true}
        selectedItemId={null}
        onSelectItem={() => {}}
        onLoadMore={() => {}}
        isLoadingMore={false}
      />,
    );
    expect(screen.getByRole("button", { name: /carregar mais/i })).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 2 de 50/)).toBeInTheDocument();
  });

  it("calls onLoadMore when button is clicked", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <HistoryGrid
        items={mockItems}
        total={50}
        hasMore={true}
        selectedItemId={null}
        onSelectItem={() => {}}
        onLoadMore={onLoadMore}
        isLoadingMore={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /carregar mais/i }));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("hides button when hasMore is false", () => {
    render(
      <HistoryGrid
        items={mockItems}
        total={2}
        hasMore={false}
        selectedItemId={null}
        onSelectItem={() => {}}
        onLoadMore={() => {}}
        isLoadingMore={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /carregar mais/i })).not.toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/web && bunx vitest run src/components/history/HistoryGrid.test.tsx`
Expected: FAIL

### Step 3: Write minimal implementation

```tsx
// apps/web/src/components/history/HistoryGrid.tsx
import type { HistoryItem } from "@/lib/api";
import { HistoryCard } from "./HistoryCard";

type Props = {
  items: HistoryItem[];
  total: number;
  hasMore: boolean;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onLoadMore: () => void;
  isLoadingMore: boolean;
};

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDate.getTime() === today.getTime()) {
    return `Hoje — ${date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`;
  }
  if (itemDate.getTime() === yesterday.getTime()) {
    return `Ontem — ${date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`;
  }

  // Older than 30 days: group by month
  const diffDays = Math.floor((today.getTime() - itemDate.getTime()) / 86400000);
  if (diffDays > 30) {
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

function groupByDate(items: HistoryItem[]): Map<string, HistoryItem[]> {
  const groups = new Map<string, HistoryItem[]>();
  for (const item of items) {
    const key = formatDateGroup(item.createdAt);
    const existing = groups.get(key) || [];
    existing.push(item);
    groups.set(key, existing);
  }
  return groups;
}

export function HistoryGrid({
  items, total, hasMore, selectedItemId, onSelectItem, onLoadMore, isLoadingMore,
}: Props) {
  const groups = groupByDate(items);

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([dateLabel, groupItems]) => (
        <div key={dateLabel}>
          <h4 className="sticky top-0 z-10 bg-surface/80 backdrop-blur-sm py-2 text-sm font-medium text-on-surface-variant border-b border-outline-variant/10 mb-3">
            {dateLabel}
          </h4>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {groupItems.map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                onClick={() => onSelectItem(item.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Load More */}
      <div className="text-center py-4 space-y-2">
        <p className="text-xs text-on-surface-variant">
          Mostrando {items.length} de {total} imagens
        </p>
        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded-lg border border-outline-variant/20 px-6 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? "Carregando..." : "Carregar Mais"}
          </button>
        )}
      </div>
    </div>
  );
}
```

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run src/components/history/HistoryGrid.test.tsx`
Expected: PASS (4 tests)

---

## Task 11: HistoryFilterBar Component

**Files:**
- Create: `apps/web/src/components/history/HistoryFilterBar.tsx`
- Create: `apps/web/src/components/history/HistoryFilterBar.test.tsx`

### Step 1: Write the failing test

```tsx
// apps/web/src/components/history/HistoryFilterBar.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { HistoryFilterBar } from "./HistoryFilterBar";
import type { HistoryFilterState } from "@/hooks/useHistoryFilters";

const defaultFilters: HistoryFilterState = {
  mode: "all",
  status: "all",
  categories: [],
  model: "",
  quality: "",
  search: "",
  datePreset: "all",
  dateFrom: "",
  dateTo: "",
};

const mockHandlers = {
  setFilter: vi.fn(),
  toggleCategory: vi.fn(),
  setDateRange: vi.fn(),
  clearAll: vi.fn(),
};

describe("HistoryFilterBar", () => {
  it("renders search input", () => {
    render(<HistoryFilterBar filters={defaultFilters} activeFilterCount={0} {...mockHandlers} />);
    expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument();
  });

  it("renders date preset chips", () => {
    render(<HistoryFilterBar filters={defaultFilters} activeFilterCount={0} {...mockHandlers} />);
    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(screen.getByText("Esta Semana")).toBeInTheDocument();
    expect(screen.getByText("Este Mês")).toBeInTheDocument();
    expect(screen.getByText("Todos")).toBeInTheDocument();
  });

  it("calls setFilter when search input changes", async () => {
    const user = userEvent.setup();
    render(<HistoryFilterBar filters={defaultFilters} activeFilterCount={0} {...mockHandlers} />);
    await user.type(screen.getByPlaceholderText(/buscar/i), "owl");
    // Debounced — check that setFilter was eventually called
    expect(mockHandlers.setFilter).toHaveBeenCalled();
  });

  it("calls setFilter when date preset is clicked", async () => {
    const user = userEvent.setup();
    render(<HistoryFilterBar filters={defaultFilters} activeFilterCount={0} {...mockHandlers} />);
    await user.click(screen.getByText("Hoje"));
    expect(mockHandlers.setFilter).toHaveBeenCalledWith("datePreset", "today");
  });

  it("shows 'Limpar Todos' when filters are active", () => {
    render(<HistoryFilterBar filters={{ ...defaultFilters, mode: "generation" }} activeFilterCount={1} {...mockHandlers} />);
    expect(screen.getByText(/limpar todos/i)).toBeInTheDocument();
  });

  it("hides 'Limpar Todos' when no filters are active", () => {
    render(<HistoryFilterBar filters={defaultFilters} activeFilterCount={0} {...mockHandlers} />);
    expect(screen.queryByText(/limpar todos/i)).not.toBeInTheDocument();
  });

  it("disables model dropdown when mode is upload", () => {
    render(
      <HistoryFilterBar filters={{ ...defaultFilters, mode: "upload" }} activeFilterCount={1} {...mockHandlers} />,
    );
    const modelSelect = screen.getByLabelText(/modelo/i);
    expect(modelSelect).toBeDisabled();
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/web && bunx vitest run src/components/history/HistoryFilterBar.test.tsx`
Expected: FAIL

### Step 3: Write minimal implementation

Build `HistoryFilterBar` with:
- Search input (debounced 300ms with `useRef` + `setTimeout`)
- Mode select dropdown (Todos / Geração / Upload)
- Category multi-select dropdown (5 categories with checkboxes)
- Model select (disabled when mode=upload)
- Quality select (disabled when mode=upload)
- Status select (Todos / Sucesso / Erro)
- Date preset chip group (Hoje / Esta Semana / Este Mês / Todos)
- Date range picker button (triggers native date inputs as a minimal viable approach — can upgrade to a calendar component later)
- Active filter chips row with "Limpar Todos"

**Important patterns to follow:**
- `aria-label` on all dropdowns for accessibility
- `disabled` prop on generation-only filters when mode=upload
- Debounced search using `useRef` for timer ID
- Date preset chips use radio-style selection (only one active)
- Active filter chips: map non-default filters to dismissible `<span>` with ✕ button

The component is large — implement it as a single file following the `FormatSelector.tsx` pattern (direct className strings, `cn()` for conditionals). The full code for this component should be written during implementation; the key behaviors are covered by the tests above.

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run src/components/history/HistoryFilterBar.test.tsx`
Expected: PASS (7 tests)

---

## Task 12: HistoryDetailPanel Component

**Files:**
- Create: `apps/web/src/components/history/HistoryDetailPanel.tsx`
- Create: `apps/web/src/components/history/HistoryDetailPanel.test.tsx`

### Step 1: Write the failing test

```tsx
// apps/web/src/components/history/HistoryDetailPanel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import type { HistoryItem } from "@/lib/api";

const genItem: HistoryItem = {
  id: "gen-1", mode: "generation", status: "completed",
  createdAt: "2026-04-05T10:30:00Z",
  thumbnailUrl: "/thumb", downloadUrl: "/download",
  category: "admin", imageTypeName: "Favicon",
  finalWidth: 256, finalHeight: 256, finalFormat: "png", finalSizeKb: 42,
  prompt: "A colorful owl mascot", enhancedPrompt: "A vibrant colorful owl",
  model: "recraft_v3", qualityTier: "high", costUsd: 0.04,
  originalFilename: null, originalWidth: null, originalHeight: null,
  originalSizeKb: null, aiQualityScore: null,
};

const uploadItem: HistoryItem = {
  id: "upl-1", mode: "upload", status: "completed",
  createdAt: "2026-04-05T09:00:00Z",
  thumbnailUrl: "/thumb", downloadUrl: "/download",
  category: "user", imageTypeName: "Avatar",
  finalWidth: 128, finalHeight: 128, finalFormat: "jpeg", finalSizeKb: 30,
  prompt: null, enhancedPrompt: null, model: null, qualityTier: null, costUsd: null,
  originalFilename: "photo.jpg", originalWidth: 1200, originalHeight: 800,
  originalSizeKb: 480, aiQualityScore: 8,
};

describe("HistoryDetailPanel", () => {
  it("shows generation metadata for generation items", () => {
    render(
      <HistoryDetailPanel item={genItem} onClose={() => {}} onOpenLightbox={() => {}}
        onDelete={() => {}} onRegenerate={() => {}} />,
    );
    expect(screen.getByText("Favicon")).toBeInTheDocument();
    expect(screen.getByText("Recraft V3")).toBeInTheDocument();
    expect(screen.getByText(/0\.040/)).toBeInTheDocument();
    expect(screen.getByText(/A colorful owl mascot/)).toBeInTheDocument();
  });

  it("shows upload metadata for upload items", () => {
    render(
      <HistoryDetailPanel item={uploadItem} onClose={() => {}} onOpenLightbox={() => {}}
        onDelete={() => {}} onRegenerate={() => {}} />,
    );
    expect(screen.getByText("Avatar")).toBeInTheDocument();
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
    expect(screen.getByText(/1200×800/)).toBeInTheDocument();
    expect(screen.getByText(/480KB → 30KB/)).toBeInTheDocument();
    // Model/cost should NOT appear
    expect(screen.queryByText("Recraft V3")).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <HistoryDetailPanel item={genItem} onClose={onClose} onOpenLightbox={() => {}}
        onDelete={() => {}} onRegenerate={() => {}} />,
    );
    await user.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <HistoryDetailPanel item={genItem} onClose={() => {}} onOpenLightbox={() => {}}
        onDelete={onDelete} onRegenerate={() => {}} />,
    );
    await user.click(screen.getByRole("button", { name: /excluir/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("calls onOpenLightbox when image preview is clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <HistoryDetailPanel item={genItem} onClose={() => {}} onOpenLightbox={onOpen}
        onDelete={() => {}} onRegenerate={() => {}} />,
    );
    await user.click(screen.getByRole("button", { name: /ampliar/i }));
    expect(onOpen).toHaveBeenCalledWith("single");
  });

  it("shows re-generate button for generation items only", () => {
    const { rerender } = render(
      <HistoryDetailPanel item={genItem} onClose={() => {}} onOpenLightbox={() => {}}
        onDelete={() => {}} onRegenerate={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /re-gerar/i })).toBeInTheDocument();

    rerender(
      <HistoryDetailPanel item={uploadItem} onClose={() => {}} onOpenLightbox={() => {}}
        onDelete={() => {}} onRegenerate={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: /re-gerar/i })).not.toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/web && bunx vitest run src/components/history/HistoryDetailPanel.test.tsx`
Expected: FAIL

### Step 3: Write minimal implementation

Build `HistoryDetailPanel` with:
- Close button (✕) in header with `aria-label="Fechar"`
- Prev/Next navigation arrows in header
- Image preview (clickable → triggers `onOpenLightbox("single")`) with `aria-label="Ampliar imagem"`
- Metadata table: two-column layout with label + value rows
  - Always shown: Tipo, Categoria, Dimensões, Formato, Tamanho, Criado em
  - Generation-only: Modelo (mapped to display name), Qualidade, Custo (`$X.XXX`), Prompt, Prompt Aprimorado (collapsible)
  - Upload-only: Arquivo original, Antes → Depois (`{origW}×{origH} {origKb}KB → {finalW}×{finalH} {finalKb}KB`), Qualidade IA (score /10)
- Action bar:
  - Download link (always)
  - Comparar button (triggers `onOpenLightbox("compare")`, shown for uploads)
  - Re-gerar button (generation only, `aria-label="Re-gerar"`)
  - Excluir button (always, `aria-label="Excluir"`, red-tinted)
- Slide-in animation: `translate-x-full → translate-x-0`, 200ms ease-out
- Panel width: `w-[400px]` fixed, scrollable overflow-y

**Model display name mapping:**
```ts
const MODEL_NAMES: Record<string, string> = {
  recraft_v3: "Recraft V3",
  flux2_pro: "FLUX.2 Pro",
};
```

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run src/components/history/HistoryDetailPanel.test.tsx`
Expected: PASS (6 tests)

---

## Task 13: HistoryLightbox Component

**Files:**
- Create: `apps/web/src/components/history/HistoryLightbox.tsx`
- Create: `apps/web/src/components/history/HistoryLightbox.test.tsx`

### Step 1: Write the failing test

```tsx
// apps/web/src/components/history/HistoryLightbox.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { HistoryLightbox } from "./HistoryLightbox";

describe("HistoryLightbox", () => {
  const defaultProps = {
    imageUrl: "/api/v1/generate/gen-1/download",
    alt: "Test image",
    mode: "single" as const,
    onClose: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    currentIndex: 0,
    totalItems: 10,
  };

  it("renders image at full size", () => {
    render(<HistoryLightbox {...defaultProps} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", defaultProps.imageUrl);
  });

  it("shows position indicator", () => {
    render(<HistoryLightbox {...defaultProps} />);
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
  });

  it("closes on Escape key", async () => {
    const user = userEvent.setup();
    render(<HistoryLightbox {...defaultProps} />);
    await user.keyboard("{Escape}");
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  it("navigates with arrow keys", async () => {
    const user = userEvent.setup();
    render(<HistoryLightbox {...defaultProps} />);
    await user.keyboard("{ArrowRight}");
    expect(defaultProps.onNext).toHaveBeenCalledOnce();
    await user.keyboard("{ArrowLeft}");
    expect(defaultProps.onPrev).toHaveBeenCalledOnce();
  });

  it("renders with dialog role and aria-modal", () => {
    render(<HistoryLightbox {...defaultProps} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("renders comparison slider in compare mode", () => {
    render(
      <HistoryLightbox
        {...defaultProps}
        mode="compare"
        originalImageUrl="/original.jpg"
      />,
    );
    expect(screen.getByTestId("comparison-slider")).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/web && bunx vitest run src/components/history/HistoryLightbox.test.tsx`
Expected: FAIL

### Step 3: Write minimal implementation

Build `HistoryLightbox` with:
- Dark overlay `bg-black/90`, `role="dialog"`, `aria-modal="true"`
- Close button (✕) top-right
- Position indicator top-center: `{current+1} / {total}`
- Navigation arrows: left/right, `<button>` with SVG chevrons
- Keyboard: `useEffect` listener for `Escape`, `ArrowLeft`, `ArrowRight`
- Focus trap: `useRef` on dialog, `focus()` on mount, `tabIndex={-1}`
- **Single mode:** Full-size `<img>` centered
- **Compare mode:** Two images side-by-side with a draggable vertical divider
  - `data-testid="comparison-slider"`
  - Left image clipped with `clip-path: inset(0 ${100 - percentage}% 0 0)`
  - Drag handle: vertical bar, `cursor-col-resize`, `onMouseDown` → `onMouseMove` tracks X position → updates clip percentage
  - Labels: "Original" left, "Processado" right
- Return focus to previous element on close

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run src/components/history/HistoryLightbox.test.tsx`
Expected: PASS (6 tests)

---

## Task 14: HistoryPage — Main Container

**Files:**
- Create: `apps/web/src/components/history/HistoryPage.tsx`
- Create: `apps/web/src/components/history/HistoryPage.test.tsx`

### Step 1: Write the failing test

```tsx
// apps/web/src/components/history/HistoryPage.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HistoryPage } from "./HistoryPage";
import { createQueryWrapper } from "@/test/query-wrapper";

vi.mock("@/lib/api", () => ({
  fetchHistory: vi.fn().mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    perPage: 24,
    hasMore: false,
  }),
  deleteHistoryItem: vi.fn(),
}));

describe("HistoryPage", () => {
  it("renders filter bar and grid", async () => {
    render(<HistoryPage />, { wrapper: createQueryWrapper() });
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument();
    });
  });

  it("shows first-use empty state when no items", async () => {
    render(<HistoryPage />, { wrapper: createQueryWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Nenhuma imagem no histórico")).toBeInTheDocument();
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd apps/web && bunx vitest run src/components/history/HistoryPage.test.tsx`
Expected: FAIL

### Step 3: Write minimal implementation

```tsx
// apps/web/src/components/history/HistoryPage.tsx
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchHistory, deleteHistoryItem, type HistoryItem } from "@/lib/api";
import { useHistoryFilters } from "@/hooks/useHistoryFilters";
import { useHistoryStore } from "@/stores/history-store";
import { HistoryFilterBar } from "./HistoryFilterBar";
import { HistoryGrid } from "./HistoryGrid";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import { HistoryLightbox } from "./HistoryLightbox";
import { HistoryEmptyState } from "./HistoryEmptyState";

const HISTORY_KEY = ["history"] as const;

export function HistoryPage() {
  const { filters, apiParams, setFilter, toggleCategory, setDateRange, clearAll, activeFilterCount } = useHistoryFilters();
  const { selectedItemId, panelOpen, lightboxOpen, lightboxMode, selectItem, closePanel, openLightbox, closeLightbox } = useHistoryStore();
  const queryClient = useQueryClient();

  const {
    data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [...HISTORY_KEY, apiParams],
    queryFn: ({ pageParam = 1 }) => fetchHistory({ ...apiParams, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: string }) => deleteHistoryItem(id, mode),
    onSettled: () => queryClient.invalidateQueries({ queryKey: HISTORY_KEY }),
  });

  // Flatten all pages into single items array
  const allItems = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  // Find selected item
  const selectedItem = allItems.find((i) => i.id === selectedItemId) ?? null;

  // Navigation helpers for lightbox
  const selectedIndex = selectedItem ? allItems.indexOf(selectedItem) : -1;

  // Skeleton loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 rounded-lg bg-surface-container-low animate-pulse" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-surface-container-low animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return <HistoryEmptyState variant="error" errorMessage={error.message} onRetry={() => queryClient.refetchQueries({ queryKey: HISTORY_KEY })} />;
  }

  return (
    <div className="space-y-4">
      <HistoryFilterBar
        filters={filters}
        activeFilterCount={activeFilterCount}
        setFilter={setFilter}
        toggleCategory={toggleCategory}
        setDateRange={setDateRange}
        clearAll={clearAll}
      />

      <div className="flex gap-4">
        {/* Grid area */}
        <div className={panelOpen ? "flex-1 min-w-0" : "w-full"}>
          {allItems.length === 0 ? (
            <HistoryEmptyState
              variant={activeFilterCount > 0 ? "no-results" : "first-use"}
              onClearFilters={activeFilterCount > 0 ? clearAll : undefined}
            />
          ) : (
            <HistoryGrid
              items={allItems}
              total={total}
              hasMore={!!hasNextPage}
              selectedItemId={selectedItemId}
              onSelectItem={selectItem}
              onLoadMore={fetchNextPage}
              isLoadingMore={isFetchingNextPage}
            />
          )}
        </div>

        {/* Detail panel */}
        {panelOpen && selectedItem && (
          <div className="w-[400px] shrink-0">
            <HistoryDetailPanel
              item={selectedItem}
              onClose={closePanel}
              onOpenLightbox={openLightbox}
              onDelete={() => deleteMutation.mutate({ id: selectedItem.id, mode: selectedItem.mode })}
              onRegenerate={() => {
                // Navigate to generate page with pre-filled prompt
                // Implementation depends on app routing
              }}
            />
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && selectedItem && (
        <HistoryLightbox
          imageUrl={selectedItem.downloadUrl}
          alt={selectedItem.imageTypeName || "Image"}
          mode={lightboxMode}
          originalImageUrl={selectedItem.mode === "upload" ? `/api/v1/images/${selectedItem.id}/download?version=original` : undefined}
          onClose={closeLightbox}
          onPrev={() => selectedIndex > 0 && selectItem(allItems[selectedIndex - 1]!.id)}
          onNext={() => selectedIndex < allItems.length - 1 && selectItem(allItems[selectedIndex + 1]!.id)}
          currentIndex={selectedIndex}
          totalItems={allItems.length}
        />
      )}
    </div>
  );
}
```

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run src/components/history/HistoryPage.test.tsx`
Expected: PASS (2 tests)

---

## Task 15: Wire into App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`

### Step 1: Replace ProcessingHistory import and rendering

```ts
// apps/web/src/App.tsx

// Replace import (around line 13):
// OLD: import { ProcessingHistory } from "@/components/ProcessingHistory";
// NEW:
import { HistoryPage } from "@/components/history/HistoryPage";

// Replace rendering (around lines 284-290 and 318):
// OLD:
// {activePage === "history" && (
//   <AuthGuard>
//     <div className="mx-auto max-w-6xl">
//       <ProcessingHistory />
//     </div>
//   </AuthGuard>
// )}
// NEW:
// {activePage === "history" && (
//   <AuthGuard>
//     <div className="mx-auto max-w-7xl">
//       <HistoryPage />
//     </div>
//   </AuthGuard>
// )}
```

**Key changes:**
- Import `HistoryPage` instead of `ProcessingHistory`
- Widen max width from `max-w-6xl` to `max-w-7xl` to accommodate the side panel
- Apply to both render locations (lines ~287 and ~318)

### Step 2: Run all frontend tests

Run: `cd apps/web && bunx vitest run`
Expected: All PASS

### Step 3: Manual verification

1. Start backend: `cd apps/api && bun run dev`
2. Start frontend: `cd apps/web && bun run dev`
3. Open `http://localhost:5173`, click "Histórico" tab
4. Verify: filter bar renders, empty state shows if no history
5. Generate an image via "Gerar Imagem", go back to Histórico
6. Verify: image appears in grid with correct metadata
7. Click a card → detail panel opens on right
8. Click image in panel → lightbox opens
9. Test filters: mode, category, date presets, search
10. Test "Carregar Mais" button
11. Test delete action
12. Check responsive: resize browser below 1024px

---

## Task 16: Responsive Panel Behavior

**Files:**
- Modify: `apps/web/src/components/history/HistoryPage.tsx`
- Modify: `apps/web/src/components/history/HistoryDetailPanel.tsx`

### Step 1: Add responsive breakpoint hook

```ts
// Add to HistoryPage.tsx
import { useState, useEffect } from "react";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}
```

### Step 2: Adapt panel rendering

```tsx
// In HistoryPage.tsx
const isDesktop = useMediaQuery("(min-width: 1024px)");

// For the panel:
{panelOpen && selectedItem && (
  isDesktop ? (
    // Desktop: side panel
    <div className="w-[400px] shrink-0">
      <HistoryDetailPanel ... />
    </div>
  ) : (
    // Mobile: full-screen overlay with backdrop
    <div className="fixed inset-0 z-50 bg-black/50">
      <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-surface animate-slide-up">
        <HistoryDetailPanel ... />
      </div>
    </div>
  )
)}
```

### Step 3: Adjust grid columns when panel open

```tsx
// Grid columns adapt:
<div className={cn(
  "grid gap-3",
  panelOpen && isDesktop
    ? "grid-cols-2 md:grid-cols-3"     // fewer cols with panel
    : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"  // full width
)}>
```

### Step 4: Run tests

Run: `cd apps/web && bunx vitest run`
Expected: All PASS

---

## Final Verification

### Run all tests

```bash
# Backend
cd apps/api && bun test

# Frontend
cd apps/web && bunx vitest run
```

### Manual testing checklist

- [ ] Histórico tab shows unified history (generations + uploads)
- [ ] Filter by mode (Geração / Upload / Todos) works
- [ ] Filter by category (multi-select) works
- [ ] Filter by model and quality works (disabled when mode=upload)
- [ ] Filter by status (Sucesso / Erro) works
- [ ] Date presets (Hoje / Esta Semana / Este Mês / Todos) work
- [ ] Custom date range works and clears preset
- [ ] Search by prompt/filename works (debounced)
- [ ] Active filter chips appear and are dismissible
- [ ] "Limpar Todos" resets all filters
- [ ] Cards show correct thumbnails, badges, metadata
- [ ] Date group headers are sticky and show relative dates
- [ ] "Carregar Mais" loads next page
- [ ] Clicking a card opens detail panel on right
- [ ] Panel shows correct metadata adapted per mode
- [ ] Clicking preview image opens lightbox
- [ ] Lightbox keyboard navigation works (Escape, arrows)
- [ ] Compare mode shows slider for uploads
- [ ] Delete action works and refreshes grid
- [ ] Re-generate pre-fills prompt and navigates to generate page
- [ ] Download button works with format selector
- [ ] Responsive: panel becomes bottom sheet on mobile
- [ ] Grid adjusts columns when panel is open/closed

---

## File Index

### New files (create)

| File | Purpose |
|---|---|
| `apps/api/src/services/history-query.ts` | Date range logic, types |
| `apps/api/src/services/history-query.test.ts` | Date range tests |
| `apps/api/src/routes/history.ts` | Unified history + thumbnail + delete routes |
| `apps/api/src/routes/history.test.ts` | Route integration tests |
| `apps/web/src/lib/api-history.test.ts` | API client tests |
| `apps/web/src/hooks/useHistoryFilters.ts` | URL-synced filter state hook |
| `apps/web/src/hooks/useHistoryFilters.test.ts` | Filter hook tests |
| `apps/web/src/stores/history-store.ts` | UI state (panel, lightbox) |
| `apps/web/src/stores/history-store.test.ts` | Store tests |
| `apps/web/src/components/history/HistoryEmptyState.tsx` | Empty state variants |
| `apps/web/src/components/history/HistoryEmptyState.test.tsx` | Empty state tests |
| `apps/web/src/components/history/HistoryCard.tsx` | Grid card component |
| `apps/web/src/components/history/HistoryCard.test.tsx` | Card tests |
| `apps/web/src/components/history/HistoryGrid.tsx` | Date-grouped grid + Load More |
| `apps/web/src/components/history/HistoryGrid.test.tsx` | Grid tests |
| `apps/web/src/components/history/HistoryFilterBar.tsx` | All filter controls |
| `apps/web/src/components/history/HistoryFilterBar.test.tsx` | Filter bar tests |
| `apps/web/src/components/history/HistoryDetailPanel.tsx` | Right detail drawer |
| `apps/web/src/components/history/HistoryDetailPanel.test.tsx` | Panel tests |
| `apps/web/src/components/history/HistoryLightbox.tsx` | Full-screen view + compare |
| `apps/web/src/components/history/HistoryLightbox.test.tsx` | Lightbox tests |
| `apps/web/src/components/history/HistoryPage.tsx` | Main container (orchestrator) |
| `apps/web/src/components/history/HistoryPage.test.tsx` | Integration tests |

### Modified files

| File | Change |
|---|---|
| `apps/api/src/index.ts` | Register history route |
| `apps/api/src/services/storage.ts` | Add `deleteFromS3` if missing |
| `apps/web/src/lib/api.ts` | Add `fetchHistory`, `deleteHistoryItem`, types |
| `apps/web/src/App.tsx` | Replace `ProcessingHistory` with `HistoryPage` |
