import { Hono } from "hono";
import sharp from "sharp";
import { eq, and, desc } from "drizzle-orm";
import { storeAvatar } from "../services/storage";
import { createPresignedDownloadUrl } from "../lib/s3";
import { auth } from "../auth";
import { db } from "../db";
import { avatarHistory } from "../db/schema";

export const profileRouter = new Hono();

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const AVATAR_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

profileRouter.get("/avatar/history", async (c) => {
  const user = c.get("user" as never) as { id: string } | null;
  if (!user) {
    return c.json({ error: "Autenticação necessária" }, 401);
  }

  const rows = await db
    .select()
    .from(avatarHistory)
    .where(eq(avatarHistory.userId, user.id))
    .orderBy(desc(avatarHistory.uploadedAt));

  const data = rows.map((row) => ({
    id: row.id,
    url: `/api/v1/avatar/${row.id}`,
    uploadedAt: row.uploadedAt,
    fileSize: row.fileSize,
  }));

  return c.json({ data });
});

profileRouter.post("/avatar", async (c) => {
  const user = c.get("user" as never) as { id: string } | null;
  if (!user) {
    return c.json({ error: "Autenticação necessária" }, 401);
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return c.json({ error: "Nenhum arquivo enviado" }, 400);
  }

  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    return c.json({ error: "O arquivo deve ser uma imagem (PNG, JPEG, GIF, WebP)" }, 400);
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return c.json({ error: "O arquivo excede o tamanho máximo de 2MB" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const resizedBuffer = await sharp(buffer)
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();

    const s3Key = await storeAvatar(user.id, resizedBuffer);
    const presignedUrl = await createPresignedDownloadUrl(s3Key);

    const updateResult = await auth.api.updateUser({
      body: { image: presignedUrl },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });

    // Forward better-auth's Set-Cookie headers to the client
    const setCookieHeaders = updateResult.headers?.getSetCookie?.() ?? [];
    const response = c.json({ image_url: presignedUrl });
    for (const cookie of setCookieHeaders) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch (err) {
    console.error("Avatar upload failed:", err);
    return c.json({ error: "Erro ao processar avatar. Tente novamente." }, 500);
  }
});

profileRouter.put("/avatar/:id/restore", async (c) => {
  const user = c.get("user" as never) as { id: string } | null;
  if (!user) {
    return c.json({ error: "Autenticação necessária" }, 401);
  }

  const { id } = c.req.param();

  const rows = await db
    .select()
    .from(avatarHistory)
    .where(and(eq(avatarHistory.id, id), eq(avatarHistory.userId, user.id)));

  if (rows.length === 0) {
    return c.json({ error: "Avatar não encontrado" }, 404);
  }

  const proxyUrl = `/api/v1/avatar/${id}`;

  const updateResult = await auth.api.updateUser({
    body: { image: proxyUrl },
    headers: c.req.raw.headers,
    returnHeaders: true,
  });

  const setCookieHeaders = updateResult.headers?.getSetCookie?.() ?? [];
  const response = c.json({ data: { id, url: proxyUrl } });
  for (const cookie of setCookieHeaders) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
});
