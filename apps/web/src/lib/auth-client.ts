import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

const TOKEN_KEY = "woli_pixel_auth_token";

export function getAuthToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export const authClient = createAuthClient({
  baseURL: (import.meta.env.VITE_API_URL || "http://localhost:3000").replace("/api/v1", ""),
  plugins: [usernameClient()],
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: getAuthToken,
    },
    onSuccess: (ctx) => {
      const authToken = ctx.response.headers.get("set-auth-token");
      if (authToken) {
        setAuthToken(authToken);
      }
    },
  },
});

export const { useSession, signIn, signUp, signOut } = authClient;
