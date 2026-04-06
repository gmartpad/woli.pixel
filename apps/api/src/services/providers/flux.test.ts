import { describe, test, expect, mock, beforeEach } from "bun:test";
import { generateWithFlux, ModerationError } from "./flux";

const mockFetch = mock(() => Promise.resolve(new Response()));

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  process.env.BFL_API_KEY = "test-bfl-key";
});

const defaultParams = {
  prompt: "a beautiful landscape",
  width: 1024,
  height: 1024,
  qualityTier: "medium" as const,
};

const fakeImageBuffer = new Uint8Array([137, 80, 78, 71]);

function mockSubmitAndPollSuccess(pollAttempts = 1) {
  // First call: submit job
  mockFetch.mockImplementationOnce(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          id: "job-123",
          polling_url: "https://api.bfl.ai/v1/get_result?id=job-123",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
  );

  // Intermediate polls returning Pending
  for (let i = 0; i < pollAttempts - 1; i++) {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: "Pending" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  }

  // Final poll returning Ready
  mockFetch.mockImplementationOnce(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          status: "Ready",
          result: { sample: "https://bfl.ai/result/image.png" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
  );

  // Download the image
  mockFetch.mockImplementationOnce(() =>
    Promise.resolve(new Response(fakeImageBuffer, { status: 200 }))
  );
}

describe("generateWithFlux", () => {
  test("sends correct headers and body to BFL", async () => {
    mockSubmitAndPollSuccess();

    await generateWithFlux(defaultParams);

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.bfl.ai/v1/flux-2-pro");
    expect((options.headers as Record<string, string>)["x-key"]).toBe("test-bfl-key");
    expect((options.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body as string);
    expect(body.prompt).toBe("a beautiful landscape");
    expect(body.width).toBe(1024);
    expect(body.height).toBe(1024);
    expect(body.output_format).toBe("png");
    expect(body.prompt_upsampling).toBe(false);
    expect(body.safety_tolerance).toBe(2);
  });

  test("polls until Ready", async () => {
    mockSubmitAndPollSuccess(3); // 2 Pending + 1 Ready

    await generateWithFlux(defaultParams);

    // 1 submit + 3 polls + 1 download = 5 total calls
    expect(mockFetch).toHaveBeenCalledTimes(5);

    // Verify poll calls include x-key header
    const [pollUrl, pollOptions] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(pollUrl).toBe("https://api.bfl.ai/v1/get_result?id=job-123");
    expect((pollOptions.headers as Record<string, string>)["x-key"]).toBe("test-bfl-key");
  });

  test("returns imageBuffer on success", async () => {
    mockSubmitAndPollSuccess();

    const result = await generateWithFlux(defaultParams);

    expect(result.imageBuffer).toBeInstanceOf(Buffer);
    expect(result.imageBuffer.length).toBeGreaterThan(0);
  });

  test("throws on polling timeout", async () => {
    // Submit succeeds
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: "job-timeout",
            polling_url: "https://api.bfl.ai/v1/get_result?id=job-timeout",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    // All polls return Pending (simulate timeout by mocking 60 Pending responses)
    for (let i = 0; i < 60; i++) {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ status: "Pending" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );
    }

    expect(generateWithFlux(defaultParams)).rejects.toThrow(
      "FLUX generation timed out"
    );
  }, 120_000);

  test("throws on Error status", async () => {
    // Submit succeeds
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: "job-err",
            polling_url: "https://api.bfl.ai/v1/get_result?id=job-err",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    // Poll returns Error
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: "Error" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    expect(generateWithFlux(defaultParams)).rejects.toThrow(
      "FLUX generation failed with status: Error"
    );
  });

  test("throws ModerationError on Request Moderated status", async () => {
    // Submit succeeds
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: "job-mod",
            polling_url: "https://api.bfl.ai/v1/get_result?id=job-mod",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    // Poll returns Request Moderated
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            status: "Request Moderated",
            details: { "Moderation Reasons": ["Content Policy Violation"] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    try {
      await generateWithFlux(defaultParams);
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(ModerationError);
      expect((err as ModerationError).reasons).toEqual(["Content Policy Violation"]);
    }
  });

  test("calculates cost correctly for 1MP (0.03)", async () => {
    mockSubmitAndPollSuccess();

    // 1024 * 1024 = 1,048,576 -> ceil(1.048576) = 2MP? No: 1_048_576 / 1_000_000 = 1.048576 -> ceil = 2
    // Actually for exactly 1MP: 1000 * 1000 = 1,000,000 -> ceil(1) = 1 -> cost = 0.03 + max(0, 1-1)*0.015 = 0.03
    const result = await generateWithFlux({
      prompt: "test",
      width: 1000,
      height: 1000,
      qualityTier: "medium",
    });

    expect(result.cost).toBe(0.03);
  });

  test("calculates cost correctly for 2MP (0.045)", async () => {
    mockFetch.mockReset();
    mockSubmitAndPollSuccess();

    // 2,000,000 pixels -> ceil(2) = 2 -> cost = 0.03 + max(0, 2-1)*0.015 = 0.045
    const result = await generateWithFlux({
      prompt: "test",
      width: 2000,
      height: 1000,
      qualityTier: "medium",
    });

    expect(result.cost).toBe(0.045);
  });

  test("sets prompt_upsampling only for high quality", async () => {
    const tiers: Array<{ tier: "low" | "medium" | "high"; expected: boolean }> = [
      { tier: "low", expected: false },
      { tier: "medium", expected: false },
      { tier: "high", expected: true },
    ];

    for (const { tier, expected } of tiers) {
      mockFetch.mockReset();
      mockSubmitAndPollSuccess();

      await generateWithFlux({ ...defaultParams, qualityTier: tier });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.prompt_upsampling).toBe(expected);
    }
  });
});
