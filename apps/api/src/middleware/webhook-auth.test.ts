import { describe, test, expect } from "bun:test";
import { createHmac } from "crypto";
import { verifyWebhookSignature } from "./webhook-auth";

const SECRET = "test-webhook-secret-key";

function sign(payload: string, secret: string = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const payload = '{"event":"image.uploaded","id":"123"}';

  test("valid HMAC-SHA256 signature returns true", () => {
    const signature = sign(payload);
    expect(verifyWebhookSignature(payload, signature, SECRET)).toBe(true);
  });

  test("invalid signature returns false", () => {
    const badSignature = "sha256=0000000000000000000000000000000000000000000000000000000000000000";
    expect(verifyWebhookSignature(payload, badSignature, SECRET)).toBe(false);
  });

  test("empty signature returns false", () => {
    expect(verifyWebhookSignature(payload, "", SECRET)).toBe(false);
  });

  test("malformed prefix (e.g., 'md5=abc') returns false", () => {
    expect(verifyWebhookSignature(payload, "md5=abc123", SECRET)).toBe(false);
  });

  test("wrong prefix 'sha512=' returns false", () => {
    const hmac = createHmac("sha256", SECRET).update(payload).digest("hex");
    expect(verifyWebhookSignature(payload, "sha512=" + hmac, SECRET)).toBe(false);
  });

  test("different payload produces mismatch and returns false", () => {
    const signature = sign(payload);
    const differentPayload = '{"event":"image.deleted","id":"456"}';
    expect(verifyWebhookSignature(differentPayload, signature, SECRET)).toBe(false);
  });

  test("different secret produces mismatch and returns false", () => {
    const signature = sign(payload, "other-secret");
    expect(verifyWebhookSignature(payload, signature, SECRET)).toBe(false);
  });
});
