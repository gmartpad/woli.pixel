import { Hono } from "hono";
import sharp from "sharp";
import { eq, and, desc, count, asc, ne, inArray } from "drizzle-orm";
import { storeAvatar, batchDeleteObjects } from "../services/storage";
import { deleteFromS3, objectExists } from "../lib/s3";
import { auth } from "../auth";
import { db } from "../db";
import { avatarHistory } from "../db/schema";

export const profileRouter = new Hono();

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const AVATAR_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

profileRouter.get("/avatar/history", async (c) => {
  const user = c.get("user" as never) as { id: string; image?: string | null } | null;
  if (!user) {
    return c.json({ error: "Autenticação necessária" }, 401);
  }

  try {
    let rows = await db
      .select()
      .from(avatarHistory)
      .where(eq(avatarHistory.userId, user.id))
      .orderBy(desc(avatarHistory.uploadedAt));

    // Lazy backfill: if user has a presigned URL but no history rows
    if (rows.length === 0 && user.image && user.image.includes("X-Amz-Signature")) {
      try {
        // Parse S3 key from the presigned URL
        const url = new URL(user.image);
        const pathParts = url.pathname.split("/");
        const avatarsIdx = pathParts.indexOf("avatars");
        if (avatarsIdx !== -1) {
          const s3Key = pathParts.slice(avatarsIdx).join("/");
          const exists = await objectExists(s3Key);

          if (exists) {
            const [inserted] = await db
              .insert(avatarHistory)
              .values({
                userId: user.id,
                s3Key,
                fileSize: 0, // Unknown for legacy avatars
                width: 256,
                height: 256,
              })
              .returning();

            // Update user.image to proxy URL
            await auth.api.updateUser({
              body: { image: `/api/v1/avatar/${inserted.id}` },
              headers: c.req.raw.headers,
            });

            rows = [inserted];
          }
        }
      } catch (err) {
        console.error("Avatar backfill failed:", err);
        // Non-fatal -- continue with empty history
      }
    }

    const data = rows.map((row) => ({
      id: row.id,
      url: `/api/v1/avatar/${row.id}`,
      uploadedAt: row.uploadedAt,
      fileSize: row.fileSize,
    }));

    return c.json({ data });
  } catch (err) {
    console.error("Avatar history fetch failed:", err);
    return c.json({ error: "Erro ao carregar histórico de fotos" }, 500);
  }
});

profileRouter.post("/avatar", async (c) => {
  const user = c.get("user" as never) as { id: string; image?: string | null } | null;
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

    // Insert avatar_history row
    const [inserted] = await db
      .insert(avatarHistory)
      .values({
        userId: user.id,
        s3Key,
        fileSize: resizedBuffer.length,
        width: 256,
        height: 256,
      })
      .returning({ id: avatarHistory.id });

    const proxyUrl = `/api/v1/avatar/${inserted.id}`;

    // Enforce 20-avatar limit
    const [{ value: historyCount }] = await db
      .select({ value: count() })
      .from(avatarHistory)
      .where(eq(avatarHistory.userId, user.id));

    if (historyCount > 20) {
      // Find current avatar ID from user.image
      const currentAvatarId = user.image?.match(/\/api\/v1\/avatar\/(.+)/)?.[1];
      const excess = historyCount - 20;

      const oldestRows = await db
        .select({ id: avatarHistory.id, s3Key: avatarHistory.s3Key })
        .from(avatarHistory)
        .where(
          currentAvatarId
            ? and(eq(avatarHistory.userId, user.id), ne(avatarHistory.id, currentAvatarId), ne(avatarHistory.id, inserted.id))
            : and(eq(avatarHistory.userId, user.id), ne(avatarHistory.id, inserted.id)),
        )
        .orderBy(asc(avatarHistory.uploadedAt))
        .limit(excess);

      for (const row of oldestRows) {
        await db.delete(avatarHistory).where(eq(avatarHistory.id, row.id));
        await deleteFromS3(row.s3Key);
      }
    }

    // Update user.image to proxy URL
    const updateResult = await auth.api.updateUser({
      body: { image: proxyUrl },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });

    const setCookieHeaders = updateResult.headers?.getSetCookie?.() ?? [];
    const response = c.json({ data: { id: inserted.id, url: proxyUrl } });
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

profileRouter.delete("/avatar/bulk", async (c) => {
  const user = c.get("user" as never) as { id: string; image?: string | null } | null;
  if (!user) {
    return c.json({ error: "Autenticação necessária" }, 401);
  }

  const body = await c.req.json<{ ids: string[] }>();
  if (!body.ids || body.ids.length === 0) {
    return c.json({ error: "Nenhum avatar selecionado" }, 400);
  }

  // Only delete avatars that belong to this user
  const rows = await db
    .select()
    .from(avatarHistory)
    .where(and(
      inArray(avatarHistory.id, body.ids),
      eq(avatarHistory.userId, user.id),
    ));

  if (rows.length === 0) {
    return c.json({ data: { deleted: 0, clearedCurrent: false } });
  }

  // Delete from DB
  const idsToDelete = rows.map((r) => r.id);
  await db
    .delete(avatarHistory)
    .where(inArray(avatarHistory.id, idsToDelete));

  // Delete from S3
  const s3Keys = rows.map((r) => r.s3Key);
  await batchDeleteObjects(s3Keys);

  // Check if current avatar was deleted
  const currentAvatarId = user.image?.match(/\/api\/v1\/avatar\/(.+)/)?.[1];
  const clearedCurrent = currentAvatarId ? idsToDelete.includes(currentAvatarId) : false;

  if (clearedCurrent) {
    const updateResult = await auth.api.updateUser({
      body: { image: null },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    const setCookieHeaders = updateResult.headers?.getSetCookie?.() ?? [];
    const response = c.json({ data: { deleted: rows.length, clearedCurrent: true } });
    for (const cookie of setCookieHeaders) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  }

  return c.json({ data: { deleted: rows.length, clearedCurrent: false } });
});

profileRouter.delete("/avatar/:id", async (c) => {
  const user = c.get("user" as never) as { id: string; image?: string | null } | null;
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

  const avatar = rows[0];

  // Delete from DB
  await db.delete(avatarHistory).where(eq(avatarHistory.id, id));

  // Delete from S3
  await deleteFromS3(avatar.s3Key);

  // If deleting current avatar, clear user.image
  const isCurrentAvatar = user.image === `/api/v1/avatar/${id}`;
  if (isCurrentAvatar) {
    const updateResult = await auth.api.updateUser({
      body: { image: null },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    const setCookieHeaders = updateResult.headers?.getSetCookie?.() ?? [];
    const response = c.json({ data: { deleted: true, clearedCurrent: true } });
    for (const cookie of setCookieHeaders) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  }

  return c.json({ data: { deleted: true, clearedCurrent: false } });
});
