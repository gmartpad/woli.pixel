# Format Download Options for Generated Images — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users choose between JPEG, PNG, and WebP when downloading generated images.

**Architecture:** Add `?format=` query param to the backend download endpoint with on-the-fly Sharp conversion (pattern from upload flow). Add a `FormatSelector` component to the frontend, used inside `GeneratePanel`.

**Tech Stack:** Bun + Hono + Sharp (backend), React 19 + Vitest + RTL (frontend)

---

### Task 1: Backend — Add format conversion to generate download endpoint

**Files:**
- Modify: `apps/api/src/routes/generate.ts:212-243`
- Test: `apps/api/src/routes/generate.test.ts` (create)

**Step 1: Write the failing test**

Create `apps/api/src/routes/generate.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import app from "../index";
import { db } from "../db";
import { generationJobs } from "../db/schema";
import { eq } from "drizzle-orm";

// Create a real test image on disk for the download endpoint
const TEST_JOB_ID = "test-download-format";
const TEST_IMAGE_PATH = "/tmp/test-generated-download.png";

beforeAll(async () => {
  // Create a small PNG test image
  await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 0, b: 0 } } })
    .png()
    .toFile(TEST_IMAGE_PATH);

  // Insert a fake generation job pointing to the test image
  await db.insert(generationJobs).values({
    id: TEST_JOB_ID,
    imageTypeId: "00000000-0000-0000-0000-000000000001",
    prompt: "test",
    enhancedPrompt: "test",
    qualityTier: "low",
    model: "flux2_pro",
    status: "completed",
    processedPath: TEST_IMAGE_PATH,
    processedFormat: "png",
    processedWidth: 64,
    processedHeight: 64,
    processedSizeKb: 1,
    costUsd: "0.03",
  });
});

afterAll(async () => {
  await db.delete(generationJobs).where(eq(generationJobs.id, TEST_JOB_ID));
  await unlink(TEST_IMAGE_PATH).catch(() => {});
});

describe("GET /api/v1/generate/:id/download", () => {
  test("returns original format when no format param", async () => {
    const res = await app.request(`/api/v1/generate/${TEST_JOB_ID}/download`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  test("converts to webp when ?format=webp", async () => {
    const res = await app.request(`/api/v1/generate/${TEST_JOB_ID}/download?format=webp`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Content-Disposition")).toContain(".webp");
  });

  test("converts to jpeg when ?format=jpeg", async () => {
    const res = await app.request(`/api/v1/generate/${TEST_JOB_ID}/download?format=jpeg`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Content-Disposition")).toContain(".jpg");
  });

  test("normalizes jpg to jpeg", async () => {
    const res = await app.request(`/api/v1/generate/${TEST_JOB_ID}/download?format=jpg`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  test("returns original when same format requested", async () => {
    const res = await app.request(`/api/v1/generate/${TEST_JOB_ID}/download?format=png`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  test("returns 404 for nonexistent job", async () => {
    const res = await app.request("/api/v1/generate/nonexistent/download");
    expect(res.status).toBe(404);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test src/routes/generate.test.ts`
Expected: FAIL — "converts to webp" returns `image/png` instead of `image/webp`

**Step 3: Write minimal implementation**

In `apps/api/src/routes/generate.ts`, replace lines 212-243 with:

```ts
// GET /:id/download — Download generated image
generateRouter.get("/:id/download", async (c) => {
  const id = c.req.param("id");
  const [job] = await db.select().from(generationJobs).where(eq(generationJobs.id, id));

  if (!job || !job.processedPath) {
    return c.json({ error: "Imagem gerada não encontrada" }, 404);
  }

  const file = Bun.file(job.processedPath);
  if (!(await file.exists())) {
    return c.json({ error: "Arquivo não encontrado no disco" }, 404);
  }

  const mimeMap: Record<string, string> = {
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };

  const storedFormat = job.processedFormat || "png";

  // Normalize requested format: jpg -> jpeg
  let requestedFormat = c.req.query("format")?.toLowerCase() || null;
  if (requestedFormat === "jpg") requestedFormat = "jpeg";

  let finalBuffer: ArrayBuffer | Buffer = await file.arrayBuffer();

  // Convert on-the-fly if requested format differs from stored
  if (requestedFormat && requestedFormat !== storedFormat) {
    const converted = sharp(Buffer.from(finalBuffer));
    if (requestedFormat === "png") converted.png();
    else if (requestedFormat === "jpeg") converted.jpeg({ quality: 85, mozjpeg: true });
    else if (requestedFormat === "webp") converted.webp({ quality: 85 });
    finalBuffer = await converted.toBuffer();
  }

  const outputFormat = requestedFormat || storedFormat;
  const contentType = mimeMap[outputFormat] || "application/octet-stream";
  const ext = outputFormat === "jpeg" ? "jpg" : outputFormat;

  return new Response(finalBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="generated-${job.id.slice(0, 8)}.${ext}"`,
    },
  });
});
```

Add `import sharp from "sharp";` at the top of the file if not already imported.

**Step 4: Run test to verify it passes**

Run: `cd apps/api && bun test src/routes/generate.test.ts`
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add apps/api/src/routes/generate.ts apps/api/src/routes/generate.test.ts
git commit -m "feat: add format conversion to generate download endpoint"
```

---

### Task 2: Frontend — Create FormatSelector component with tests

**Files:**
- Create: `apps/web/src/components/FormatSelector.tsx`
- Create: `apps/web/src/components/FormatSelector.test.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/components/FormatSelector.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FormatSelector } from "./FormatSelector";

describe("FormatSelector", () => {
  it("renders JPEG, PNG, WebP buttons", () => {
    render(<FormatSelector selected="jpeg" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "JPEG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PNG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WebP" })).toBeInTheDocument();
  });

  it("highlights the selected format", () => {
    render(<FormatSelector selected="png" onChange={vi.fn()} />);
    const pngButton = screen.getByRole("button", { name: "PNG" });
    expect(pngButton.className).toContain("bg-primary");
  });

  it("does not highlight unselected formats", () => {
    render(<FormatSelector selected="png" onChange={vi.fn()} />);
    const jpegButton = screen.getByRole("button", { name: "JPEG" });
    expect(jpegButton.className).not.toContain("bg-primary");
  });

  it("calls onChange with format value when clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FormatSelector selected="jpeg" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "WebP" }));
    expect(onChange).toHaveBeenCalledWith("webp");
  });

  it("calls onChange with jpeg when JPEG clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FormatSelector selected="png" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "JPEG" }));
    expect(onChange).toHaveBeenCalledWith("jpeg");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && bunx vitest run src/components/FormatSelector.test.tsx`
Expected: FAIL — module `./FormatSelector` not found

**Step 3: Write minimal implementation**

Create `apps/web/src/components/FormatSelector.tsx`:

```tsx
import { cn } from "@/lib/utils";

const FORMATS = [
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
] as const;

type FormatValue = (typeof FORMATS)[number]["value"];

interface FormatSelectorProps {
  selected: string;
  onChange: (format: FormatValue) => void;
}

export function FormatSelector({ selected, onChange }: FormatSelectorProps) {
  // Normalize jpeg/jpg for comparison
  const normalizedSelected = selected === "jpg" ? "jpeg" : selected;

  return (
    <div className="flex gap-1 rounded-lg bg-surface-container-low p-1" role="group" aria-label="Formato de download">
      {FORMATS.map((fmt) => (
        <button
          key={fmt.value}
          onClick={() => onChange(fmt.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
            normalizedSelected === fmt.value
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
          )}
        >
          {fmt.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && bunx vitest run src/components/FormatSelector.test.tsx`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/FormatSelector.tsx apps/web/src/components/FormatSelector.test.tsx
git commit -m "feat: create FormatSelector segmented control component"
```

---

### Task 3: Frontend — Integrate FormatSelector into GeneratePanel

**Files:**
- Modify: `apps/web/src/components/GeneratePanel.tsx:345-360`

**Step 1: Write the failing test**

No separate test file needed — this is integration-level wiring. The component test for `FormatSelector` covers the selector behavior. For `GeneratePanel`, add a smoke assertion.

This task is pure wiring with no new logic, so skip the dedicated RED step and wire directly.

**Step 2: Apply changes to GeneratePanel.tsx**

At the top of `GeneratePanel.tsx`, add import:

```ts
import { FormatSelector } from "./FormatSelector";
```

Inside the component function, after `const [step, setStep] = ...` (or alongside existing state), add:

```ts
const [downloadFormat, setDownloadFormat] = useState(
  result?.image?.format?.toLowerCase() === "jpeg" ? "jpeg"
    : result?.image?.format?.toLowerCase() || "jpeg"
);
```

Also add a `useEffect` to sync `downloadFormat` when `result` changes:

```ts
useEffect(() => {
  if (result?.image?.format) {
    const fmt = result.image.format.toLowerCase();
    setDownloadFormat(fmt === "jpg" ? "jpeg" : fmt);
  }
}, [result]);
```

Replace the download+reset button section (lines 346-360) with:

```tsx
{/* Format + Download */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <span className="text-xs text-on-surface-variant">Formato de download</span>
    <FormatSelector selected={downloadFormat} onChange={setDownloadFormat} />
  </div>
  <div className="flex gap-3">
    <a
      href={`${import.meta.env.VITE_API_URL || "/api/v1"}${result.image.download_url.replace("/api/v1", "")}?format=${downloadFormat}`}
      download
      className="flex-1 rounded-xl bg-gradient-to-br from-primary to-[#3b82f6] py-2.5 text-center font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(133,173,255,0.3)]"
    >
      Download
    </a>
    <button
      onClick={reset}
      className="rounded-xl border border-outline-variant/20 px-6 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
    >
      Nova Geração
    </button>
  </div>
</div>
```

**Step 3: Verify all frontend tests still pass**

Run: `cd apps/web && bunx vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add apps/web/src/components/GeneratePanel.tsx
git commit -m "feat: integrate format selector into generation download flow"
```

---

### Task 4: Verify end-to-end

**Step 1:** Run all backend tests: `cd apps/api && bun test`
**Step 2:** Run all frontend tests: `cd apps/web && bunx vitest run`
**Step 3:** Manual: generate a `capa_workspace` image, toggle formats, download each — confirm JPEG/PNG/WebP all produce valid files.
