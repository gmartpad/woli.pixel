import { describe, test, expect, mock, beforeEach } from "bun:test";

// --- Mock dependencies ---

const mockStoreAvatar = mock(async () => "avatars/user-123/1234567890.webp");
const mockCreatePresignedDownloadUrl = mock(
  async () => "https://s3.amazonaws.com/avatar-presigned-url",
);

mock.module("../services/storage", () => ({
  storeAvatar: mockStoreAvatar,
}));

mock.module("../lib/s3", () => ({
  createPresignedDownloadUrl: mockCreatePresignedDownloadUrl,
  uploadToS3: mock(async () => {}),
  downloadFromS3: mock(async () => Buffer.from("")),
  batchDeleteObjects: mock(async () => {}),
  objectExists: mock(async () => false),
  deleteFromS3: mock(async () => {}),
  s3Client: {},
  BUCKET: "test-bucket",
}));

const mockSharpInstance = {
  resize: mock(function (this: any) { return this; }),
  webp: mock(function (this: any) { return this; }),
  toBuffer: mock(async () => Buffer.from("resized-webp-data")),
};

mock.module("sharp", () => ({
  default: mock(() => mockSharpInstance),
}));

const mockSetCookieValue = "better-auth.session_data=eyJ1c2VyIjp7ImltYWdlIjoiaHR0cHM6Ly9zMy5hbWF6b25hd3MuY29tL2F2YXRhci1wcmVzaWduZWQtdXJsIn19; Path=/; HttpOnly; SameSite=Lax";
const mockUpdateUser = mock(async () => {
  const headers = new Headers();
  headers.append("Set-Cookie", mockSetCookieValue);
  return { headers, response: { user: { id: "user-123" } } };
});

mock.module("../auth", () => ({
  auth: {
    api: {
      getSession: mock(async ({ headers }: { headers: Headers }) => {
        const authHeader = headers.get("cookie");
        if (!authHeader) return null;
        return {
          user: { id: "user-123", name: "Gabriel", email: "gabriel@woli.com" },
          session: { id: "session-123" },
        };
      }),
      updateUser: mockUpdateUser,
    },
  },
  Session: {},
}));

const mockAvatarHistoryRows: any[] = [];
const mockDbQuery = {
  from: mock(() => ({
    where: mock(() => ({
      orderBy: mock(() => Promise.resolve(mockAvatarHistoryRows)),
    })),
  })),
};
const mockDbSelect = mock(() => mockDbQuery);
const mockDbDelete = mock(() => ({
  where: mock(() => Promise.resolve()),
}));

mock.module("../db", () => ({
  db: {
    select: mockDbSelect,
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

const { profileRouter } = await import("./profile");

import { Hono } from "hono";

const app = new Hono();

// Inline auth middleware for test (mirrors requireAuth behavior)
app.use("/api/v1/profile/*", async (c, next) => {
  const { auth } = await import("../auth");
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Autenticação necessária" }, 401);
  c.set("user" as never, session.user);
  c.set("session" as never, session.session);
  return next();
});

app.route("/api/v1/profile", profileRouter);

// --- Helper: create a tiny valid PNG buffer ---
function createTestPngBlob(): Blob {
  // Minimal 1x1 red PNG
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  return new Blob([pngBytes], { type: "image/png" });
}

// --- Tests ---

beforeEach(() => {
  mockStoreAvatar.mockClear();
  mockCreatePresignedDownloadUrl.mockClear();
  mockUpdateUser.mockClear();
  mockSharpInstance.resize.mockClear();
  mockSharpInstance.webp.mockClear();
  mockSharpInstance.toBuffer.mockClear();
});

describe("POST /api/v1/profile/avatar", () => {
  test("returns 401 when not authenticated", async () => {
    const formData = new FormData();
    formData.append("file", createTestPngBlob(), "avatar.png");

    const res = await app.request("/api/v1/profile/avatar", {
      method: "POST",
      body: formData,
      // No cookie header → unauthenticated
    });

    expect(res.status).toBe(401);
  });

  test("returns 400 when no file is provided", async () => {
    const formData = new FormData();

    const res = await app.request("/api/v1/profile/avatar", {
      method: "POST",
      body: formData,
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("arquivo");
  });

  test("returns 400 for non-image MIME type", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob(["not-an-image"], { type: "application/pdf" }),
      "doc.pdf",
    );

    const res = await app.request("/api/v1/profile/avatar", {
      method: "POST",
      body: formData,
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("imagem");
  });

  test("returns 400 for files exceeding 2MB", async () => {
    const largeBlob = new Blob([new Uint8Array(2.5 * 1024 * 1024)], {
      type: "image/png",
    });
    const formData = new FormData();
    formData.append("file", largeBlob, "huge.png");

    const res = await app.request("/api/v1/profile/avatar", {
      method: "POST",
      body: formData,
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("2MB");
  });

  test("processes image with Sharp, uploads to S3, updates user, and returns URL", async () => {
    const formData = new FormData();
    formData.append("file", createTestPngBlob(), "avatar.png");

    const res = await app.request("/api/v1/profile/avatar", {
      method: "POST",
      body: formData,
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.image_url).toBe("https://s3.amazonaws.com/avatar-presigned-url");

    // Sharp called with 256x256 cover resize + webp
    expect(mockSharpInstance.resize).toHaveBeenCalledWith(256, 256, {
      fit: "cover",
    });
    expect(mockSharpInstance.webp).toHaveBeenCalledWith({ quality: 85 });
    expect(mockSharpInstance.toBuffer).toHaveBeenCalledTimes(1);

    // S3 storage called
    expect(mockStoreAvatar).toHaveBeenCalledTimes(1);
    expect(mockStoreAvatar.mock.calls[0][0]).toBe("user-123");

    // Presigned URL generated
    expect(mockCreatePresignedDownloadUrl).toHaveBeenCalledTimes(1);

    // User updated via better-auth with returnHeaders
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    const updateCall = mockUpdateUser.mock.calls[0][0];
    expect(updateCall.body.image).toBe(
      "https://s3.amazonaws.com/avatar-presigned-url",
    );
    expect(updateCall.returnHeaders).toBe(true);
  });

  test("forwards Set-Cookie headers from better-auth to the client", async () => {
    const formData = new FormData();
    formData.append("file", createTestPngBlob(), "avatar.png");

    const res = await app.request("/api/v1/profile/avatar", {
      method: "POST",
      body: formData,
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(200);

    const setCookieHeader = res.headers.getSetCookie();
    expect(setCookieHeader.length).toBeGreaterThan(0);
    expect(setCookieHeader[0]).toContain("better-auth.session_data");
  });
});

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
      { id: "av-1", userId: "user-123", s3Key: "avatars/user-123/111.webp", fileSize: 2048, width: 256, height: 256, uploadedAt: new Date("2026-04-01") },
      { id: "av-2", userId: "user-123", s3Key: "avatars/user-123/222.webp", fileSize: 3072, width: 256, height: 256, uploadedAt: new Date("2026-04-02") },
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

describe("PUT /api/v1/profile/avatar/:id/restore", () => {
  test("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/v1/profile/avatar/av-1/restore", { method: "PUT" });
    expect(res.status).toBe(401);
  });

  test("returns 404 when avatar doesn't exist or belongs to another user", async () => {
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
        where: mock(() => Promise.resolve([
          { id: "av-old", userId: "user-123", s3Key: "avatars/user-123/old.webp" },
        ])),
      })),
    });

    const res = await app.request("/api/v1/profile/avatar/av-old/restore", {
      method: "PUT",
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.url).toBe("/api/v1/avatar/av-old");
    expect(mockUpdateUser).toHaveBeenCalled();
    const updateCall = mockUpdateUser.mock.calls[mockUpdateUser.mock.calls.length - 1][0];
    expect(updateCall.body.image).toBe("/api/v1/avatar/av-old");
  });
});
