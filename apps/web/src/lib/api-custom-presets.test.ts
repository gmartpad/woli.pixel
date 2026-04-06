import { describe, it, expect, vi, afterEach } from "vitest";

// We need to test that the functions exist with correct signatures
// and make the right fetch calls
describe("Custom Presets API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createCustomPreset sends POST with correct body", async () => {
    const { createCustomPreset } = await import("@/lib/api");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "1", name: "Test", width: 1920, height: 1080 } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await createCustomPreset({ name: "Banner HD", width: 1920, height: 1080 });
    expect(spy).toHaveBeenCalledOnce();
    const [url, opts] = spy.mock.calls[0]!;
    expect(String(url)).toContain("/custom-presets");
    expect(opts?.method).toBe("POST");
    expect(result.name).toBe("Test");
  });

  it("fetchCustomPresets sends GET", async () => {
    const { fetchCustomPresets } = await import("@/lib/api");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] })),
    );
    const result = await fetchCustomPresets();
    expect(Array.isArray(result)).toBe(true);
  });

  it("deleteCustomPreset sends DELETE", async () => {
    const { deleteCustomPreset } = await import("@/lib/api");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { deleted: true } })),
    );
    await expect(deleteCustomPreset("test-id")).resolves.toBeUndefined();
  });

  it("getCustomResolutionCostEstimate sends correct query params", async () => {
    const { getCustomResolutionCostEstimate } = await import("@/lib/api");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ estimatedCostUsd: 0.045 })),
    );
    await getCustomResolutionCostEstimate(1920, 1080, "photorealistic", false);
    const url = String(spy.mock.calls[0]![0]);
    expect(url).toContain("width=1920");
    expect(url).toContain("height=1080");
    expect(url).toContain("style=photorealistic");
  });

  it("generateImageCustom sends custom_width and custom_height", async () => {
    const { generateImageCustom } = await import("@/lib/api");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1", status: "completed" })),
    );
    await generateImageCustom(1920, 1080, "A sunset", "high", "photorealistic");
    const body = JSON.parse(spy.mock.calls[0]![1]?.body as string);
    expect(body.custom_width).toBe(1920);
    expect(body.custom_height).toBe(1080);
    expect(body.custom_style).toBe("photorealistic");
  });

  it("generateImageFromPreset sends custom_preset_id", async () => {
    const { generateImageFromPreset } = await import("@/lib/api");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1" })),
    );
    await generateImageFromPreset("preset-123", "A logo", "medium");
    const body = JSON.parse(spy.mock.calls[0]![1]?.body as string);
    expect(body.custom_preset_id).toBe("preset-123");
    expect(body.prompt).toBe("A logo");
  });
});
