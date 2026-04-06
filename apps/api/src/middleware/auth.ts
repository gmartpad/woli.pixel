import { createMiddleware } from "hono/factory";
import { auth, type Session } from "../auth";

type AuthEnv = {
  Variables: {
    user: Session["user"] | null;
    session: Session["session"] | null;
  };
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Autenticação necessária" }, 401);
  }

  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});
