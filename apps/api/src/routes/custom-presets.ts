import { Hono } from "hono";
import { db } from "../db";
import { customPresets } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const customPresetsRouter = new Hono();

// ── Validation constants ─────────────────────────────────────────
const VALID_STYLES = ["auto", "illustration", "photorealistic", "logo"] as const;
const VALID_OUTPUT_FORMATS = ["png", "jpeg", "webp"] as const;
const MIN_DIMENSION = 16;
const MAX_DIMENSION = 4096;
const MAX_MEGAPIXELS = 4.2;

// ── Validation helpers ───────────────────────────────────────────
function validateDimensions(width: unknown, height: unknown): string | null {
  if (typeof width !== "number" || typeof height !== "number") {
    return "width e height são obrigatórios e devem ser números";
  }
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return "width e height devem ser números inteiros";
  }
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return `Dimensões mínimas: ${MIN_DIMENSION}x${MIN_DIMENSION} pixels`;
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return `Dimensões máximas: ${MAX_DIMENSION}x${MAX_DIMENSION} pixels`;
  }
  const megapixels = (width * height) / 1_000_000;
  if (megapixels > MAX_MEGAPIXELS) {
    return `Resolução excede o limite de ${MAX_MEGAPIXELS} megapixels (atual: ${megapixels.toFixed(2)}MP)`;
  }
  return null;
}

// ── POST / — Create a custom preset ─────────────────────────────
customPresetsRouter.post("/", async (c) => {
  const user = c.get("user" as never) as { id: string } | null;
  if (!user) {
    return c.json({ error: "Autenticação necessária" }, 401);
  }

  try {
    const body = await c.req.json();

    // Validate name
    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      return c.json({ error: "Nome é obrigatório" }, 400);
    }

    // Validate dimensions
    const dimError = validateDimensions(body.width, body.height);
    if (dimError) {
      return c.json({ error: dimError }, 400);
    }

    // Validate style
    const style = body.style ?? "auto";
    if (!VALID_STYLES.includes(style)) {
      return c.json({ error: `Estilo inválido. Opções: ${VALID_STYLES.join(", ")}` }, 400);
    }

    // Validate output_format
    const outputFormat = body.output_format ?? "png";
    if (!VALID_OUTPUT_FORMATS.includes(outputFormat)) {
      return c.json({ error: `Formato inválido. Opções: ${VALID_OUTPUT_FORMATS.join(", ")}` }, 400);
    }

    const [preset] = await db
      .insert(customPresets)
      .values({
        userId: user.id,
        name: body.name.trim(),
        width: body.width,
        height: body.height,
        style,
        outputFormat,
        maxFileSizeKb: body.max_file_size_kb ?? 500,
        requiresTransparency: body.requires_transparency ?? false,
        promptContext: body.prompt_context ?? null,
      })
      .returning();

    return c.json({ data: preset }, 201);
  } catch (err) {
    console.error("Custom preset create error:", err);
    return c.json({ error: "Erro ao criar preset personalizado" }, 500);
  }
});

// ── GET / — List user's custom presets ───────────────────────────
customPresetsRouter.get("/", async (c) => {
  const user = c.get("user" as never) as { id: string } | null;
  if (!user) {
    return c.json({ error: "Autenticação necessária" }, 401);
  }

  try {
    const presets = await db
      .select()
      .from(customPresets)
      .where(eq(customPresets.userId, user.id))
      .orderBy(customPresets.createdAt);

    return c.json({ data: presets });
  } catch (err) {
    console.error("Custom preset list error:", err);
    return c.json({ error: "Erro ao listar presets personalizados" }, 500);
  }
});

// ── PUT /:id — Update a custom preset ───────────────────────────
customPresetsRouter.put("/:id", async (c) => {
  const user = c.get("user" as never) as { id: string } | null;
  if (!user) {
    return c.json({ error: "Autenticação necessária" }, 401);
  }

  const id = c.req.param("id");

  try {
    const body = await c.req.json();

    // Find preset with ownership check
    const [existing] = await db
      .select()
      .from(customPresets)
      .where(and(eq(customPresets.id, id), eq(customPresets.userId, user.id)));

    if (!existing) {
      return c.json({ error: "Preset não encontrado" }, 404);
    }

    // Re-validate dimensions if changed
    const newWidth = body.width ?? existing.width;
    const newHeight = body.height ?? existing.height;

    if (body.width !== undefined || body.height !== undefined) {
      const dimError = validateDimensions(newWidth, newHeight);
      if (dimError) {
        return c.json({ error: dimError }, 400);
      }
    }

    // Validate style if changed
    if (body.style !== undefined && !VALID_STYLES.includes(body.style)) {
      return c.json({ error: `Estilo inválido. Opções: ${VALID_STYLES.join(", ")}` }, 400);
    }

    // Validate output_format if changed
    if (body.output_format !== undefined && !VALID_OUTPUT_FORMATS.includes(body.output_format)) {
      return c.json({ error: `Formato inválido. Opções: ${VALID_OUTPUT_FORMATS.join(", ")}` }, 400);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.width !== undefined) updates.width = body.width;
    if (body.height !== undefined) updates.height = body.height;
    if (body.style !== undefined) updates.style = body.style;
    if (body.output_format !== undefined) updates.outputFormat = body.output_format;
    if (body.max_file_size_kb !== undefined) updates.maxFileSizeKb = body.max_file_size_kb;
    if (body.requires_transparency !== undefined) updates.requiresTransparency = body.requires_transparency;
    if (body.prompt_context !== undefined) updates.promptContext = body.prompt_context;

    const [updated] = await db
      .update(customPresets)
      .set(updates)
      .where(and(eq(customPresets.id, id), eq(customPresets.userId, user.id)))
      .returning();

    return c.json({ data: updated });
  } catch (err) {
    console.error("Custom preset update error:", err);
    return c.json({ error: "Erro ao atualizar preset personalizado" }, 500);
  }
});

// ── DELETE /:id — Delete a custom preset ─────────────────────────
customPresetsRouter.delete("/:id", async (c) => {
  const user = c.get("user" as never) as { id: string } | null;
  if (!user) {
    return c.json({ error: "Autenticação necessária" }, 401);
  }

  const id = c.req.param("id");

  try {
    const deleted = await db
      .delete(customPresets)
      .where(and(eq(customPresets.id, id), eq(customPresets.userId, user.id)))
      .returning();

    if (deleted.length === 0) {
      return c.json({ error: "Preset não encontrado" }, 404);
    }

    return c.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Custom preset delete error:", err);
    return c.json({ error: "Erro ao excluir preset personalizado" }, 500);
  }
});
