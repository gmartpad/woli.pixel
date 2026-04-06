import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { avatarHistory } from "../db/schema";
import { downloadFromS3 } from "../lib/s3";

export const avatarRouter = new Hono();

avatarRouter.get("/:id", async (c) => {
  const { id } = c.req.param();

  const rows = await db
    .select()
    .from(avatarHistory)
    .where(eq(avatarHistory.id, id));

  if (rows.length === 0) {
    return c.json({ error: "Avatar não encontrado" }, 404);
  }

  const avatar = rows[0];
  const buffer = await downloadFromS3(avatar.s3Key);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(buffer.length),
    },
  });
});
