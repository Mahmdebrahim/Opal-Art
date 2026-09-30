const crypto = require("crypto");

const safeEqual = (expected, provided) => {
  const expectedBuffer = Buffer.from(String(expected || ""));
  const providedBuffer = Buffer.from(String(provided || ""));
  return (
    expectedBuffer.length > 0 &&
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  );
};

const isValidOtoWebhook = (
  payload,
  authorization,
  secret,
  authorizationKey,
) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const normalizedAuthorization = String(authorization || "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!safeEqual(authorizationKey, normalizedAuthorization)) return false;

  const { orderId, status, errorCode, timestamp, signature } = payload;
  const eventValue = errorCode || status;
  if (!orderId || !eventValue || !timestamp || !signature || !secret) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}:${eventValue}:${timestamp}`)
    .digest("base64");

  return safeEqual(expectedSignature, signature);
};

const verifyOtoWebhook = (req, res, next) => {
  const secret = process.env.OTO_WEBHOOK_SECRET;
  const authorizationKey =
    process.env.OTO_WEBHOOK_AUTHORIZATION_KEY || process.env.OTO_WEBHOOK_AUTH;

  if (!secret || !authorizationKey) {
    return res
      .status(503)
      .json({ error: "Webhook verification is not configured" });
  }

  if (
    !isValidOtoWebhook(
      req.body,
      req.get("authorization"),
      secret,
      authorizationKey,
    )
  ) {
    return res.status(401).json({ error: "Invalid webhook credentials" });
  }

  return next();
};

module.exports = verifyOtoWebhook;
module.exports.isValidOtoWebhook = isValidOtoWebhook;
