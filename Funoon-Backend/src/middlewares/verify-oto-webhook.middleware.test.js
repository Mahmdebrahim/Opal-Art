const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { describe, it } = require("node:test");
const { isValidOtoWebhook } = require("./verify-oto-webhook.middleware");

const secret = "test-webhook-secret";
const authorizationKey = "test-authorization-key";

const createPayload = () => {
  const payload = {
    orderId: "OPAL-123",
    status: "delivered",
    timestamp: "2026-09-28 12:00:00",
  };
  payload.signature = crypto
    .createHmac("sha256", secret)
    .update(`${payload.orderId}:${payload.status}:${payload.timestamp}`)
    .digest("base64");
  return payload;
};

describe("OTO webhook verification", () => {
  it("accepts a signed payload with the configured authorization key", () => {
    assert.equal(
      isValidOtoWebhook(
        createPayload(),
        `Bearer ${authorizationKey}`,
        secret,
        authorizationKey,
      ),
      true,
    );
  });

  it("rejects unsigned, tampered, or unauthorized payloads", () => {
    const payload = createPayload();
    assert.equal(
      isValidOtoWebhook(payload, authorizationKey, secret, authorizationKey),
      true,
    );
    assert.equal(
      isValidOtoWebhook(payload, "wrong-key", secret, authorizationKey),
      false,
    );
    assert.equal(
      isValidOtoWebhook(
        { ...payload, status: "cancelled" },
        authorizationKey,
        secret,
        authorizationKey,
      ),
      false,
    );
    assert.equal(
      isValidOtoWebhook(
        { ...payload, signature: "" },
        authorizationKey,
        secret,
        authorizationKey,
      ),
      false,
    );
  });
});
