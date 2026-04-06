import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { requireAuth } from "./auth";

describe("requireAuth middleware", () => {
  test("returns 401 when no session cookie is present", async () => {
    const app = new Hono();
    app.use("*", requireAuth);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBeDefined();
  });
});
