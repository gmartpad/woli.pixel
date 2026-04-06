const BFL_BASE_URL = "https://api.bfl.ai/v1";
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 60;

export class ModerationError extends Error {
  public readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`Prompt rejeitado pela política de conteúdo: ${reasons.join(", ")}`);
    this.name = "ModerationError";
    this.reasons = reasons;
  }
}

export async function generateWithFlux(params: {
  prompt: string;
  width: number;
  height: number;
  qualityTier: "low" | "medium" | "high";
}): Promise<{ imageBuffer: Buffer; cost: number }> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) {
    throw new Error("BFL_API_KEY environment variable is not set");
  }

  const body = {
    prompt: params.prompt,
    width: params.width,
    height: params.height,
    output_format: "png",
    prompt_upsampling: params.qualityTier === "high",
    safety_tolerance: 2,
  };

  const submitResponse = await fetch(`${BFL_BASE_URL}/flux-2-pro`, {
    method: "POST",
    headers: {
      "x-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(
      `FLUX job submission failed (${submitResponse.status}): ${errorText}`
    );
  }

  const submitData = (await submitResponse.json()) as {
    id: string;
    polling_url: string;
  };

  const { polling_url } = submitData;
  if (!polling_url) {
    throw new Error("FLUX response did not contain a polling URL");
  }

  let sampleUrl: string | undefined;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollResponse = await fetch(polling_url, {
      method: "GET",
      headers: {
        "x-key": apiKey,
      },
    });

    if (!pollResponse.ok) {
      const errorText = await pollResponse.text();
      throw new Error(
        `FLUX polling failed (${pollResponse.status}): ${errorText}`
      );
    }

    const pollData = (await pollResponse.json()) as {
      status: string;
      result?: { sample: string };
      details?: Record<string, unknown>;
    };

    if (pollData.status === "Ready") {
      sampleUrl = pollData.result?.sample;
      break;
    }

    if (pollData.status === "Request Moderated") {
      const reasons = (pollData.details?.["Moderation Reasons"] as string[]) ?? ["Content Policy Violation"];
      throw new ModerationError(reasons);
    }

    if (pollData.status !== "Pending") {
      const detail = pollData.details
        ? `: ${JSON.stringify(pollData.details)}`
        : "";
      throw new Error(
        `FLUX generation failed with status: ${pollData.status}${detail}`
      );
    }
  }

  if (!sampleUrl) {
    throw new Error(
      "FLUX generation timed out after 60 seconds of polling"
    );
  }

  const imageResponse = await fetch(sampleUrl);
  if (!imageResponse.ok) {
    throw new Error(
      `Failed to download FLUX image (${imageResponse.status})`
    );
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  const megapixels = Math.ceil((params.width * params.height) / 1_000_000);
  const cost = 0.03 + Math.max(0, megapixels - 1) * 0.015;

  return { imageBuffer, cost };
}
