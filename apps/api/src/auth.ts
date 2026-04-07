import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, bearer } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "./db";
import * as schema from "./db/auth-schema";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@woli.com.br";

const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: [
    ...(process.env.TRUSTED_ORIGINS || "http://localhost:5173").split(","),
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      if (!resend) return;
      try {
        await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: "Woli Pixel — Redefinir senha",
          html: `<p>Olá ${user.name},</p><p><a href="${url}">Clique aqui para redefinir sua senha</a></p>`,
        });
      } catch (error) {
        console.error("[auth] Failed to send reset password email:", error);
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (!resend) return;
      // Replace default callbackURL to redirect to frontend after verification
      const verificationUrl = new URL(url);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      verificationUrl.searchParams.set(
        "callbackURL",
        `${frontendUrl}?verified=true`
      );
      try {
        await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: "Woli Pixel — Verificar e-mail",
          html: `<p>Olá ${user.name},</p><p><a href="${verificationUrl.toString()}">Clique aqui para verificar seu e-mail</a></p>`,
        });
      } catch (error) {
        console.error("[auth] Failed to send verification email:", error);
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  plugins: [
    username(),
    bearer(),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  advanced: {
    defaultCookieAttributes: isProduction
      ? { sameSite: "none", secure: true, partitioned: true }
      : { sameSite: "lax", secure: false },
  },
});

export type Session = typeof auth.$Infer.Session;
