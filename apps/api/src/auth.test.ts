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
});
