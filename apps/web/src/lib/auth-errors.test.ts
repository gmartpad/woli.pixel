import { describe, it, expect } from "vitest";
import { translateAuthError } from "./auth-errors";

describe("translateAuthError", () => {
  it("translates 'Invalid email or password'", () => {
    expect(translateAuthError("Invalid email or password")).toBe(
      "E-mail ou senha inválidos"
    );
  });

  it("translates 'User already exists'", () => {
    expect(translateAuthError("User already exists")).toBe(
      "Este e-mail já está em uso"
    );
  });

  it("translates 'Email not verified'", () => {
    expect(translateAuthError("Email not verified")).toBe(
      "E-mail não verificado"
    );
  });

  it("translates 'Password too short'", () => {
    expect(translateAuthError("Password too short")).toBe(
      "Senha muito curta"
    );
  });

  it("translates 'Invalid token'", () => {
    expect(translateAuthError("Invalid token")).toBe("Token inválido");
  });

  it("translates 'Token expired'", () => {
    expect(translateAuthError("Token expired")).toBe("Token expirado");
  });

  it("translates 'User not found'", () => {
    expect(translateAuthError("User not found")).toBe(
      "Usuário não encontrado"
    );
  });

  it("translates 'Too many requests. Please try again later.'", () => {
    expect(
      translateAuthError("Too many requests. Please try again later.")
    ).toBe("Muitas tentativas. Tente novamente mais tarde.");
  });

  it("returns the original message when no translation exists", () => {
    expect(translateAuthError("Some unknown error")).toBe(
      "Some unknown error"
    );
  });

  it("returns empty string as-is", () => {
    expect(translateAuthError("")).toBe("");
  });

  it("strips [body.field] prefix and translates the message", () => {
    expect(translateAuthError("[body.email] Invalid email address")).toBe(
      "E-mail inválido"
    );
  });

  it("strips [body.field] prefix for unknown messages and returns cleaned text", () => {
    expect(translateAuthError("[body.name] Something unexpected")).toBe(
      "Something unexpected"
    );
  });
});
