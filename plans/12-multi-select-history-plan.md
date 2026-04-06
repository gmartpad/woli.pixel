# Multi-Select History Grid — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to select multiple history items and execute batch delete or batch download (ZIP) from a selection toolbar.

**Architecture:** Selection state lives in `history-store.ts` (Zustand). Two new backend endpoints (`DELETE /history/bulk`, `POST /history/download`) follow existing patterns. A new `SelectionToolbar` replaces the filter bar during selection mode. `HistoryCard` gains a checkbox overlay in selection mode.

**Tech Stack:** Zustand 5, React 19, Hono, Drizzle ORM, archiver (ZIP streaming), Vitest + RTL, bun:test

**Design doc:** `plans/12-multi-select-history-design.md`

---

### Task 1: History Store — Selection State (TDD)

**Files:**
- Modify: `apps/web/src/stores/history-store.ts`
- Create: `apps/web/src/stores/history-store.test.ts`

**Step 1: Write the failing tests**

```ts
// apps/web/src/stores/history-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useHistoryStore } from "./history-store";

describe("history-store selection", () => {
  beforeEach(() => {
    useHistoryStore.setState({
      selectedItemId: null,
      panelOpen: false,
      lightboxOpen: false,
      lightboxMode: "single",
      selectionMode: false,
      selectedIds: new Set(),
    });
  });

  it("enterSelectionMode activates selection mode", () => {
    useHistoryStore.getState().enterSelectionMode();
    expect(useHistoryStore.getState().selectionMode).toBe(true);
  });

  it("enterSelectionMode with firstId pre-selects that item", () => {
    useHistoryStore.getState().enterSelectionMode("item-1");
    expect(useHistoryStore.getState().selectionMode).toBe(true);
    expect(useHistoryStore.getState().selectedIds.has("item-1")).toBe(true);
  });

  it("enterSelectionMode closes the detail panel", () => {
    useHistoryStore.setState({ selectedItemId: "x", panelOpen: true });
    useHistoryStore.getState().enterSelectionMode();
    expect(useHistoryStore.getState().panelOpen).toBe(false);
    expect(useHistoryStore.getState().selectedItemId).toBeNull();
  });

  it("exitSelectionMode clears selection and deactivates", () => {
    useHistoryStore.setState({ selectionMode: true, selectedIds: new Set(["a", "b"]) });
    useHistoryStore.getState().exitSelectionMode();
    expect(useHistoryStore.getState().selectionMode).toBe(false);
    expect(useHistoryStore.getState().selectedIds.size).toBe(0);
  });

  it("toggleItem adds and removes items", () => {
    useHistoryStore.setState({ selectionMode: true, selectedIds: new Set() });
    useHistoryStore.getState().toggleItem("item-1");
    expect(useHistoryStore.getState().selectedIds.has("item-1")).toBe(true);
    useHistoryStore.getState().toggleItem("item-1");
    expect(useHistoryStore.getState().selectedIds.has("item-1")).toBe(false);
  });

  it("toggleItem auto-exits selection mode when last item is deselected", () => {
    useHistoryStore.setState({ selectionMode: true, selectedIds: new Set(["item-1"]) });
    useHistoryStore.getState().toggleItem("item-1");
    expect(useHistoryStore.getState().selectionMode).toBe(false);
  });

  it("selectAll sets all provided ids", () => {
    useHistoryStore.setState({ selectionMode: true, selectedIds: new Set() });
    useHistoryStore.getState().selectAll(["a", "b", "c"]);
    expect(useHistoryStore.getState().selectedIds).toEqual(new Set(["a", "b", "c"]));
  });

  it("selectItem closes selection mode and opens panel", () => {
    useHistoryStore.setState({ selectionMode: true, selectedIds: new Set(["a"]) });
    useHistoryStore.getState().selectItem("x");
    expect(useHistoryStore.getState().selectionMode).toBe(false);
    expect(useHistoryStore.getState().selectedIds.size).toBe(0);
    expect(useHistoryStore.getState().panelOpen).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd apps/web && bunx vitest run src/stores/history-store.test.ts
```
Expected: FAIL — `selectionMode`, `selectedIds`, etc. not in store

**Step 3: Implement selection state in store**

```ts
// apps/web/src/stores/history-store.ts
import { create } from "zustand";

export type LightboxMode = "single" | "compare";

type HistoryUIState = {
  selectedItemId: string | null;
  panelOpen: boolean;
  lightboxOpen: boolean;
  lightboxMode: LightboxMode;
  selectionMode: boolean;
  selectedIds: Set<string>;
  selectItem: (id: string) => void;
  closePanel: () => void;
  openLightbox: (mode: LightboxMode) => void;
  closeLightbox: () => void;
  enterSelectionMode: (firstId?: string) => void;
  exitSelectionMode: () => void;
  toggleItem: (id: string) => void;
  selectAll: (ids: string[]) => void;
};

export const useHistoryStore = create<HistoryUIState>((set) => ({
  selectedItemId: null,
  panelOpen: false,
  lightboxOpen: false,
  lightboxMode: "single",
  selectionMode: false,
  selectedIds: new Set(),
  selectItem: (id) =>
    set({ selectedItemId: id, panelOpen: true, selectionMode: false, selectedIds: new Set() }),
  closePanel: () => set({ selectedItemId: null, panelOpen: false }),
  openLightbox: (mode) => set({ lightboxOpen: true, lightboxMode: mode }),
  closeLightbox: () => set({ lightboxOpen: false }),
  enterSelectionMode: (firstId) =>
    set({
      selectionMode: true,
      selectedIds: firstId ? new Set([firstId]) : new Set(),
      selectedItemId: null,
      panelOpen: false,
    }),
  exitSelectionMode: () =>
    set({ selectionMode: false, selectedIds: new Set() }),
  toggleItem: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) return { selectedIds: next, selectionMode: false };
      return { selectedIds: next };
    }),
  selectAll: (ids) =>
    set({ selectedIds: new Set(ids) }),
}));
```

**Step 4: Run tests to verify they pass**

```bash
cd apps/web && bunx vitest run src/stores/history-store.test.ts
```
Expected: PASS (all 8 tests)

---

### Task 2: Backend — Bulk Delete Endpoint (TDD)

**Files:**
- Modify: `apps/api/src/routes/history.ts`

**Context:** Follow the existing `DELETE /profile/avatar/bulk` pattern. The single delete handler is at line ~369 in history.ts. Add the bulk handler before it.

**Step 1: Write the failing test**

Add to the existing history route test file (or create one). Use `app.request()` pattern from CLAUDE.md:

```ts
// In the history route test file
describe("DELETE /api/v1/history/bulk", () => {
  test("returns 400 when items array is empty", async () => {
    const res = await app.request("/api/v1/history/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 400 when items have invalid mode", async () => {
    const res = await app.request("/api/v1/history/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: "x", mode: "invalid" }] }),
    });
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/api && bun test src/routes/history.test.ts
```

**Step 3: Implement bulk delete handler**

Add this handler in `apps/api/src/routes/history.ts` BEFORE the single `/:id` DELETE route:

```ts
// Bulk delete
historyRouter.delete("/bulk", async (c) => {
  const body = await c.req.json<{ items: { id: string; mode: string }[] }>();

  if (!body.items || body.items.length === 0) {
    return c.json({ error: "Nenhum item selecionado" }, 400);
  }

  // Validate all modes
  const validModes = ["generation", "upload"] as const;
  for (const item of body.items) {
    if (!validModes.includes(item.mode as typeof validModes[number])) {
      return c.json({ error: `mode inválido: ${item.mode}` }, 400);
    }
  }

  const generationIds = body.items.filter((i) => i.mode === "generation").map((i) => i.id);
  const uploadIds = body.items.filter((i) => i.mode === "upload").map((i) => i.id);

  // Delete generations
  if (generationIds.length > 0) {
    const rows = await db
      .select({ id: generationJobs.id, processedS3Key: generationJobs.processedS3Key })
      .from(generationJobs)
      .where(inArray(generationJobs.id, generationIds));

    const s3Keys = rows.map((r) => r.processedS3Key).filter(Boolean) as string[];
    await Promise.all(s3Keys.map((key) => deleteFromS3(key)));
    await db.delete(generationJobs).where(inArray(generationJobs.id, generationIds));
  }

  // Delete uploads
  if (uploadIds.length > 0) {
    const rows = await db
      .select({
        id: imageUploads.id,
        originalS3Key: imageUploads.originalS3Key,
        processedS3Key: imageUploads.processedS3Key,
      })
      .from(imageUploads)
      .where(inArray(imageUploads.id, uploadIds));

    const s3Keys = rows.flatMap((r) => [r.originalS3Key, r.processedS3Key]).filter(Boolean) as string[];
    await Promise.all(s3Keys.map((key) => deleteFromS3(key)));
    await db.delete(imageUploads).where(inArray(imageUploads.id, uploadIds));
  }

  return new Response(null, { status: 204 });
});
```

**Important:** Ensure `inArray` is imported from `drizzle-orm`. Check existing imports at the top of the file.

**Step 4: Run tests to verify they pass**

```bash
cd apps/api && bun test src/routes/history.test.ts
```

---

### Task 3: Backend — Bulk Download (ZIP) Endpoint

**Files:**
- Modify: `apps/api/src/routes/history.ts`
- Modify: `apps/api/package.json` (add `archiver` dependency)

**Step 1: Install archiver**

```bash
cd apps/api && bun add archiver && bun add -D @types/archiver
```

**Step 2: Write the failing test**

```ts
describe("POST /api/v1/history/download", () => {
  test("returns 400 when ids array is empty", async () => {
    const res = await app.request("/api/v1/history/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });
    expect(res.status).toBe(400);
  });
});
```

**Step 3: Implement bulk download handler**

```ts
import archiver from "archiver";
import { Readable } from "node:stream";

historyRouter.post("/download", async (c) => {
  const body = await c.req.json<{ ids: string[] }>();

  if (!body.ids || body.ids.length === 0) {
    return c.json({ error: "Nenhum item selecionado" }, 400);
  }

  // Gather S3 keys from both tables
  const generationRows = await db
    .select({
      id: generationJobs.id,
      processedS3Key: generationJobs.processedS3Key,
      processedFormat: generationJobs.processedFormat,
    })
    .from(generationJobs)
    .where(inArray(generationJobs.id, body.ids));

  const uploadRows = await db
    .select({
      id: imageUploads.id,
      processedS3Key: imageUploads.processedS3Key,
      processedFormat: imageUploads.processedFormat,
      originalFilename: imageUploads.originalFilename,
    })
    .from(imageUploads)
    .where(inArray(imageUploads.id, body.ids));

  const files: { key: string; name: string }[] = [];

  for (const row of generationRows) {
    if (row.processedS3Key) {
      const ext = row.processedFormat || "png";
      files.push({ key: row.processedS3Key, name: `${row.id}.${ext}` });
    }
  }

  for (const row of uploadRows) {
    if (row.processedS3Key) {
      const name = row.originalFilename || `${row.id}.${row.processedFormat || "png"}`;
      files.push({ key: row.processedS3Key, name });
    }
  }

  if (files.length === 0) {
    return c.json({ error: "Nenhum arquivo encontrado" }, 404);
  }

  // Create ZIP archive stream
  const archive = archiver("zip", { zlib: { level: 5 } });

  for (const file of files) {
    const s3Stream = await getObjectStream(file.key); // Use existing S3 helper or GetObjectCommand
    archive.append(s3Stream, { name: file.name });
  }

  archive.finalize();

  // Convert Node stream to Web ReadableStream
  const webStream = Readable.toWeb(archive) as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="woli-pixel-images.zip"',
    },
  });
});
```

**Note:** You may need to create a `getObjectStream` helper using `GetObjectCommand` from `@aws-sdk/client-s3`. Check if one already exists in the S3 service file. If not, add:

```ts
import { GetObjectCommand } from "@aws-sdk/client-s3";

async function getObjectStream(key: string): Promise<Readable> {
  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  const response = await s3Client.send(command);
  return response.Body as Readable;
}
```

**Step 4: Run tests to verify they pass**

```bash
cd apps/api && bun test src/routes/history.test.ts
```

---

### Task 4: Frontend API Client — Bulk Functions

**Files:**
- Modify: `apps/web/src/lib/api.ts` (append after line 661)

**Step 1: Add the two new API functions**

```ts
// apps/web/src/lib/api.ts — append after deleteHistoryItem

export async function bulkDeleteHistory(
  items: { id: string; mode: string }[],
): Promise<void> {
  const res = await apiFetch(`${API_URL}/history/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error("Erro ao excluir itens");
}

export async function bulkDownloadHistory(ids: string[]): Promise<Blob> {
  const res = await apiFetch(`${API_URL}/history/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Erro ao baixar imagens");
  return res.blob();
}
```

No tests needed — these are thin wrappers. They'll be tested via integration in the page tests.

---

### Task 5: DeleteConfirmDialog — Plural Support (TDD)

**Files:**
- Modify: `apps/web/src/components/history/DeleteConfirmDialog.tsx`
- Modify: `apps/web/src/components/history/DeleteConfirmDialog.test.tsx`

**Step 1: Write the failing test**

Add to the existing test file:

```tsx
it("shows plural message when itemCount is provided and > 1", () => {
  render(
    <DeleteConfirmDialog
      open={true}
      itemName=""
      itemCount={5}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      isDeleting={false}
    />,
  );

  expect(screen.getByText(/5 imagens/)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/web && bunx vitest run src/components/history/DeleteConfirmDialog.test.tsx
```

**Step 3: Implement plural support**

Change the Props type and message rendering:

```tsx
type Props = {
  open: boolean;
  itemName: string;
  itemCount?: number;  // NEW — when > 1, shows plural message
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
};
```

Change the message `<p>` to:

```tsx
<p className="text-sm text-on-surface">
  {itemCount && itemCount > 1 ? (
    <>
      Tem certeza que deseja excluir{" "}
      <strong className="font-semibold">{itemCount} imagens</strong>?
    </>
  ) : (
    <>
      Tem certeza que deseja excluir{" "}
      <strong className="font-semibold">{itemName}</strong>?
    </>
  )}
</p>
```

**Step 4: Run tests to verify all pass**

```bash
cd apps/web && bunx vitest run src/components/history/DeleteConfirmDialog.test.tsx
```
Expected: 6 tests pass (5 existing + 1 new)

---

### Task 6: SelectionToolbar — New Component (TDD)

**Files:**
- Create: `apps/web/src/components/history/SelectionToolbar.tsx`
- Create: `apps/web/src/components/history/SelectionToolbar.test.tsx`

**Step 1: Write the failing tests**

```tsx
// apps/web/src/components/history/SelectionToolbar.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SelectionToolbar } from "./SelectionToolbar";

describe("SelectionToolbar", () => {
  const defaultProps = {
    selectedCount: 3,
    totalCount: 10,
    onCancel: vi.fn(),
    onSelectAll: vi.fn(),
    onDelete: vi.fn(),
    onDownload: vi.fn(),
    isDeleting: false,
    isDownloading: false,
  };

  it("shows selected count", () => {
    render(<SelectionToolbar {...defaultProps} />);
    expect(screen.getByText(/3 selecionados/)).toBeInTheDocument();
  });

  it("calls onCancel when close button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<SelectionToolbar {...defaultProps} onCancel={onCancel} />);
    await user.click(screen.getByLabelText("Sair da seleção"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onSelectAll when select all button is clicked", async () => {
    const user = userEvent.setup();
    const onSelectAll = vi.fn();
    render(<SelectionToolbar {...defaultProps} onSelectAll={onSelectAll} />);
    await user.click(screen.getByText("Selecionar todos"));
    expect(onSelectAll).toHaveBeenCalledOnce();
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<SelectionToolbar {...defaultProps} onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: /excluir/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("calls onDownload when download button is clicked", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(<SelectionToolbar {...defaultProps} onDownload={onDownload} />);
    await user.click(screen.getByRole("button", { name: /baixar/i }));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("shows loading state when isDeleting is true", () => {
    render(<SelectionToolbar {...defaultProps} isDeleting={true} />);
    expect(screen.getByRole("button", { name: /excluindo/i })).toBeDisabled();
  });

  it("shows loading state when isDownloading is true", () => {
    render(<SelectionToolbar {...defaultProps} isDownloading={true} />);
    expect(screen.getByRole("button", { name: /baixando/i })).toBeDisabled();
  });

  it('shows "Desmarcar todos" when all are selected', () => {
    render(<SelectionToolbar {...defaultProps} selectedCount={10} totalCount={10} />);
    expect(screen.getByText("Desmarcar todos")).toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd apps/web && bunx vitest run src/components/history/SelectionToolbar.test.tsx
```

**Step 3: Implement SelectionToolbar**

```tsx
// apps/web/src/components/history/SelectionToolbar.tsx
type Props = {
  selectedCount: number;
  totalCount: number;
  onCancel: () => void;
  onSelectAll: () => void;
  onDelete: () => void;
  onDownload: () => void;
  isDeleting: boolean;
  isDownloading: boolean;
};

export function SelectionToolbar({
  selectedCount,
  totalCount,
  onCancel,
  onSelectAll,
  onDelete,
  onDownload,
  isDeleting,
  isDownloading,
}: Props) {
  const allSelected = selectedCount === totalCount;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
      {/* Close button */}
      <button
        type="button"
        onClick={onCancel}
        aria-label="Sair da seleção"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high"
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Count */}
      <span className="text-sm font-medium text-on-surface">
        {selectedCount} selecionados
      </span>

      {/* Select all / Deselect all */}
      <button
        type="button"
        onClick={onSelectAll}
        className="text-sm font-medium text-primary hover:underline"
      >
        {allSelected ? "Desmarcar todos" : "Selecionar todos"}
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Download */}
      <button
        type="button"
        onClick={onDownload}
        disabled={isDownloading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-bright disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isDownloading ? "Baixando..." : "Baixar"}
      </button>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className="inline-flex items-center gap-1.5 rounded-lg bg-error-container/20 px-3 py-2 text-sm font-medium text-error hover:bg-error-container/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isDeleting ? "Excluindo..." : "Excluir"}
      </button>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

```bash
cd apps/web && bunx vitest run src/components/history/SelectionToolbar.test.tsx
```
Expected: 8 tests pass

---

### Task 7: HistoryCard — Selection Mode (TDD)

**Files:**
- Modify: `apps/web/src/components/history/HistoryCard.tsx`
- Modify: `apps/web/src/components/history/HistoryCard.test.tsx`

**Step 1: Write the failing tests**

Add to the existing test file after the action menu tests:

```tsx
// ── Selection mode tests ─────────────────────

it("shows checkbox when selectionMode is true", () => {
  const item = createMockItem();
  render(
    <HistoryCard
      item={item}
      isSelected={false}
      onClick={vi.fn()}
      selectionMode={true}
      isChecked={false}
      onToggle={vi.fn()}
    />,
  );

  expect(screen.getByTestId("selection-checkbox")).toBeInTheDocument();
});

it("checkbox is checked when isChecked is true", () => {
  const item = createMockItem();
  render(
    <HistoryCard
      item={item}
      isSelected={false}
      onClick={vi.fn()}
      selectionMode={true}
      isChecked={true}
      onToggle={vi.fn()}
    />,
  );

  const checkbox = screen.getByTestId("selection-checkbox");
  expect(checkbox.className).toContain("bg-primary");
});

it("click calls onToggle instead of onClick in selection mode", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  const onToggle = vi.fn();
  const item = createMockItem();

  render(
    <HistoryCard
      item={item}
      isSelected={false}
      onClick={onClick}
      selectionMode={true}
      isChecked={false}
      onToggle={onToggle}
    />,
  );

  await user.click(screen.getByRole("button"));
  expect(onToggle).toHaveBeenCalledWith(item.id);
  expect(onClick).not.toHaveBeenCalled();
});

it("hides three-dot menu in selection mode", () => {
  const item = createMockItem();
  render(
    <HistoryCard
      item={item}
      isSelected={false}
      onClick={vi.fn()}
      onDelete={vi.fn()}
      selectionMode={true}
      isChecked={false}
      onToggle={vi.fn()}
    />,
  );

  expect(screen.queryByLabelText("Ações")).not.toBeInTheDocument();
});

it("does not show checkbox when selectionMode is false", () => {
  const item = createMockItem();
  render(
    <HistoryCard item={item} isSelected={false} onClick={vi.fn()} />,
  );

  expect(screen.queryByTestId("selection-checkbox")).not.toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

```bash
cd apps/web && bunx vitest run src/components/history/HistoryCard.test.tsx
```

**Step 3: Implement selection mode in HistoryCard**

Update the Props type:

```ts
type Props = {
  item: HistoryItem;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: (item: HistoryItem) => void;
  selectionMode?: boolean;
  isChecked?: boolean;
  onToggle?: (id: string) => void;
};
```

Update the component signature:

```ts
export function HistoryCard({
  item, isSelected, onClick, onDelete,
  selectionMode = false, isChecked = false, onToggle,
}: Props) {
```

Change the outer `<button>` onClick:

```tsx
onClick={selectionMode && onToggle ? () => onToggle(item.id) : onClick}
```

In the thumbnail area, replace the status badge with a conditional:

```tsx
{/* Status badge OR selection checkbox */}
{selectionMode ? (
  <span
    data-testid="selection-checkbox"
    className={cn(
      "absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
      isChecked
        ? "border-primary bg-primary text-on-primary"
        : "border-on-surface-variant/40 bg-surface/80",
    )}
  >
    {isChecked && (
      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )}
  </span>
) : (
  <span
    data-testid="status-badge"
    className={cn(
      "absolute top-2 left-2 h-2.5 w-2.5 rounded-full",
      item.status === "completed" ? "bg-emerald-400" : "bg-red-400",
    )}
  />
)}
```

Change the three-dot menu condition from `{onDelete && (` to `{onDelete && !selectionMode && (`

Change the card selected style to also apply when `isChecked`:

```tsx
className={cn(
  "group relative flex flex-col rounded-xl border text-left transition-all",
  isSelected || isChecked
    ? "border-2 border-primary shadow-xl shadow-primary/5"
    : "border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high",
)}
```

**Step 4: Run tests to verify all pass**

```bash
cd apps/web && bunx vitest run src/components/history/HistoryCard.test.tsx
```
Expected: 20 tests pass (15 existing + 5 new)

---

### Task 8: HistoryGrid — Selection Props Passthrough

**Files:**
- Modify: `apps/web/src/components/history/HistoryGrid.tsx`

**Step 1: Update Props type**

```ts
type Props = {
  items: HistoryItem[];
  total: number;
  hasMore: boolean;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  onDeleteItem?: (item: HistoryItem) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleItem?: (id: string) => void;
};
```

**Step 2: Destructure new props and pass to HistoryCard**

```tsx
export function HistoryGrid({
  items, total, hasMore, selectedItemId, onSelectItem,
  onLoadMore, isLoadingMore, onDeleteItem,
  selectionMode = false, selectedIds, onToggleItem,
}: Props) {
```

In the card rendering:

```tsx
<HistoryCard
  key={item.id}
  item={item}
  isSelected={item.id === selectedItemId}
  onClick={() => onSelectItem(item.id)}
  onDelete={onDeleteItem}
  selectionMode={selectionMode}
  isChecked={selectedIds?.has(item.id) ?? false}
  onToggle={onToggleItem}
/>
```

**Step 3: Run tests to verify no regressions**

```bash
cd apps/web && bunx vitest run src/components/history/
```

---

### Task 9: HistoryPage — Orchestration

**Files:**
- Modify: `apps/web/src/components/history/HistoryPage.tsx`
- Modify: `apps/web/src/components/history/HistoryPage.test.tsx`

**Step 1: Update imports and store destructuring**

Add to imports:

```tsx
import { bulkDeleteHistory, bulkDownloadHistory } from "@/lib/api";
import { SelectionToolbar } from "./SelectionToolbar";
```

Update the store destructuring to include selection state:

```tsx
const {
  selectedItemId, panelOpen, lightboxOpen, lightboxMode,
  selectItem, closePanel, openLightbox, closeLightbox,
  selectionMode, selectedIds, enterSelectionMode,
  exitSelectionMode, toggleItem, selectAll,
} = useHistoryStore();
```

**Step 2: Add bulk mutations**

```tsx
const bulkDeleteMutation = useMutation({
  mutationFn: (items: { id: string; mode: string }[]) => bulkDeleteHistory(items),
  onSuccess: () => exitSelectionMode(),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["history"] }),
});

const bulkDownloadMutation = useMutation({
  mutationFn: (ids: string[]) => bulkDownloadHistory(ids),
  onSuccess: (blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "woli-pixel-images.zip";
    a.click();
    URL.revokeObjectURL(url);
    exitSelectionMode();
  },
});
```

**Step 3: Add selection handlers**

```tsx
const handleBulkDelete = () => {
  const items = allItems
    .filter((i) => selectedIds.has(i.id))
    .map((i) => ({ id: i.id, mode: i.mode }));
  bulkDeleteMutation.mutate(items);
};

const handleBulkDownload = () => {
  bulkDownloadMutation.mutate([...selectedIds]);
};

const handleSelectAll = () => {
  const allIds = allItems.map((i) => i.id);
  if (selectedIds.size === allItems.length) {
    exitSelectionMode();
  } else {
    selectAll(allIds);
  }
};

const handleLongPress = (item: HistoryItem) => {
  if (!selectionMode) {
    enterSelectionMode(item.id);
  }
};
```

**Step 4: Update JSX — conditional toolbar**

Replace the `<HistoryFilterBar>` section with:

```tsx
{selectionMode ? (
  <SelectionToolbar
    selectedCount={selectedIds.size}
    totalCount={allItems.length}
    onCancel={exitSelectionMode}
    onSelectAll={handleSelectAll}
    onDelete={() => setItemToDelete(null)} // Reuse dialog — see step 5
    onDownload={handleBulkDownload}
    isDeleting={bulkDeleteMutation.isPending}
    isDownloading={bulkDownloadMutation.isPending}
  />
) : (
  <HistoryFilterBar ... />
)}
```

**Note:** For the "Selecionar" button, add it as a small button next to or inside the filter bar. This can be a simple text button added to `HistoryFilterBar` or rendered alongside it:

```tsx
{!selectionMode && allItems.length > 0 && (
  <div className="flex items-center gap-2">
    <HistoryFilterBar ... />
    <button
      type="button"
      onClick={() => enterSelectionMode()}
      className="shrink-0 rounded-lg border border-outline-variant/20 px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
    >
      Selecionar
    </button>
  </div>
)}
```

**Step 5: Update HistoryGrid usage — pass selection props**

```tsx
<HistoryGrid
  items={allItems}
  total={total}
  hasMore={hasNextPage ?? false}
  selectedItemId={selectedItemId}
  onSelectItem={selectItem}
  onLoadMore={fetchNextPage}
  isLoadingMore={isFetchingNextPage}
  onDeleteItem={setItemToDelete}
  selectionMode={selectionMode}
  selectedIds={selectedIds}
  onToggleItem={toggleItem}
/>
```

**Step 6: Wire delete dialog for bulk mode**

Update the `DeleteConfirmDialog` to handle both single and bulk:

```tsx
<DeleteConfirmDialog
  open={itemToDelete !== null || (selectionMode && bulkDeletePending)}
  itemName={itemToDelete?.imageTypeName ?? itemToDelete?.originalFilename ?? "Personalizado"}
  itemCount={selectionMode ? selectedIds.size : undefined}
  onConfirm={() => {
    if (selectionMode) {
      handleBulkDelete();
    } else if (itemToDelete) {
      deleteMutation.mutate({ id: itemToDelete.id, mode: itemToDelete.mode });
    }
  }}
  onCancel={() => {
    setItemToDelete(null);
    setBulkDeletePending(false);
  }}
  isDeleting={selectionMode ? bulkDeleteMutation.isPending : deleteMutation.isPending}
/>
```

Add state for triggering bulk delete dialog:

```tsx
const [bulkDeletePending, setBulkDeletePending] = useState(false);
```

Update the toolbar's `onDelete` to: `() => setBulkDeletePending(true)`

**Step 7: Update HistoryPage tests — add mocks**

In `HistoryPage.test.tsx`, add:

```tsx
vi.mock("./SelectionToolbar", () => ({
  SelectionToolbar: () => <div data-testid="selection-toolbar" />,
}));
```

Update the `HistoryGrid` mock to accept the new props:

```tsx
vi.mock("./HistoryGrid", () => ({
  HistoryGrid: (props: { items: unknown[]; selectionMode?: boolean }) => (
    <div data-testid="history-grid">{props.items.length} items</div>
  ),
}));
```

**Step 8: Run all tests**

```bash
cd apps/web && bunx vitest run src/components/history/
cd apps/web && bunx vitest run
```
Expected: all tests pass, zero regressions

---

## Task Dependency Graph

```
Task 1 (store)  ─────────────────────┐
Task 2 (backend bulk delete)  ───┐   │
Task 3 (backend bulk download) ──┤   │
Task 4 (API client)  ◄──────────┘   │
Task 5 (dialog plural)  ────────────┤
Task 6 (SelectionToolbar)  ─────────┤
Task 7 (HistoryCard selection)  ─────┤
Task 8 (HistoryGrid passthrough) ◄───┤
Task 9 (HistoryPage orchestration) ◄──┘
```

**Parallelizable:** Tasks 1, 2, 3, 5, 6 can all run in parallel.
**Sequential:** Task 4 after 2+3. Task 7 after 1. Task 8 after 7. Task 9 after all.

## Verification

```bash
# Frontend tests
cd apps/web && bunx vitest run

# Backend tests
cd apps/api && bun test

# Manual test
# 1. Open History page
# 2. Long-press a card → selection mode activates, card shows checkbox
# 3. Tap more cards → checkboxes toggle, toolbar count updates
# 4. Click "Selecionar todos" → all cards selected
# 5. Click "Baixar" → ZIP downloads
# 6. Select items → click "Excluir" → confirmation dialog shows plural → confirm → items deleted
# 7. Deselect all → selection mode auto-exits
```
