import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuthImage } from "./useAuthImage";

// Mock auth-client module
vi.mock("@/lib/auth-client", () => ({
  getAuthToken: vi.fn(() => "test-token-123"),
}));

describe("useAuthImage", () => {
  const originalFetch = globalThis.fetch;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/fake-blob-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("returns null src and not loading when url is null", () => {
    const { result } = renderHook(() => useAuthImage(null));
    expect(result.current.src).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("fetches image with Bearer token and returns blob URL", async () => {
    const fakeBlob = new Blob(["fake-image"], { type: "image/png" });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(fakeBlob),
    });

    const { result } = renderHook(() =>
      useAuthImage("https://api.example.com/image/123/preview"),
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.src).toBe("blob:http://localhost/fake-blob-url");
      expect(result.current.loading).toBe(false);
    });

    // Verify the URL includes inline=1 and Bearer token
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0]!;
    const fetchedUrl = fetchCall[0] as string;
    expect(fetchedUrl).toContain("https://api.example.com/image/123/preview");
    expect(fetchedUrl).toContain("inline=1");

    const headers = fetchCall[1]!.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer test-token-123");
    expect(fetchCall[1]!.credentials).toBe("include");
  });

  it("returns null src on fetch error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const { result } = renderHook(() =>
      useAuthImage("https://api.example.com/image/123/preview"),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.src).toBeNull();
  });

  it("revokes previous blob URL when url changes", async () => {
    const fakeBlob = new Blob(["fake-image"], { type: "image/png" });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(fakeBlob),
    });

    let callCount = 0;
    (URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation(
      () => `blob:http://localhost/blob-${++callCount}`,
    );

    const { result, rerender } = renderHook(
      ({ url }) => useAuthImage(url),
      { initialProps: { url: "https://api.example.com/image/1/preview" } },
    );

    await waitFor(() => {
      expect(result.current.src).toBe("blob:http://localhost/blob-1");
    });

    rerender({ url: "https://api.example.com/image/2/preview" });

    await waitFor(() => {
      expect(result.current.src).toBe("blob:http://localhost/blob-2");
    });

    // Previous blob URL should have been revoked
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:http://localhost/blob-1",
    );
  });
});
