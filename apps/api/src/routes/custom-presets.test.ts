import { describe, test, expect, mock, beforeEach } from "bun:test";

// ── Mock auth ────────────────────────────────────────────────────
mock.module("../auth", () => ({
  auth: {
    api: {
      getSession: mock(async ({ headers }: { headers: Headers }) => {
        const cookie = headers.get("cookie");
        if (!cookie) return null;
        return {
          user: { id: "user-123", name: "Gabriel", email: "gabriel@woli.com" },
          session: { id: "session-123" },
        };
      }),
    },
  },
  Session: {},
}));

// ── Mock DB ──────────────────────────────────────────────────────
let insertedRows: any[] = [];
let selectRows: any[] = [];
let deletedCount = 0;

const mockInsert = mock(() => ({
  values: mock((vals: any) => ({
    returning: mock(async () => {
      const row = {
        id: "preset-new-id",
        userId: "user-123",
        name: vals.name,
        width: vals.width,
        height: vals.height,
        style: vals.style ?? "auto",
        outputFormat: vals.outputFormat ?? "png",
        maxFileSizeKb: vals.maxFileSizeKb ?? 500,
        requiresTransparency: vals.requiresTransparency ?? false,
        promptContext: vals.promptContext ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      insertedRows.push(row);
      return [row];
    }),
  })),
}));

const mockSelect = mock(() => ({
  from: mock(() => ({
    where: mock(() => {
      // The result of .where() must be both thenable (for PUT: await db.select().from().where())
      // AND have .orderBy() (for GET: db.select().from().where().orderBy())
      const result = Promise.resolve(selectRows) as any;
      result.orderBy = mock(async () => selectRows);
      return result;
    }),
    orderBy: mock(async () => selectRows),
  })),
}));

const mockUpdate = mock(() => ({
  set: mock(() => ({
    where: mock(() => ({
      returning: mock(async () => {
        if (selectRows.length === 0) return [];
        return [{ ...selectRows[0], updatedAt: new Date() }];
      }),
    })),
  })),
}));

const mockDelete = mock(() => ({
  where: mock(() => ({
    returning: mock(async () => {
      if (deletedCount === 0) return [];
      return [{ id: "preset-del-id" }];
    }),
  })),
}));

mock.module("../db", () => ({
  db: {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

mock.module("../db/schema", () => ({
  customPresets: {
    id: "id",
    userId: "user_id",
    name: "name",
    width: "width",
    height: "height",
    style: "style",
    outputFormat: "output_format",
    maxFileSizeKb: "max_file_size_kb",
    requiresTransparency: "requires_transparency",
    promptContext: "prompt_context",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}));

// Import AFTER mocking
const { customPresetsRouter } = await import("./custom-presets");

import { Hono } from "hono";

const app = new Hono();

// Inline auth middleware (mirrors requireAuth)
app.use("/api/v1/custom-presets/*", async (c, next) => {
  const { auth } = await import("../auth");
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Autenticacao necessaria" }, 401);
  c.set("user" as never, session.user);
  c.set("session" as never, session.session);
  return next();
});

app.route("/api/v1/custom-presets", customPresetsRouter);

// ── Helpers ──────────────────────────────────────────────────────
function validPresetBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Banner Social",
    width: 1200,
    height: 630,
    ...overrides,
  };
}

// ── Reset mocks ──────────────────────────────────────────────────
beforeEach(() => {
  insertedRows = [];
  selectRows = [];
  deletedCount = 0;
  mockInsert.mockClear();
  mockSelect.mockClear();
  mockUpdate.mockClear();
  mockDelete.mockClear();
});

// ══════════════════════════════════════════════════════════════════
// POST /api/v1/custom-presets
// ══════════════════════════════════════════════════════════════════
describe("POST /api/v1/custom-presets", () => {
  test("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/v1/custom-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPresetBody()),
    });
    expect(res.status).toBe(401);
  });

  test("returns 201 with preset data on valid input", async () => {
    const res = await app.request("/api/v1/custom-presets", {
      method: "POST",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validPresetBody()),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe("Banner Social");
    expect(body.data.width).toBe(1200);
    expect(body.data.height).toBe(630);
    expect(body.data.style).toBe("auto");
    expect(body.data.outputFormat).toBe("png");
  });

  test("rejects missing name", async () => {
    const res = await app.request("/api/v1/custom-presets", {
      method: "POST",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validPresetBody({ name: "" })),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("rejects width < 16", async () => {
    const res = await app.request("/api/v1/custom-presets", {
      method: "POST",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validPresetBody({ width: 10 })),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("rejects width > 4096", async () => {
    const res = await app.request("/api/v1/custom-presets", {
      method: "POST",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validPresetBody({ width: 5000 })),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("rejects height < 16", async () => {
    const res = await app.request("/api/v1/custom-presets", {
      method: "POST",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validPresetBody({ height: 8 })),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("rejects height > 4096", async () => {
    const res = await app.request("/api/v1/custom-presets", {
      method: "POST",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validPresetBody({ height: 5000 })),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("rejects megapixels > 4.2 (e.g. 4096x4096)", async () => {
    const res = await app.request("/api/v1/custom-presets", {
      method: "POST",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validPresetBody({ width: 4096, height: 4096 })),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("megapixels");
  });

  test("accepts exactly 4.2MP (e.g. 2100x2000)", async () => {
    const res = await app.request("/api/v1/custom-presets", {
      method: "POST",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validPresetBody({ width: 2100, height: 2000 })),
    });

    expect(res.status).toBe(201);
  });

  test("rejects invalid style", async () => {
    const res = await app.request("/api/v1/custom-presets", {
      method: "POST",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validPresetBody({ style: "watercolor" })),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("rejects invalid output_format", async () => {
    const res = await app.request("/api/v1/custom-presets", {
      method: "POST",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validPresetBody({ output_format: "tiff" })),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("rejects non-integer width", async () => {
    const res = await app.request("/api/v1/custom-presets", {
      method: "POST",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validPresetBody({ width: 100.5 })),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("rejects non-integer height", async () => {
    const res = await app.request("/api/v1/custom-presets", {
      method: "POST",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validPresetBody({ height: 99.9 })),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════
// GET /api/v1/custom-presets
// ══════════════════════════════════════════════════════════════════
describe("GET /api/v1/custom-presets", () => {
  test("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/v1/custom-presets");
    expect(res.status).toBe(401);
  });

  test("returns empty array when user has no presets", async () => {
    selectRows = [];
    const res = await app.request("/api/v1/custom-presets", {
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  test("returns user presets ordered by createdAt", async () => {
    selectRows = [
      { id: "p1", userId: "user-123", name: "Preset A", width: 800, height: 600, createdAt: new Date() },
      { id: "p2", userId: "user-123", name: "Preset B", width: 1024, height: 768, createdAt: new Date() },
    ];

    const res = await app.request("/api/v1/custom-presets", {
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });
});

// ══════════════════════════════════════════════════════════════════
// PUT /api/v1/custom-presets/:id
// ══════════════════════════════════════════════════════════════════
describe("PUT /api/v1/custom-presets/:id", () => {
  test("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/v1/custom-presets/some-id", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent preset", async () => {
    selectRows = [];
    const res = await app.request("/api/v1/custom-presets/nonexistent-id", {
      method: "PUT",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Updated" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("updates preset and returns updated data", async () => {
    selectRows = [
      {
        id: "preset-123",
        userId: "user-123",
        name: "Old Name",
        width: 800,
        height: 600,
        style: "auto",
        outputFormat: "png",
        maxFileSizeKb: 500,
        requiresTransparency: false,
        promptContext: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const res = await app.request("/api/v1/custom-presets/preset-123", {
      method: "PUT",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "New Name" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
  });

  test("re-validates dimensions if changed", async () => {
    selectRows = [
      {
        id: "preset-123",
        userId: "user-123",
        name: "Preset",
        width: 800,
        height: 600,
        style: "auto",
        outputFormat: "png",
        maxFileSizeKb: 500,
        requiresTransparency: false,
        promptContext: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const res = await app.request("/api/v1/custom-presets/preset-123", {
      method: "PUT",
      headers: {
        cookie: "auth-session=valid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ width: 5000 }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════
// DELETE /api/v1/custom-presets/:id
// ══════════════════════════════════════════════════════════════════
describe("DELETE /api/v1/custom-presets/:id", () => {
  test("returns 401 when not authenticated", async () => {
    const res = await app.request("/api/v1/custom-presets/some-id", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent preset", async () => {
    deletedCount = 0;
    const res = await app.request("/api/v1/custom-presets/nonexistent-id", {
      method: "DELETE",
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test("deletes preset and returns { deleted: true }", async () => {
    deletedCount = 1;
    const res = await app.request("/api/v1/custom-presets/preset-del-id", {
      method: "DELETE",
      headers: { cookie: "auth-session=valid" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
  });
});
