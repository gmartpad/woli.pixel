import { Hono } from "hono";
import { db } from "../db";
import { imageTypes } from "../db/schema";
import { eq } from "drizzle-orm";
import { buildCostSummary, buildPresetCost, QUALITY_LABELS } from "../services/generation-cost";

const generationCostRouter = new Hono();

// GET / — Full cost matrix for all presets
generationCostRouter.get("/", async (c) => {
  const types = await db.select({
    typeKey: imageTypes.typeKey,
    displayName: imageTypes.displayName,
    width: imageTypes.width,
    height: imageTypes.height,
    category: imageTypes.category,
  }).from(imageTypes);

  const summary = buildCostSummary(types);

  return c.json({
    model: "gpt-image-1-mini",
    qualityLabels: QUALITY_LABELS,
    ...summary,
    notes: {
      pricing: "Custos de saída apenas. Edição (inpainting) adiciona ~$0.001–0.003 por imagem de entrada.",
      batch: "Batch API reduz todos os preços pela metade para jobs não-interativos.",
      upscaling: "Presets acima de 1024px geram em 1536x1024 e Sharp amplia — leve perda de qualidade.",
      downscaling: "Presets pequenos (27px, 72px) geram em 1024x1024 e Sharp reduz — sem perda.",
    },
  });
});

// GET /:typeKey — Cost for a single preset
generationCostRouter.get("/:typeKey", async (c) => {
  const typeKey = c.req.param("typeKey");

  const [type] = await db.select({
    typeKey: imageTypes.typeKey,
    displayName: imageTypes.displayName,
    width: imageTypes.width,
    height: imageTypes.height,
  }).from(imageTypes).where(eq(imageTypes.typeKey, typeKey));

  if (!type) {
    return c.json({ error: "Tipo de imagem não encontrado" }, 404);
  }

  const presetCost = buildPresetCost(type);

  return c.json({
    model: "gpt-image-1-mini",
    qualityLabels: QUALITY_LABELS,
    ...presetCost,
  });
});

export { generationCostRouter };
