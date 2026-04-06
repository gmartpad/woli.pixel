import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test URL construction and error handling
describe("fetchHistory", () => {
  const mockResponse = {
    items: [],
    total: 0,
    page: 1,
    perPage: 24,
    hasMore: false,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls /history with default params", async () => {
    const { fetchHistory } = await import("./api");
    await fetchHistory({});
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toContain("/history");
    expect(url).toContain("page=1");
    expect(url).toContain("per_page=24");
  });

  it("includes all filter params in URL", async () => {
    const { fetchHistory } = await import("./api");
    await fetchHistory({
      mode: "generation",
      category: "admin,content",
      model: "recraft_v3",
      quality: "high",
      status: "completed",
      search: "owl",
      datePreset: "today",
      page: 2,
      perPage: 12,
    });
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toContain("mode=generation");
    expect(url).toContain("category=admin");
    expect(url).toContain("model=recraft_v3");
    expect(url).toContain("quality=high");
    expect(url).toContain("status=completed");
    expect(url).toContain("search=owl");
    expect(url).toContain("date_preset=today");
    expect(url).toContain("page=2");
    expect(url).toContain("per_page=12");
  });

  it("omits default/empty filter values from URL", async () => {
    const { fetchHistory } = await import("./api");
    await fetchHistory({ mode: "all", status: "all", datePreset: "all" });
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).not.toContain("mode=");
    expect(url).not.toContain("status=");
    expect(url).not.toContain("date_preset=");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    }));
    const { fetchHistory } = await import("./api");
    await expect(fetchHistory({})).rejects.toThrow();
  });
});

describe("deleteHistoryItem", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends DELETE with mode param", async () => {
    const { deleteHistoryItem } = await import("./api");
    await deleteHistoryItem("gen-1", "generation");
    const url = (fetch as any).mock.calls[0][0] as string;
    const opts = (fetch as any).mock.calls[0][1] as RequestInit;
    expect(url).toContain("/history/gen-1");
    expect(url).toContain("mode=generation");
    expect(opts.method).toBe("DELETE");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Not found" }),
    }));
    const { deleteHistoryItem } = await import("./api");
    await expect(deleteHistoryItem("x", "generation")).rejects.toThrow();
  });
});

describe("renameHistoryItem", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ displayName: "Meu Banner" }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends PATCH to /history/:id/rename with mode and displayName", async () => {
    const { renameHistoryItem } = await import("./api");
    const result = await renameHistoryItem("gen-1", "generation", "Meu Banner");

    const url = (fetch as any).mock.calls[0][0] as string;
    const opts = (fetch as any).mock.calls[0][1] as RequestInit;
    expect(url).toContain("/history/gen-1/rename");
    expect(opts.method).toBe("PATCH");
    const body = JSON.parse(opts.body as string);
    expect(body.mode).toBe("generation");
    expect(body.displayName).toBe("Meu Banner");
    expect(result.displayName).toBe("Meu Banner");
  });

  it("sends null displayName to clear custom name", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ displayName: null }),
    }));
    const { renameHistoryItem } = await import("./api");
    await renameHistoryItem("gen-1", "generation", null);

    const opts = (fetch as any).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(opts.body as string);
    expect(body.displayName).toBeNull();
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Not found" }),
    }));
    const { renameHistoryItem } = await import("./api");
    await expect(renameHistoryItem("x", "generation", "test")).rejects.toThrow("Not found");
  });
});
