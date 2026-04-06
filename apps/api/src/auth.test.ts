import { describe, test, expect } from "bun:test";
import { auth } from "./auth";

describe("auth config", () => {
  test("auth instance is defined and has handler", () => {
    expect(auth).toBeDefined();
    expect(auth.handler).toBeInstanceOf(Function);
  });

  test("auth has api methods for session management", () => {
    expect(auth.api.getSession).toBeInstanceOf(Function);
  });

  test("deleteUser is explicitly enabled in config", () => {
    // better-auth registers the /delete-user route always, but returns 404
    // inside the handler if user.deleteUser.enabled is not true.
    // This test ensures the config flag is set so the route actually works.
    const options = (auth as any).options;
    expect(options.user?.deleteUser?.enabled).toBe(true);
  });
});
