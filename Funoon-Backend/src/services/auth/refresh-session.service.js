const crypto = require("crypto");

const REFRESH_TTL_DAYS = 90;
const ROTATION_GRACE_PERIOD_MS = 30 * 1000;
const MAX_PREVIOUS_TOKENS = 10;

const createRefreshToken = () => crypto.randomBytes(40).toString("hex");

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const populateUser = (query) =>
  query.populate({ path: "user", select: "+isActive" });

async function findGraceSession(RefreshToken, token, now, sessionId) {
  const filter = {
    previousTokens: {
      $elemMatch: { token, validUntil: { $gt: now } },
    },
    expiresAt: { $gt: now },
  };

  if (sessionId) filter._id = sessionId;
  return populateUser(RefreshToken.findOne(filter));
}

async function rotateRefreshSession(RefreshToken, token, now = new Date()) {
  const currentSession = await populateUser(
    RefreshToken.findOne({ token, expiresAt: { $gt: now } }),
  );

  if (!currentSession) {
    const retrySession = await findGraceSession(RefreshToken, token, now);
    if (retrySession) return { session: retrySession, isRetry: true };

    const expiredReuse = await RefreshToken.findOne({ "previousTokens.token": token });
    if (expiredReuse) {
      await RefreshToken.deleteOne({ _id: expiredReuse._id });
    }
    return null;
  }

  const nextToken = createRefreshToken();
  const validUntil = new Date(now.getTime() + ROTATION_GRACE_PERIOD_MS);
  const nextExpiry = addDays(now, REFRESH_TTL_DAYS);
  const rotatedSession = await populateUser(
    RefreshToken.findOneAndUpdate(
      {
        _id: currentSession._id,
        token,
        expiresAt: { $gt: now },
      },
      {
        $set: { token: nextToken, expiresAt: nextExpiry },
        $push: {
          previousTokens: {
            $each: [{ token, validUntil }],
            $slice: -MAX_PREVIOUS_TOKENS,
          },
        },
      },
      { new: true },
    ),
  );

  if (rotatedSession) {
    return { session: rotatedSession, isRetry: false };
  }

  const concurrentRetry = await findGraceSession(
    RefreshToken,
    token,
    now,
    currentSession._id,
  );
  return concurrentRetry
    ? { session: concurrentRetry, isRetry: true }
    : null;
}

module.exports = {
  ROTATION_GRACE_PERIOD_MS,
  rotateRefreshSession,
};