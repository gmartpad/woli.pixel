import { describe, test, expect, mock, beforeEach } from "bun:test";
import { generateWithRecraft } from "./recraft";

const mockFetch = mock(() => Promise.resolve(new Response()));

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  process.env.RECRAFT_API_KEY = "test-recraft-key";
});

const defaultParams = {
  prompt: "a cute cat",
  style: "digital_illustration",
  size: "1024x1024",
  qualityTier: "medium" as const,
  needsTransparency: false,
};

const fakeImageBuffer = new Uint8Array([137, 80, 78, 71]); // PNG header bytes

function mockGenerateSuccess() {
  // First call: generation endpoint returns URL
  mockFetch.mockImplementationOnce(() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: [{ url: "https://recraft.ai/image.png" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
  // Second call: download the image
  mockFetch.mockImplementationOnce(() =>
    Promise.resolve(new Response(fakeImageBuffer, { status: 200 }))
  );
}

function mockGenerateWithTransparencySuccess() {
  // First call: generation endpoint
  mockFetch.mockImplementationOnce(() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: [{ url: "https://recraft.ai/image.png" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
  // Second call: download original image
  mockFetch.mockImplementationOnce(() =>
    Promise.resolve(new Response(fakeImageBuffer, { status: 200 }))
  );
  // Third call: removeBackground endpoint
  mockFetch.mockImplementationOnce(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ data: [{ url: "https://recraft.ai/transparent.png" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
  );
  // Fourth call: download transparent image
  mockFetch.mockImplementationOnce(() =>
    Promise.resolve(new Response(fakeImageBuffer, { status: 200 }))
  );
}

describe("generateWithRecraft", () => {
  test("sends correct headers and body", async () => {
    mockGenerateSuccess();

    await generateWithRecraft(defaultParams);

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://external.api.recraft.ai/v1/images/generations");
    expect(options.headers).toEqual({
      Authorization: "Bearer test-recraft-key",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(options.body as string);
    expect(body.prompt).toBe("a cute cat");
    expect(body.model).toBe("recraftv3");
    expect(body.style).toBe("digital_illustration");
    expect(body.size).toBe("1024x1024");
    expect(body.response_format).toBe("url");
    expect(body.controls.artistic_level).toBe(3);
    expect(body.substyle).toBeUndefined();
  });

  test("includes substyle in body when provided", async () => {
    mockGenerateSuccess();

    await generateWithRecraft({ ...defaultParams, substyle: "hand_drawn" });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.substyle).toBe("hand_drawn");
  });

  test("returns imageBuffer on success", async () => {
    mockGenerateSuccess();

    const result = await generateWithRecraft(defaultParams);

    expect(result.imageBuffer).toBeInstanceOf(Buffer);
    expect(result.imageBuffer.length).toBeGreaterThan(0);
  });

  test("calls removeBackground when needsTransparency is true", async () => {
    mockGenerateWithTransparencySuccess();

    await generateWithRecraft({ ...defaultParams, needsTransparency: true });

    expect(mockFetch).toHaveBeenCalledTimes(4);

    const [bgRemoveUrl, bgRemoveOptions] = mockFetch.mock.calls[2] as [string, RequestInit];
    expect(bgRemoveUrl).toBe("https://external.api.recraft.ai/v1/images/removeBackground");
    expect((bgRemoveOptions.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-recraft-key"
    );
    expect(bgRemoveOptions.body).toBeInstanceOf(FormData);
  });

  test("cost is 0.04 without transparency", async () => {
    mockGenerateSuccess();

    const result = await generateWithRecraft(defaultParams);

    expect(result.cost).toBe(0.04);
  });

  test("cost is 0.05 with transparency", async () => {
    mockGenerateWithTransparencySuccess();

    const result = await generateWithRecraft({ ...defaultParams, needsTransparency: true });

    expect(result.cost).toBe(0.05);
  });

  test("throws on API error", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response("Internal Server Error", { status: 500 })
      )
    );

    expect(generateWithRecraft(defaultParams)).rejects.toThrow(
      "Recraft image generation failed (500)"
    );
  });

  test("maps qualityTier to artistic_level correctly", async () => {
    const tiers: Array<{ tier: "low" | "medium" | "high"; expected: number }> = [
      { tier: "low", expected: 1 },
      { tier: "medium", expected: 3 },
      { tier: "high", expected: 5 },
    ];

    for (const { tier, expected } of tiers) {
      mockFetch.mockReset();
      mockGenerateSuccess();

      await generateWithRecraft({ ...defaultParams, qualityTier: tier });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.controls.artistic_level).toBe(expected);
    }
  });
});
