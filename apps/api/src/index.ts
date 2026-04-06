import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";
import { requireAuth } from "./middleware/auth";
import { imageTypesRouter } from "./routes/image-types";
import { imagesRouter } from "./routes/images";
import { batchesRouter } from "./routes/batches";
import { brandsRouter } from "./routes/brands";
import { auditsRouter } from "./routes/audits";
import { qualityGatesRouter } from "./routes/quality-gates";
import { generationCostRouter } from "./routes/generation-cost";
import { generateRouter } from "./routes/generate";
import { profileRouter } from "./routes/profile";
import { avatarRouter } from "./routes/avatar";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors({
  origin: process.env.NODE_ENV === "production"
    ? (process.env.CORS_ORIGIN || "*").split(",")
    : ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

// Auth routes (must be BEFORE other routes)
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// Health check (public)
app.get("/api/v1/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  });
});

// Public routes
app.route("/api/v1/image-types", imageTypesRouter);
app.route("/api/v1/generation-cost", generationCostRouter);

// Protected routes — require auth middleware
app.use("/api/v1/images/*", requireAuth);
app.use("/api/v1/batches/*", requireAuth);
app.use("/api/v1/brands/*", requireAuth);
app.use("/api/v1/audits/*", requireAuth);
app.use("/api/v1/quality-gates/*", requireAuth);
app.use("/api/v1/generate/*", requireAuth);
app.use("/api/v1/profile/*", requireAuth);

app.route("/api/v1/images", imagesRouter);
app.route("/api/v1/batches", batchesRouter);
app.route("/api/v1/brands", brandsRouter);
app.route("/api/v1/audits", auditsRouter);
app.route("/api/v1/quality-gates", qualityGatesRouter);
app.route("/api/v1/generate", generateRouter);
app.route("/api/v1/profile", profileRouter);
app.route("/api/v1/avatar", avatarRouter);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Rota não encontrada" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json({ error: "Erro interno do servidor" }, 500);
});

const port = parseInt(process.env.PORT || "3000");
console.log(`🚀 Woli Pixel API running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
