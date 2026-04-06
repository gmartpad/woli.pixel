const RECRAFT_BASE_URL = "https://external.api.recraft.ai/v1";

function getArtisticLevel(qualityTier: "low" | "medium" | "high"): number {
  switch (qualityTier) {
    case "low":
      return 1;
    case "medium":
      return 3;
    case "high":
      return 5;
  }
}

export async function generateWithRecraft(params: {
  prompt: string;
  style: string;
  substyle?: string;
  size: string;
  qualityTier: "low" | "medium" | "high";
  needsTransparency: boolean;
}): Promise<{ imageBuffer: Buffer; cost: number }> {
  const apiKey = process.env.RECRAFT_API_KEY;
  if (!apiKey) {
    throw new Error("RECRAFT_API_KEY environment variable is not set");
  }

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    model: "recraftv3",
    style: params.style,
    size: params.size,
    response_format: "url",
    controls: {
      artistic_level: getArtisticLevel(params.qualityTier),
    },
  };

  if (params.substyle !== undefined) {
    body.substyle = params.substyle;
  }

  const generateResponse = await fetch(
    `${RECRAFT_BASE_URL}/images/generations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!generateResponse.ok) {
    const errorText = await generateResponse.text();
    throw new Error(
      `Recraft image generation failed (${generateResponse.status}): ${errorText}`
    );
  }

  const generateData = (await generateResponse.json()) as {
    data: [{ url: string }];
  };

  const imageUrl = generateData.data[0]?.url;
  if (!imageUrl) {
    throw new Error("Recraft response did not contain an image URL");
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(
      `Failed to download generated image (${imageResponse.status})`
    );
  }

  let imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  let cost = 0.04;

  if (params.needsTransparency) {
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: "image/png" });
    formData.append("file", blob, "image.png");

    const bgRemoveResponse = await fetch(
      `${RECRAFT_BASE_URL}/images/removeBackground`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      }
    );

    if (!bgRemoveResponse.ok) {
      const errorText = await bgRemoveResponse.text();
      throw new Error(
        `Recraft background removal failed (${bgRemoveResponse.status}): ${errorText}`
      );
    }

    const bgRemoveData = (await bgRemoveResponse.json()) as {
      data: [{ url: string }];
    };

    const transparentUrl = bgRemoveData.data[0]?.url;
    if (!transparentUrl) {
      throw new Error(
        "Recraft background removal response did not contain an image URL"
      );
    }

    const transparentResponse = await fetch(transparentUrl);
    if (!transparentResponse.ok) {
      throw new Error(
        `Failed to download transparent image (${transparentResponse.status})`
      );
    }

    imageBuffer = Buffer.from(await transparentResponse.arrayBuffer());
    cost += 0.01;
  }

  return { imageBuffer, cost };
}
