# Avatar History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users browse, restore, and delete past profile avatars from a history-first modal, backed by a new `avatar_history` DB table and a permanent proxy route that eliminates presigned URL expiration.

**Architecture:** New `avatar_history` table tracks every upload. A proxy route `GET /api/v1/avatar/:id` streams images from S3 with immutable caching. The existing upload route is modified to insert history rows and use proxy URLs. Frontend gets a new `AvatarPickerModal` with History/Upload tabs replacing the direct file picker.

**Tech Stack:** Bun + Hono + Drizzle ORM + PostgreSQL + S3 (backend), React 19 + TailwindCSS 4 + React Query (frontend), bun:test + vitest + RTL (testing)

**Design doc:** `plans/10-avatar-history-design.md`

---

## Task 1: Database Schema — `avatar_history` table

**Files:**
- Modify: `apps/api/src/db/schema.ts` (add table after line 96)
- Modify: `apps/api/src/db/auth-schema.ts` (add relation to userRelations, line 78-81)

**Step 1: Add the `avatarHistory` table to schema.ts**

Add after the `imageUploads` table block (after line 96):

```ts
// ── Avatar History ──────────────────────────
export const avatarHistory = pgTable("avatar_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  s3Key: text("s3_key").notNull(),
  fileSize: integer("file_size").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("avatar_history_user_id_idx").on(table.userId),
]);
```

Note: `user` is already re-exported from `auth-schema.ts` at line 2 of `schema.ts`, so the FK reference works.

**Step 2: Add relation in auth-schema.ts**

Import `avatarHistory` and update `userRelations` at line 78:

```ts
// At the top of auth-schema.ts, add import:
import { avatarHistory } from "./schema";

// Replace userRelations (lines 78-81):
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  avatarHistory: many(avatarHistory),
}));
```

Add `avatarHistoryRelations` after `accountRelations` (after line 95):

```ts
export const avatarHistoryRelations = relations(avatarHistory, ({ one }) => ({
  user: one(user, {
    fields: [avatarHistory.userId],
    references: [user.id],
  }),
}));
```

**Step 3: Generate migration**

Run: `cd apps/api && bun run db:generate`

Expected: A new migration file in `apps/api/drizzle/` with `CREATE TABLE "avatar_history"` and the index.

**Step 4: Push schema to local dev DB**

Run: `cd apps/api && bun run db:push`

Expected: Schema applied successfully.

**Step 5: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/src/db/auth-schema.ts apps/api/drizzle/
git commit -m "feat: add avatar_history table for profile image history"
```

---

## Task 2: Avatar proxy route — `GET /api/v1/avatar/:id`

This route streams avatar images from S3 with permanent caching. No auth required (UUID is unguessable).

**Files:**
- Create: `apps/api/src/routes/avatar.ts`
- Create: `apps/api/src/routes/avatar.test.ts`
- Modify: `apps/api/src/index.ts` (register route)

**Step 1: Write the failing test**

Create `apps/api/src/routes/avatar.test.ts`:

```ts
import { describe, test, expect, mock, beforeEach } from "bun:test";

const mockDownloadFromS3 = mock(async () => Buffer.from("fake-webp-data"));

mock.module("../lib/s3", () => ({
  downloadFromS3: mockDownloadFromS3,
  uploadToS3: mock(async () => {}),
  createPresignedDownloadUrl: mock(async () => ""),
  batchDeleteObjects: mock(async () => {}),
  objectExists: mock(async () => false),
  deleteFromS3: mock(async () => {}),
  s3Client: {},
  BUCKET: "test-bucket",
}));

// Mock DB
const mockAvatarRow = {
  id: "avatar-uuid-1",
  userId: "user-123",
  s3Key: "avatars/user-123/1712345678.webp",
  fileSize: 2048,
  width: 256,
  height: 256,
  uploadedAt: new Date(),
};

const mockDbSelect = mock(() => ({
  from: mock(() => ({
    where: mock(() => Promise.resolve([mockAvatarRow])),
  })),
}));

mock.module("../db", () => ({
  db: {
    select: mockDbSelect,
  },
}));

mock.module("../db/schema", () => ({
  avatarHistory: {
    id: "id",
    userId: "user_id",
    s3Key: "s3_key",
    fileSize: "file_size",
    width: "width",
    height: "height",
    uploadedAt: "uploaded_at",
  },
}));

const { avatarRouter } = await import("./avatar");

import { Hono } from "hono";

const app = new Hono();
app.route("/api/v1/avatar", avatarRouter);

beforeEach(() => {
  mockDownloadFromS3.mockClear();
  mockDbSelect.mockClear();
});

describe("GET /api/v1/avatar/:id", () => {
  test("returns 200 with image/webp content type and cache headers", async () => {
    const res = await app.request("/api/v1/avatar/avatar-uuid-1");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  test("returns 404 for unknown avatar ID", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: mock(() => ({
        where: mock(() => Promise.resolve([])),
      })),
    });

    const res = await app.request("/api/v1/avatar/nonexistent-id");

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("streams image data from S3 using the s3Key from DB", async () => {
    await app.request("/api/v1/avatar/avatar-uuid-1");

    expect(mockDownloadFromS3).toHaveBeenCalledWith(
      "avatars/user-123/1712345678.webp",
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test src/routes/avatar.test.ts`

Expected: FAIL — module `./avatar` not found.

**Step 3: Write the implementation**

Create `apps/api/src/routes/avatar.ts`:

```ts
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
```

**Step 4: Register the route in index.ts**

Add to `apps/api/src/index.ts`:

```ts
// After line 14 (import profileRouter):
import { avatarRouter } from "./routes/avatar";

// After line 43 (public routes section, after generation-cost):
app.route("/api/v1/avatar", avatarRouter);
```

The avatar proxy route is **public** (no `requireAuth`), placed alongside other public routes.

**Step 5: Run test to verify it passes**

Run: `cd apps/api && bun test src/routes/avatar.test.ts`

Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add apps/api/src/routes/avatar.ts apps/api/src/routes/avatar.test.ts apps/api/src/index.ts
git commit -m "feat: add avatar proxy route for permanent image URLs"
```

---

## Task 3: Avatar history listing — `GET /api/v1/profile/avatar/history`

**Files:**
- Modify: `apps/api/src/routes/profile.ts` (add GET handler)
- Modify: `apps/api/src/routes/profile.test.ts` (add tests)

**Step 1: Write the failing tests**

Add to `apps/api/src/routes/profile.test.ts`, at the end (before the closing of the file):

First, add DB mock at the top with the other mocks (after line 56):

```ts
const mockAvatarHistoryRows: any[] = [];
const mockDbSelect = mock(() => ({
  from: mock(() => ({
    where: mock(() => ({
      orderBy: mock(() => Promise.resolve(mockAvatarHistoryRows)),
    })),
  })),
}));
const mockDbInsert = mock(() => ({
  values: mock(() => ({
    returning: mock(() => Promise.resolve([{ id: "new-avatar-id" }])),
  })),
}));
const mockDbDelete = mock(() => ({
  where: mock(() => Promise.resolve()),
}));

mock.module("../db", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    delete: mockDbDelete,
  },
}));

mock.module("../db/schema", () => ({
  avatarHistory: {
    id: "id",
    userId: "user_id",
    s3Key: "s3_key",
    fileSize: "file_size",
    width: "width",
    height: "height",
    uploadedAt: "uploaded_at",
  },
}));
```

Then add tests:

```ts
describe("GET /api/v1/profile/avatar/history", () => {
  test("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/v1/profile/avatar/history");
    expect(res.status).toBe(401);
  });

  test("returns empty array when user has no avatar history", async () => {
    mockAvatarHistoryRows.length = 0;

    const res = await app.request("/api/v1/profile/avatar/history", {
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  test("returns avatar history entries with proxy URLs", async () => {
    mockAvatarHistoryRows.length = 0;
    mockAvatarHistoryRows.push(
      {
        id: "av-1",
        userId: "user-123",
        s3Key: "avatars/user-123/111.webp",
        fileSize: 2048,
        width: 256,
        height: 256,
        uploadedAt: new Date("2026-04-01"),
      },
      {
        id: "av-2",
        userId: "user-123",
        s3Key: "avatars/user-123/222.webp",
        fileSize: 3072,
        width: 256,
        height: 256,
        uploadedAt: new Date("2026-04-02"),
      },
    );

    const res = await app.request("/api/v1/profile/avatar/history", {
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].url).toContain("/api/v1/avatar/");
    expect(body.data[0].id).toBeDefined();
    expect(body.data[0].uploadedAt).toBeDefined();
    expect(body.data[0].fileSize).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test src/routes/profile.test.ts`

Expected: FAIL — 404 for the GET route (not yet implemented).

**Step 3: Write the implementation**

Add to `apps/api/src/routes/profile.ts`, after the existing imports:

```ts
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { avatarHistory } from "../db/schema";
```

Add before the `profileRouter.post("/avatar", ...)` handler:

```ts
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
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && bun test src/routes/profile.test.ts`

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add apps/api/src/routes/profile.ts apps/api/src/routes/profile.test.ts
git commit -m "feat: add avatar history listing endpoint"
```

---

## Task 4: Modify upload route to track history + enforce 20-limit

**Files:**
- Modify: `apps/api/src/routes/profile.ts` (update POST handler)
- Modify: `apps/api/src/routes/profile.test.ts` (add tests)

**Step 1: Write the failing tests**

Add to `apps/api/src/routes/profile.test.ts`:

```ts
describe("POST /api/v1/profile/avatar — history integration", () => {
  test("inserts avatar_history row on successful upload", async () => {
    const formData = new FormData();
    formData.append("file", createTestPngBlob(), "avatar.png");

    const res = await app.request("/api/v1/profile/avatar", {
      method: "POST",
      body: formData,
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(200);
    expect(mockDbInsert).toHaveBeenCalled();
  });

  test("returns proxy URL instead of presigned URL", async () => {
    const formData = new FormData();
    formData.append("file", createTestPngBlob(), "avatar.png");

    const res = await app.request("/api/v1/profile/avatar", {
      method: "POST",
      body: formData,
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.url).toContain("/api/v1/avatar/");
    expect(body.data.id).toBeDefined();
  });

  test("updates user.image with proxy URL, not presigned URL", async () => {
    const formData = new FormData();
    formData.append("file", createTestPngBlob(), "avatar.png");

    await app.request("/api/v1/profile/avatar", {
      method: "POST",
      body: formData,
      headers: { cookie: "auth-session=valid" },
    });

    const updateCall = mockUpdateUser.mock.calls[0][0];
    expect(updateCall.body.image).toContain("/api/v1/avatar/");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test src/routes/profile.test.ts`

Expected: FAIL — response still returns `image_url` with presigned URL.

**Step 3: Update the POST handler implementation**

Replace the entire `profileRouter.post("/avatar", ...)` handler in `apps/api/src/routes/profile.ts` with:

```ts
import { count } from "drizzle-orm";
import { asc } from "drizzle-orm";
import { and, ne } from "drizzle-orm";
import { deleteFromS3 } from "../lib/s3";

// (consolidate all drizzle-orm imports into one line at the top)
// import { eq, desc, count, asc, and, ne } from "drizzle-orm";

const AVATAR_HISTORY_LIMIT = 20;

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

    // Enforce 20-avatar limit: delete oldest non-current
    const currentProxyUrl = `/api/v1/avatar/${inserted.id}`;
    const [{ value: historyCount }] = await db
      .select({ value: count() })
      .from(avatarHistory)
      .where(eq(avatarHistory.userId, user.id));

    if (historyCount > AVATAR_HISTORY_LIMIT) {
      // Find the current avatar ID from user.image (if it's a proxy URL)
      const currentAvatarId = user.image?.match(/\/api\/v1\/avatar\/(.+)/)?.[1];

      // Get oldest non-current avatars to delete
      const excess = historyCount - AVATAR_HISTORY_LIMIT;
      const oldestRows = await db
        .select({ id: avatarHistory.id, s3Key: avatarHistory.s3Key })
        .from(avatarHistory)
        .where(
          currentAvatarId
            ? and(eq(avatarHistory.userId, user.id), ne(avatarHistory.id, currentAvatarId))
            : eq(avatarHistory.userId, user.id),
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
      body: { image: currentProxyUrl },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });

    // Forward better-auth's Set-Cookie headers
    const setCookieHeaders = updateResult.headers?.getSetCookie?.() ?? [];
    const response = c.json({ data: { id: inserted.id, url: currentProxyUrl } });
    for (const cookie of setCookieHeaders) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch (err) {
    console.error("Avatar upload failed:", err);
    return c.json({ error: "Erro ao processar avatar. Tente novamente." }, 500);
  }
});
```

Note: The response shape changes from `{ image_url }` to `{ data: { id, url } }`. The frontend `uploadAvatar()` function in `apps/web/src/lib/api.ts` must be updated later (Task 9).

**Step 4: Run test to verify it passes**

Run: `cd apps/api && bun test src/routes/profile.test.ts`

Expected: All tests PASS. Note: some existing tests may need adjustment because the response shape changed from `{ image_url }` to `{ data: { id, url } }`. Update those assertions accordingly:
- Line 179: change `body.image_url` to `body.data.url`
- Line 198-199: change `updateCall.body.image` assertion to check it contains `/api/v1/avatar/`

**Step 5: Commit**

```bash
git add apps/api/src/routes/profile.ts apps/api/src/routes/profile.test.ts
git commit -m "feat: track avatar uploads in history, use proxy URLs, enforce 20-limit"
```

---

## Task 5: Restore route — `PUT /api/v1/profile/avatar/:id/restore`

**Files:**
- Modify: `apps/api/src/routes/profile.ts`
- Modify: `apps/api/src/routes/profile.test.ts`

**Step 1: Write the failing tests**

```ts
describe("PUT /api/v1/profile/avatar/:id/restore", () => {
  test("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/v1/profile/avatar/av-1/restore", {
      method: "PUT",
    });
    expect(res.status).toBe(401);
  });

  test("returns 404 when avatar belongs to another user or doesn't exist", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: mock(() => ({
        where: mock(() => Promise.resolve([])),
      })),
    });

    const res = await app.request("/api/v1/profile/avatar/nonexistent/restore", {
      method: "PUT",
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(404);
  });

  test("returns 200 and updates user.image to proxy URL", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: mock(() => ({
        where: mock(() =>
          Promise.resolve([
            {
              id: "av-old",
              userId: "user-123",
              s3Key: "avatars/user-123/old.webp",
            },
          ]),
        ),
      })),
    });

    const res = await app.request("/api/v1/profile/avatar/av-old/restore", {
      method: "PUT",
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.url).toBe("/api/v1/avatar/av-old");

    const updateCall = mockUpdateUser.mock.calls[0][0];
    expect(updateCall.body.image).toBe("/api/v1/avatar/av-old");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test src/routes/profile.test.ts`

Expected: FAIL — 404 (route not registered).

**Step 3: Write the implementation**

Add to `apps/api/src/routes/profile.ts`:

```ts
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
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && bun test src/routes/profile.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/routes/profile.ts apps/api/src/routes/profile.test.ts
git commit -m "feat: add avatar restore endpoint"
```

---

## Task 6: Delete route — `DELETE /api/v1/profile/avatar/:id`

**Files:**
- Modify: `apps/api/src/routes/profile.ts`
- Modify: `apps/api/src/routes/profile.test.ts`

**Step 1: Write the failing tests**

```ts
describe("DELETE /api/v1/profile/avatar/:id", () => {
  test("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/v1/profile/avatar/av-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  test("returns 404 when avatar doesn't exist or belongs to another user", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: mock(() => ({
        where: mock(() => Promise.resolve([])),
      })),
    });

    const res = await app.request("/api/v1/profile/avatar/nonexistent", {
      method: "DELETE",
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(404);
  });

  test("deletes avatar from DB and S3, returns success", async () => {
    const mockDeleteFromS3 = (await import("../lib/s3")).deleteFromS3 as ReturnType<typeof mock>;
    mockDeleteFromS3.mockClear();

    mockDbSelect.mockReturnValueOnce({
      from: mock(() => ({
        where: mock(() =>
          Promise.resolve([
            {
              id: "av-del",
              userId: "user-123",
              s3Key: "avatars/user-123/del.webp",
            },
          ]),
        ),
      })),
    });

    const res = await app.request("/api/v1/profile/avatar/av-del", {
      method: "DELETE",
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
    expect(mockDbDelete).toHaveBeenCalled();
    expect(mockDeleteFromS3).toHaveBeenCalledWith("avatars/user-123/del.webp");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test src/routes/profile.test.ts`

Expected: FAIL — 404 (route not registered).

**Step 3: Write the implementation**

Add to `apps/api/src/routes/profile.ts`:

```ts
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
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && bun test src/routes/profile.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/routes/profile.ts apps/api/src/routes/profile.test.ts
git commit -m "feat: add avatar delete endpoint with S3 cleanup"
```

---

## Task 7: Bulk delete route — `DELETE /api/v1/profile/avatar/bulk`

**Files:**
- Modify: `apps/api/src/routes/profile.ts`
- Modify: `apps/api/src/routes/profile.test.ts`

**Step 1: Write the failing tests**

```ts
describe("DELETE /api/v1/profile/avatar/bulk", () => {
  test("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/v1/profile/avatar/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["av-1"] }),
    });
    expect(res.status).toBe(401);
  });

  test("returns 400 when ids is missing or empty", async () => {
    const res = await app.request("/api/v1/profile/avatar/bulk", {
      method: "DELETE",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: [] }),
    });
    expect(res.status).toBe(400);
  });

  test("deletes multiple avatars from DB and S3", async () => {
    const mockBatchDelete = (await import("../lib/s3")).batchDeleteObjects as ReturnType<typeof mock>;
    mockBatchDelete.mockClear();

    // Mock: return 2 matching rows
    mockDbSelect.mockReturnValueOnce({
      from: mock(() => ({
        where: mock(() =>
          Promise.resolve([
            { id: "av-b1", userId: "user-123", s3Key: "avatars/user-123/b1.webp" },
            { id: "av-b2", userId: "user-123", s3Key: "avatars/user-123/b2.webp" },
          ]),
        ),
      })),
    });

    const res = await app.request("/api/v1/profile/avatar/bulk", {
      method: "DELETE",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: ["av-b1", "av-b2"] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test src/routes/profile.test.ts`

Expected: FAIL

**Step 3: Write the implementation**

Add to `apps/api/src/routes/profile.ts` (must be registered BEFORE the `/:id` routes so Hono matches `/bulk` first):

```ts
import { inArray } from "drizzle-orm";
import { batchDeleteObjects } from "../services/storage";

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
```

**Important:** Register `/avatar/bulk` BEFORE `/avatar/:id` in the route file. Hono matches routes in registration order, and `/avatar/bulk` must not be captured by `/avatar/:id`.

**Step 4: Run test to verify it passes**

Run: `cd apps/api && bun test src/routes/profile.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/routes/profile.ts apps/api/src/routes/profile.test.ts
git commit -m "feat: add bulk avatar delete endpoint"
```

---

## Task 8: Lazy backfill for existing users

**Files:**
- Modify: `apps/api/src/routes/profile.ts` (update GET handler)
- Modify: `apps/api/src/routes/profile.test.ts`

**Step 1: Write the failing test**

```ts
describe("GET /api/v1/profile/avatar/history — lazy backfill", () => {
  test("backfills history when user has presigned URL but no history rows", async () => {
    // Override the auth mock to include a presigned-style image URL
    const { auth } = await import("../auth");
    const originalGetSession = auth.api.getSession;
    (auth.api.getSession as any) = mock(async () => ({
      user: {
        id: "user-123",
        name: "Gabriel",
        email: "gabriel@woli.com",
        image: "https://woli-pixel-uploads.s3.amazonaws.com/avatars/user-123/1712345678.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc123",
      },
      session: { id: "session-123" },
    }));

    // Mock objectExists to return true
    const { objectExists } = await import("../lib/s3");
    (objectExists as any).mockReturnValueOnce(true);

    // Mock empty history
    mockAvatarHistoryRows.length = 0;

    const res = await app.request("/api/v1/profile/avatar/history", {
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(0);
    // The backfill should have called insert
    expect(mockDbInsert).toHaveBeenCalled();

    // Restore original mock
    (auth.api.getSession as any) = originalGetSession;
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test src/routes/profile.test.ts`

Expected: FAIL — insert not called (backfill logic doesn't exist yet).

**Step 3: Update the GET handler with backfill logic**

Update the `profileRouter.get("/avatar/history", ...)` handler in `apps/api/src/routes/profile.ts`:

```ts
import { objectExists } from "../lib/s3";

profileRouter.get("/avatar/history", async (c) => {
  const user = c.get("user" as never) as { id: string; image?: string | null } | null;
  if (!user) {
    return c.json({ error: "Autenticação necessária" }, 401);
  }

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
      // URL path: /bucket-name/avatars/userId/timestamp.webp or /avatars/userId/timestamp.webp
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
      // Non-fatal — continue with empty history
    }
  }

  const data = rows.map((row) => ({
    id: row.id,
    url: `/api/v1/avatar/${row.id}`,
    uploadedAt: row.uploadedAt,
    fileSize: row.fileSize,
  }));

  return c.json({ data });
});
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && bun test src/routes/profile.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/routes/profile.ts apps/api/src/routes/profile.test.ts
git commit -m "feat: add lazy backfill for existing avatar presigned URLs"
```

---

## Task 9: Frontend API functions

**Files:**
- Modify: `apps/web/src/lib/api.ts` (update `uploadAvatar`, add new functions)

**Step 1: Update `uploadAvatar` and add new API functions**

Update `apps/web/src/lib/api.ts`. Replace the existing `uploadAvatar` function (lines 12-24) and add new functions after it:

```ts
// ── Profile / Avatar Endpoints ───────────────

export interface AvatarHistoryEntry {
  id: string;
  url: string;
  uploadedAt: string;
  fileSize: number;
}

export async function uploadAvatar(file: Blob): Promise<{ id: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch(`${API_URL}/profile/avatar`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao enviar foto");
  }
  const body = await res.json();
  return body.data;
}

export async function fetchAvatarHistory(): Promise<AvatarHistoryEntry[]> {
  const res = await apiFetch(`${API_URL}/profile/avatar/history`);
  if (!res.ok) throw new Error("Erro ao carregar histórico de fotos");
  const body = await res.json();
  return body.data;
}

export async function restoreAvatar(id: string): Promise<{ id: string; url: string }> {
  const res = await apiFetch(`${API_URL}/profile/avatar/${id}/restore`, {
    method: "PUT",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao restaurar foto");
  }
  const body = await res.json();
  return body.data;
}

export async function deleteAvatar(id: string): Promise<{ deleted: boolean; clearedCurrent: boolean }> {
  const res = await apiFetch(`${API_URL}/profile/avatar/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao excluir foto");
  }
  const body = await res.json();
  return body.data;
}

export async function bulkDeleteAvatars(ids: string[]): Promise<{ deleted: number; clearedCurrent: boolean }> {
  const res = await apiFetch(`${API_URL}/profile/avatar/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao excluir fotos");
  }
  const body = await res.json();
  return body.data;
}
```

**Step 2: Update `AvatarUpload.tsx` to use new response shape**

In `apps/web/src/components/settings/AvatarUpload.tsx`, line 54 currently reads:

```ts
setAvatarUrl(result.image_url);
```

Change to:

```ts
setAvatarUrl(result.url);
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/components/settings/AvatarUpload.tsx
git commit -m "feat: add avatar history API functions, update upload response shape"
```

---

## Task 10: AvatarThumbnail component

**Files:**
- Create: `apps/web/src/components/settings/AvatarThumbnail.tsx`
- Create: `apps/web/src/components/settings/AvatarThumbnail.test.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/components/settings/AvatarThumbnail.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AvatarThumbnail } from "./AvatarThumbnail";

describe("AvatarThumbnail", () => {
  const defaultProps = {
    id: "av-1",
    url: "/api/v1/avatar/av-1",
    isCurrent: false,
    isSelected: false,
    isMultiSelect: false,
    onSelect: vi.fn(),
    onDelete: vi.fn(),
  };

  it("renders the avatar image", () => {
    render(<AvatarThumbnail {...defaultProps} />);
    expect(screen.getByAltText("Avatar av-1")).toBeInTheDocument();
  });

  it("shows a ring when selected", () => {
    const { container } = render(
      <AvatarThumbnail {...defaultProps} isSelected />,
    );
    expect(container.querySelector("[data-selected='true']")).toBeInTheDocument();
  });

  it("shows a ring when current", () => {
    const { container } = render(
      <AvatarThumbnail {...defaultProps} isCurrent />,
    );
    expect(container.querySelector("[data-current='true']")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<AvatarThumbnail {...defaultProps} onSelect={onSelect} />);

    await user.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("av-1");
  });

  it("shows delete button on hover", async () => {
    const user = userEvent.setup();
    render(<AvatarThumbnail {...defaultProps} />);

    const button = screen.getByRole("button");
    await user.hover(button);

    expect(screen.getByLabelText("Excluir avatar")).toBeInTheDocument();
  });

  it("does not show delete button when isCurrent and not hovered", () => {
    render(<AvatarThumbnail {...defaultProps} isCurrent />);
    // Delete button should still appear on hover even for current
    expect(screen.queryByLabelText("Excluir avatar")).not.toBeInTheDocument();
  });

  it("shows checkbox in multi-select mode", () => {
    render(<AvatarThumbnail {...defaultProps} isMultiSelect />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && bunx vitest run src/components/settings/AvatarThumbnail.test.tsx`

Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `apps/web/src/components/settings/AvatarThumbnail.tsx`:

```tsx
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AvatarThumbnailProps {
  id: string;
  url: string;
  isCurrent: boolean;
  isSelected: boolean;
  isMultiSelect: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AvatarThumbnail({
  id,
  url,
  isCurrent,
  isSelected,
  isMultiSelect,
  onSelect,
  onDelete,
}: AvatarThumbnailProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      className={cn(
        "relative h-16 w-16 rounded-full overflow-hidden transition-all",
        "ring-2 ring-offset-2 ring-offset-surface-container-low",
        isSelected
          ? "ring-primary"
          : isCurrent
            ? "ring-secondary"
            : "ring-transparent hover:ring-outline-variant/50",
      )}
      data-selected={isSelected || undefined}
      data-current={isCurrent || undefined}
      onClick={() => onSelect(id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={url}
        alt={`Avatar ${id}`}
        className="h-full w-full object-cover"
      />

      {/* Delete button on hover (not in multi-select mode) */}
      {hovered && !isMultiSelect && (
        <button
          type="button"
          aria-label="Excluir avatar"
          className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-error text-white text-xs shadow-md hover:bg-error/80"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
        >
          ×
        </button>
      )}

      {/* Checkbox in multi-select mode */}
      {isMultiSelect && (
        <div className="absolute top-0.5 right-0.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-white accent-primary"
          />
        </div>
      )}
    </button>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && bunx vitest run src/components/settings/AvatarThumbnail.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/settings/AvatarThumbnail.tsx apps/web/src/components/settings/AvatarThumbnail.test.tsx
git commit -m "feat: add AvatarThumbnail component with selection and delete"
```

---

## Task 11: AvatarHistoryGrid component

**Files:**
- Create: `apps/web/src/components/settings/AvatarHistoryGrid.tsx`
- Create: `apps/web/src/components/settings/AvatarHistoryGrid.test.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/components/settings/AvatarHistoryGrid.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AvatarHistoryGrid } from "./AvatarHistoryGrid";

const mockAvatars = [
  { id: "av-1", url: "/api/v1/avatar/av-1", uploadedAt: "2026-04-01T00:00:00Z", fileSize: 2048 },
  { id: "av-2", url: "/api/v1/avatar/av-2", uploadedAt: "2026-04-02T00:00:00Z", fileSize: 3072 },
  { id: "av-3", url: "/api/v1/avatar/av-3", uploadedAt: "2026-04-03T00:00:00Z", fileSize: 1024 },
];

describe("AvatarHistoryGrid", () => {
  const defaultProps = {
    avatars: mockAvatars,
    currentAvatarId: "av-1",
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    onBulkDelete: vi.fn(),
    isLoading: false,
  };

  it("renders all avatar thumbnails", () => {
    render(<AvatarHistoryGrid {...defaultProps} />);
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(3);
  });

  it("shows empty state when no avatars", () => {
    render(<AvatarHistoryGrid {...defaultProps} avatars={[]} />);
    expect(screen.getByText(/nenhuma foto/i)).toBeInTheDocument();
  });

  it("shows footer with count", () => {
    render(<AvatarHistoryGrid {...defaultProps} />);
    expect(screen.getByText(/3 fotos/i)).toBeInTheDocument();
  });

  it("toggles multi-select mode", async () => {
    const user = userEvent.setup();
    render(<AvatarHistoryGrid {...defaultProps} />);

    const toggleBtn = screen.getByText(/selecionar/i);
    await user.click(toggleBtn);

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("shows bulk delete button with count in multi-select mode", async () => {
    const user = userEvent.setup();
    const onBulkDelete = vi.fn();
    render(<AvatarHistoryGrid {...defaultProps} onBulkDelete={onBulkDelete} />);

    // Enter multi-select mode
    await user.click(screen.getByText(/selecionar/i));

    // Select two thumbnails (click the checkboxes)
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    // Bulk delete button should show count
    const bulkBtn = screen.getByText(/excluir selecionados/i);
    expect(bulkBtn).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && bunx vitest run src/components/settings/AvatarHistoryGrid.test.tsx`

Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `apps/web/src/components/settings/AvatarHistoryGrid.tsx`:

```tsx
import { useState } from "react";
import { AvatarThumbnail } from "./AvatarThumbnail";
import type { AvatarHistoryEntry } from "@/lib/api";

interface AvatarHistoryGridProps {
  avatars: AvatarHistoryEntry[];
  currentAvatarId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  isLoading: boolean;
}

export function AvatarHistoryGrid({
  avatars,
  currentAvatarId,
  onSelect,
  onDelete,
  onBulkDelete,
  isLoading,
}: AvatarHistoryGridProps) {
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [singleSelectedId, setSingleSelectedId] = useState<string | null>(null);

  function handleSelect(id: string) {
    if (isMultiSelect) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    } else {
      setSingleSelectedId(id);
      onSelect(id);
    }
  }

  function handleToggleMultiSelect() {
    setIsMultiSelect((prev) => !prev);
    setSelectedIds(new Set());
  }

  function handleBulkDelete() {
    if (selectedIds.size > 0) {
      onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsMultiSelect(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 p-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-16 w-16 animate-pulse rounded-full bg-surface-container-high"
          />
        ))}
      </div>
    );
  }

  if (avatars.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-sm text-outline">
          Nenhuma foto no historico. Envie sua primeira foto!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
        {avatars.map((avatar) => (
          <div key={avatar.id} className="flex justify-center">
            <AvatarThumbnail
              id={avatar.id}
              url={avatar.url}
              isCurrent={avatar.id === currentAvatarId}
              isSelected={
                isMultiSelect
                  ? selectedIds.has(avatar.id)
                  : singleSelectedId === avatar.id
              }
              isMultiSelect={isMultiSelect}
              onSelect={handleSelect}
              onDelete={onDelete}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-outline-variant/20 pt-3">
        {isMultiSelect ? (
          <>
            <button
              type="button"
              onClick={handleToggleMultiSelect}
              className="text-xs text-outline hover:text-on-surface transition-colors"
            >
              Cancelar seleção
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className="text-xs font-medium text-error hover:text-error/80 disabled:opacity-50 transition-colors"
            >
              Excluir selecionados ({selectedIds.size})
            </button>
          </>
        ) : (
          <>
            <span className="text-xs text-outline">{avatars.length} fotos</span>
            <button
              type="button"
              onClick={handleToggleMultiSelect}
              className="text-xs text-outline hover:text-on-surface transition-colors"
            >
              Selecionar vários
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && bunx vitest run src/components/settings/AvatarHistoryGrid.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/settings/AvatarHistoryGrid.tsx apps/web/src/components/settings/AvatarHistoryGrid.test.tsx
git commit -m "feat: add AvatarHistoryGrid with multi-select and empty state"
```

---

## Task 12: AvatarPickerModal component

**Files:**
- Create: `apps/web/src/components/settings/AvatarPickerModal.tsx`
- Create: `apps/web/src/components/settings/AvatarPickerModal.test.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/components/settings/AvatarPickerModal.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AvatarPickerModal } from "./AvatarPickerModal";

// Mock the api module
vi.mock("@/lib/api", () => ({
  fetchAvatarHistory: vi.fn(() => Promise.resolve([])),
  restoreAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
  bulkDeleteAvatars: vi.fn(),
  uploadAvatar: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { $store: { notify: vi.fn() } },
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("AvatarPickerModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    currentAvatarId: null,
    session: {
      user: { name: "Gabriel", email: "gabriel@woli.com", image: null },
    },
  };

  it("renders with History tab active by default", () => {
    render(<AvatarPickerModal {...defaultProps} />, { wrapper: createWrapper() });
    expect(screen.getByText("Alterar foto de perfil")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /histórico/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches to Upload tab when clicked", async () => {
    const user = userEvent.setup();
    render(<AvatarPickerModal {...defaultProps} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("tab", { name: /enviar nova/i }));

    expect(screen.getByRole("tab", { name: /enviar nova/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("calls onClose when X button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AvatarPickerModal {...defaultProps} onClose={onClose} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByLabelText("Fechar"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not render when isOpen is false", () => {
    render(<AvatarPickerModal {...defaultProps} isOpen={false} />, {
      wrapper: createWrapper(),
    });
    expect(screen.queryByText("Alterar foto de perfil")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && bunx vitest run src/components/settings/AvatarPickerModal.test.tsx`

Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `apps/web/src/components/settings/AvatarPickerModal.tsx`:

```tsx
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "@/lib/crop-image";
import { authClient } from "@/lib/auth-client";
import {
  fetchAvatarHistory,
  uploadAvatar,
  restoreAvatar,
  deleteAvatar,
  bulkDeleteAvatars,
} from "@/lib/api";
import { AvatarHistoryGrid } from "./AvatarHistoryGrid";
import type { CroppedArea } from "@/lib/crop-image";

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarId: string | null;
  session: {
    user: {
      name: string | null;
      email: string;
      image?: string | null;
    };
  };
}

type Tab = "history" | "upload";

export function AvatarPickerModal({
  isOpen,
  onClose,
  currentAvatarId,
  session,
}: AvatarPickerModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("history");
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Upload tab state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedArea | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ["avatar-history"],
    queryFn: fetchAvatarHistory,
    staleTime: 30_000,
    enabled: isOpen,
  });

  const restoreMutation = useMutation({
    mutationFn: restoreAvatar,
    onSuccess: () => {
      authClient.$store.notify("$sessionSignal");
      queryClient.invalidateQueries({ queryKey: ["avatar-history"] });
      toast.success("Foto de perfil atualizada!");
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao restaurar foto");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAvatar,
    onSuccess: (result) => {
      if (result.clearedCurrent) {
        authClient.$store.notify("$sessionSignal");
      }
      queryClient.invalidateQueries({ queryKey: ["avatar-history"] });
      toast.success("Foto excluída");
      setConfirmDeleteId(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir foto");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteAvatars,
    onSuccess: (result) => {
      if (result.clearedCurrent) {
        authClient.$store.notify("$sessionSignal");
      }
      queryClient.invalidateQueries({ queryKey: ["avatar-history"] });
      toast.success(`${result.deleted} foto(s) excluída(s)`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir fotos");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      authClient.$store.notify("$sessionSignal");
      queryClient.invalidateQueries({ queryKey: ["avatar-history"] });
      toast.success("Foto de perfil atualizada!");
      setImageSrc(null);
      setActiveTab("history");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar foto");
    },
  });

  if (!isOpen) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  function handleCropComplete(_: unknown, pixels: CroppedArea) {
    setCroppedAreaPixels(pixels);
  }

  async function handleConfirmCrop() {
    if (!imageSrc || !croppedAreaPixels) return;
    const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
    uploadMutation.mutate(croppedBlob);
  }

  function handleSelectAvatar(id: string) {
    setSelectedAvatarId(id);
  }

  function handleSaveSelection() {
    if (selectedAvatarId && selectedAvatarId !== currentAvatarId) {
      restoreMutation.mutate(selectedAvatarId);
    }
  }

  function handleDeleteAvatar(id: string) {
    if (id === currentAvatarId) {
      setConfirmDeleteId(id);
    } else {
      deleteMutation.mutate(id);
    }
  }

  function handleConfirmDeleteCurrent() {
    if (confirmDeleteId) {
      deleteMutation.mutate(confirmDeleteId);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl bg-surface-container-low shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm font-bold text-on-surface">Alterar foto de perfil</h3>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full text-outline hover:bg-surface-container-high transition-colors"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant/20 px-4" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-outline hover:text-on-surface"
            }`}
          >
            Histórico
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "upload"}
            onClick={() => setActiveTab("upload")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "upload"
                ? "border-primary text-primary"
                : "border-transparent text-outline hover:text-on-surface"
            }`}
          >
            Enviar nova
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "history" && (
          <>
            <AvatarHistoryGrid
              avatars={historyQuery.data ?? []}
              currentAvatarId={currentAvatarId}
              onSelect={handleSelectAvatar}
              onDelete={handleDeleteAvatar}
              onBulkDelete={(ids) => bulkDeleteMutation.mutate(ids)}
              isLoading={historyQuery.isLoading}
            />

            {/* Save button (only when a different avatar is selected) */}
            {selectedAvatarId && selectedAvatarId !== currentAvatarId && (
              <div className="flex justify-end gap-2 px-4 pb-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSelection}
                  disabled={restoreMutation.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {restoreMutation.isPending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "upload" && (
          <div className="p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {!imageSrc ? (
              <div className="flex flex-col items-center justify-center py-8">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:bg-primary/90 transition-colors"
                >
                  Escolher arquivo
                </button>
              </div>
            ) : (
              <>
                <div className="relative h-64 w-full rounded-lg overflow-hidden bg-black">
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={handleCropComplete}
                  />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-outline">Zoom</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1"
                  />
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImageSrc(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="rounded-lg px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCrop}
                    disabled={uploadMutation.isPending}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {uploadMutation.isPending ? "Enviando..." : "Salvar"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Confirm delete current avatar dialog */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
            <div className="w-full max-w-xs rounded-xl bg-surface-container-low p-4 shadow-xl">
              <p className="text-sm text-on-surface">
                Esta é sua foto atual. Ao excluir, seu perfil usará suas iniciais. Continuar?
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCurrent}
                  disabled={deleteMutation.isPending}
                  className="rounded-lg bg-error px-3 py-1.5 text-sm font-bold text-white hover:bg-error/90 disabled:opacity-50 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && bunx vitest run src/components/settings/AvatarPickerModal.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/settings/AvatarPickerModal.tsx apps/web/src/components/settings/AvatarPickerModal.test.tsx
git commit -m "feat: add AvatarPickerModal with history/upload tabs and mutations"
```

---

## Task 13: Integrate AvatarPickerModal into AvatarUpload

Replace the direct file picker trigger with the modal.

**Files:**
- Modify: `apps/web/src/components/settings/AvatarUpload.tsx`

**Step 1: Rewrite AvatarUpload to use AvatarPickerModal**

Replace the entire contents of `apps/web/src/components/settings/AvatarUpload.tsx`:

```tsx
import { useState, useEffect } from "react";
import { AvatarPickerModal } from "./AvatarPickerModal";

interface AvatarUploadProps {
  session: {
    user: {
      name: string | null;
      email: string;
      image?: string | null;
      [key: string]: unknown;
    };
  };
}

export function AvatarUpload({ session }: AvatarUploadProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const initials = session.user.name?.slice(0, 2).toUpperCase() || "U";
  const avatarUrl = session.user.image ?? null;

  // Extract current avatar ID from proxy URL
  const currentAvatarId = avatarUrl?.match(/\/api\/v1\/avatar\/(.+)/)?.[1] ?? null;

  // Reset image loaded state when URL changes
  useEffect(() => {
    setImageLoaded(false);
  }, [avatarUrl]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar display */}
      <div className="relative">
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-20 w-20 rounded-full object-cover border-2 border-outline-variant/30"
            style={{ display: imageLoaded ? "block" : "none" }}
            onLoad={() => setImageLoaded(true)}
          />
        )}
        {(!avatarUrl || !imageLoaded) && (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-lg font-bold text-white">
            {initials}
          </div>
        )}
      </div>

      {/* Trigger button — opens modal instead of file picker */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        Alterar foto
      </button>

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentAvatarId={currentAvatarId}
        session={session}
      />
    </div>
  );
}
```

Note: This also applies the `onLoad` gate pattern from the previous fix, so the settings page avatar has the same smooth loading behavior as the header.

**Step 2: Run existing AvatarUpload tests (if any) + the full settings test suite**

Run: `cd apps/web && bunx vitest run src/components/settings/`

Expected: All tests PASS. If existing AvatarUpload tests break because the crop modal is no longer inline, update or remove those tests since the crop logic now lives inside AvatarPickerModal.

**Step 3: Commit**

```bash
git add apps/web/src/components/settings/AvatarUpload.tsx
git commit -m "feat: replace direct file picker with AvatarPickerModal in AvatarUpload"
```

---

## Task 14: Wrap AvatarUpload in QueryClientProvider

The `AvatarPickerModal` uses React Query, so `AvatarUpload` needs a `QueryClientProvider` ancestor. Check if the settings page already has one (likely via the app-level provider in `App.tsx`).

**Files:**
- Check: `apps/web/src/App.tsx` — look for `QueryClientProvider`

If `QueryClientProvider` is already at the app root, no changes needed. If not, wrap the settings page or `AvatarUpload` with one.

**Step 1: Verify QueryClientProvider exists at app root**

Read `apps/web/src/App.tsx` and check for `QueryClientProvider`.

**Step 2: If missing, add it**

This is a conditional step. If the provider already exists, skip to commit.

**Step 3: Commit (if changes made)**

```bash
git add apps/web/src/App.tsx
git commit -m "chore: ensure QueryClientProvider wraps settings page"
```

---

## Task 15: Final integration test — full flow

**Files:**
- Run all backend tests: `cd apps/api && bun test`
- Run all frontend tests: `cd apps/web && bunx vitest run`

**Step 1: Run all backend tests**

Run: `cd apps/api && bun test`

Expected: All tests PASS. If any test fails, debug and fix.

**Step 2: Run all frontend tests**

Run: `cd apps/web && bunx vitest run`

Expected: All tests PASS. Fix any failures.

**Step 3: Manual verification checklist**

1. Start backend: `cd apps/api && bun run dev`
2. Start frontend: `cd apps/web && bun run dev`
3. Navigate to Settings → Profile
4. Click "Alterar foto" → Modal opens with History tab (empty state for new users)
5. Switch to Upload tab → pick image → crop → save → toast appears → History tab now shows the avatar
6. Upload a second avatar → History tab shows 2 thumbnails
7. Click a historical thumbnail → click "Salvar" → header avatar updates
8. Hover a thumbnail → "X" appears → click → avatar deleted (verify S3 object removed)
9. Click "Selecionar vários" → check 2 thumbnails → "Excluir selecionados (2)" → confirm → both deleted
10. Hard reload → avatar URL is permanent (no broken image from expired presigned URL)

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete avatar history feature with picker modal and proxy URLs"
```

---

## Task Dependencies

```
Task 1 (Schema)
  ├── Task 2 (Proxy route)      ── independent
  ├── Task 3 (History listing)  ── independent
  ├── Task 4 (Upload modify)    ── depends on 3
  ├── Task 5 (Restore)          ── independent
  ├── Task 6 (Delete)           ── independent
  ├── Task 7 (Bulk delete)      ── depends on 6
  └── Task 8 (Lazy backfill)    ── depends on 3
Task 9 (Frontend API)           ── depends on 4-7
Task 10 (Thumbnail)             ── independent of backend
Task 11 (History grid)          ── depends on 10
Task 12 (Picker modal)          ── depends on 9, 11
Task 13 (Integration)           ── depends on 12
Task 14 (QueryProvider check)   ── depends on 12
Task 15 (Final test)            ── depends on all
```

**Parallelizable groups after Task 1:**
- Group A (backend): Tasks 2, 3, 5, 6 can run in parallel
- Group B (backend sequential): Task 4 after 3, Task 7 after 6, Task 8 after 3
- Group C (frontend): Tasks 10, 9 can start in parallel
- Group D (frontend sequential): 11 → 12 → 13 → 14
