import { Hono } from "hono";
import { db } from "../db";
import { brandProfiles, imageUploads } from "../db/schema";
import { eq, ne } from "drizzle-orm";
import { analyzeBrandConsistency } from "../services/color-analysis";

const brandsRouter = new Hono();

// POST /api/v1/brands — Create brand profile
brandsRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || !body.primary_color) {
      return c.json({ error: "name e primary_color são obrigatórios" }, 400);
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(body.primary_color)) {
      return c.json({ error: "primary_color deve ser hex válido (#RRGGBB)" }, 400);
    }

    const [profile] = await db.insert(brandProfiles).values({
      name: body.name,
      primaryColor: body.primary_color,
      secondaryColor: body.secondary_color || null,
      accentColor: body.accent_color || null,
      neutralColor: body.neutral_color || null,
      forbiddenColors: body.forbidden_colors || null,
      tolerance: body.tolerance ?? 25,
      notes: body.notes || null,
    }).returning();

    return c.json(profile, 201);
  } catch (err) {
    console.error("Brand create error:", err);
    return c.json({ error: "Erro ao criar perfil de marca" }, 500);
  }
});

// GET /api/v1/brands — List all brand profiles
brandsRouter.get("/", async (c) => {
  const profiles = await db.select().from(brandProfiles).orderBy(brandProfiles.name);
  return c.json(profiles);
});

// GET /api/v1/brands/:id — Get brand profile
brandsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [profile] = await db.select().from(brandProfiles).where(eq(brandProfiles.id, id));
  if (!profile) return c.json({ error: "Perfil de marca não encontrado" }, 404);
  return c.json(profile);
});

// PUT /api/v1/brands/:id — Update brand profile
brandsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const [existing] = await db.select().from(brandProfiles).where(eq(brandProfiles.id, id));
    if (!existing) return c.json({ error: "Perfil de marca não encontrado" }, 404);

    if (body.primary_color && !/^#[0-9a-fA-F]{6}$/.test(body.primary_color)) {
      return c.json({ error: "primary_color deve ser hex válido (#RRGGBB)" }, 400);
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.primary_color !== undefined) updates.primaryColor = body.primary_color;
    if (body.secondary_color !== undefined) updates.secondaryColor = body.secondary_color;
    if (body.accent_color !== undefined) updates.accentColor = body.accent_color;
    if (body.neutral_color !== undefined) updates.neutralColor = body.neutral_color;
    if (body.forbidden_colors !== undefined) updates.forbiddenColors = body.forbidden_colors;
    if (body.tolerance !== undefined) updates.tolerance = body.tolerance;
    if (body.notes !== undefined) updates.notes = body.notes;

    const [updated] = await db.update(brandProfiles).set(updates).where(eq(brandProfiles.id, id)).returning();
    return c.json(updated);
  } catch (err) {
    console.error("Brand update error:", err);
    return c.json({ error: "Erro ao atualizar perfil de marca" }, 500);
  }
});

// DELETE /api/v1/brands/:id — Delete brand profile
brandsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db.select().from(brandProfiles).where(eq(brandProfiles.id, id));
  if (!existing) return c.json({ error: "Perfil de marca não encontrado" }, 404);

  // Nullify references on image_uploads
  await db.update(imageUploads).set({
    brandProfileId: null,
    brandScore: null,
    brandIssues: null,
  }).where(eq(imageUploads.brandProfileId, id));

  await db.delete(brandProfiles).where(eq(brandProfiles.id, id));
  return c.json({ deleted: true });
});

// POST /api/v1/brands/:id/set-default — Set as default brand
brandsRouter.post("/:id/set-default", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db.select().from(brandProfiles).where(eq(brandProfiles.id, id));
  if (!existing) return c.json({ error: "Perfil de marca não encontrado" }, 404);

  // Unset all others
  await db.update(brandProfiles).set({ isDefault: false }).where(ne(brandProfiles.id, id));
  // Set this one
  const [updated] = await db.update(brandProfiles).set({ isDefault: true, updatedAt: new Date() }).where(eq(brandProfiles.id, id)).returning();
  return c.json(updated);
});

// POST /api/v1/brands/:id/check — Check image against brand
brandsRouter.post("/:id/check", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    if (!body.upload_id) return c.json({ error: "upload_id é obrigatório" }, 400);

    const [profile] = await db.select().from(brandProfiles).where(eq(brandProfiles.id, id));
    if (!profile) return c.json({ error: "Perfil de marca não encontrado" }, 404);

    const [upload] = await db.select().from(imageUploads).where(eq(imageUploads.id, body.upload_id));
    if (!upload) return c.json({ error: "Upload não encontrado" }, 404);

    if (!upload.aiAnalysisJson) return c.json({ error: "Imagem ainda não foi analisada" }, 400);

    const analysis = upload.aiAnalysisJson as any;
    const dominantColors: string[] = analysis.content?.dominant_colors || [];

    const palette = [profile.primaryColor];
    if (profile.secondaryColor) palette.push(profile.secondaryColor);
    if (profile.accentColor) palette.push(profile.accentColor);
    if (profile.neutralColor) palette.push(profile.neutralColor);

    const result = analyzeBrandConsistency(dominantColors, {
      palette,
      forbidden: profile.forbiddenColors || [],
      tolerance: profile.tolerance,
    });

    // Store results on upload
    await db.update(imageUploads).set({
      brandProfileId: id,
      brandScore: result.score,
      brandIssues: result.issues,
      updatedAt: new Date(),
    }).where(eq(imageUploads.id, body.upload_id));

    return c.json(result);
  } catch (err) {
    console.error("Brand check error:", err);
    return c.json({ error: "Erro na verificação de marca" }, 500);
  }
});

export { brandsRouter };
