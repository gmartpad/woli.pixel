import { describe, test, expect, beforeAll, mock } from "bun:test";
import { createMockOpenAI } from "../test-utils/fixtures";

// Mock OpenAI at module level before importing ai.ts
// We need to mock the `openai` module to inject our test double
const mockClient = createMockOpenAI();
const createSpy = mock(mockClient.responses.create as any);
mockClient.responses.create = createSpy;

mock.module("openai", () => ({
  default: class {
    responses = mockClient.responses;
  },
}));

// Now import the functions that use the mocked OpenAI
const { analyzeImage, generateExplanation } = await import("./ai");
const { MOCK_IMAGE_TYPES } = await import("../test-utils/fixtures");

describe("analyzeImage", () => {
  test("returns combined analysis result", async () => {
    const dataUrl = "data:image/png;base64,iVBOR";
    const result = await analyzeImage(dataUrl, MOCK_IMAGE_TYPES);

    expect(result).toHaveProperty("quality");
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("classification");
    expect(result).toHaveProperty("suggestedTypeKey");
    expect(result).toHaveProperty("cropSuggestion");
  });

  test("quality has expected shape", async () => {
    const dataUrl = "data:image/png;base64,iVBOR";
    const result = await analyzeImage(dataUrl, MOCK_IMAGE_TYPES);

    expect(result.quality).toHaveProperty("score");
    expect(result.quality).toHaveProperty("issues");
    expect(result.quality).toHaveProperty("blur_detected");
    expect(result.quality).toHaveProperty("low_resolution");
    expect(typeof result.quality.score).toBe("number");
  });

  test("classification has expected shape", async () => {
    const dataUrl = "data:image/png;base64,iVBOR";
    const result = await analyzeImage(dataUrl, MOCK_IMAGE_TYPES);

    expect(result.classification).toHaveProperty("suggestedType");
    expect(result.classification).toHaveProperty("confidence");
    expect(result.classification).toHaveProperty("reasoning");
    expect(typeof result.classification.confidence).toBe("number");
  });

  test("calls OpenAI responses.create at least twice", async () => {
    createSpy.mockClear();
    const dataUrl = "data:image/png;base64,iVBOR";
    await analyzeImage(dataUrl, MOCK_IMAGE_TYPES);

    // Step 1 (vision) + Step 2 (classification)
    expect(createSpy).toHaveBeenCalledTimes(2);
  });
});

describe("generateExplanation", () => {
  test("returns a non-empty string", async () => {
    const result = await generateExplanation(
      { width: 2000, height: 1500, format: "png", sizeKb: 3000 },
      { width: 1920, height: 1080, format: "jpeg", sizeKb: 450 },
      ["resized", "format_converted", "compressed"],
      "Imagem de Conteúdo"
    );

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("analyzeModeration", () => {
  test("returns analysis and suggestedPrompt", async () => {
    const { analyzeModeration } = await import("./ai");

    // Mock returns a nano-model response with the expected schema
    createSpy.mockImplementationOnce(() =>
      Promise.resolve({
        output_text: JSON.stringify({
          analysis: "O prompt menciona 'Darth Vader', personagem protegido por direitos autorais.",
          suggested_prompt: "Um cavaleiro espacial com armadura escura andando de quadriciclo",
        }),
      })
    );

    const result = await analyzeModeration("Darth Vader andando de quadriciclo");

    expect(result).toHaveProperty("analysis");
    expect(result).toHaveProperty("suggestedPrompt");
    expect(typeof result.analysis).toBe("string");
    expect(typeof result.suggestedPrompt).toBe("string");
    expect(result.analysis.length).toBeGreaterThan(0);
    expect(result.suggestedPrompt.length).toBeGreaterThan(0);
  });

  test("calls gpt-4.1-nano (cheapest model)", async () => {
    const { analyzeModeration } = await import("./ai");

    createSpy.mockClear();
    createSpy.mockImplementationOnce(() =>
      Promise.resolve({
        output_text: JSON.stringify({
          analysis: "Motivo da moderação.",
          suggested_prompt: "Prompt alternativo",
        }),
      })
    );

    await analyzeModeration("test prompt");

    expect(createSpy).toHaveBeenCalledTimes(1);
    const callArgs = createSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.model).toBe("gpt-4.1-nano");
  });
});
