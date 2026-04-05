import { Hono } from "hono";
import { db } from "../db";
import { imageTypes } from "../db/schema";
import { eq } from "drizzle-orm";

const imageTypesRouter = new Hono();

// GET /api/v1/image-types — List all 13 image type specs
imageTypesRouter.get("/", async (c) => {
  const types = await db.select().from(imageTypes).orderBy(imageTypes.category, imageTypes.displayName);

  const grouped: Record<string, typeof types> = {};
  for (const t of types) {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  }

  return c.json({ types, grouped, total: types.length });
});

// GET /api/v1/image-types/:id — Get specific type details
imageTypesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [type] = await db.select().from(imageTypes).where(eq(imageTypes.id, id));

  if (!type) {
    return c.json({ error: "Tipo de imagem não encontrado" }, 404);
  }

  return c.json(type);
});

export { imageTypesRouter };
