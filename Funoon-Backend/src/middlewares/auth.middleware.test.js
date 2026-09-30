const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { createAccessTokenError, restrictTo } = require("./auth.middleware");

const runGuard = (user) => {
  let error;
  let continued = false;

  restrictTo("artist")({ user }, {}, (nextError) => {
    error = nextError;
    continued = !nextError;
  });

  return { error, continued };
};

describe("restrictTo", () => {
  it("allows users with an allowed role", () => {
    assert.deepEqual(runGuard({ role: "artist" }), {
      error: undefined,
      continued: true,
    });
  });

  it("denies other roles and missing users", () => {
    assert.equal(runGuard({ role: "buyer" }).continued, false);
    assert.equal(runGuard({ role: "buyer" }).error instanceof Error, true);
    assert.equal(runGuard(undefined).continued, false);
    assert.equal(runGuard(undefined).error instanceof Error, true);
  });
});

describe("access token errors", () => {
  it("marks expired tokens without marking other unauthorized errors", () => {
    const expired = createAccessTokenError({ name: "TokenExpiredError" });
    const invalid = createAccessTokenError({ name: "JsonWebTokenError" });

    assert.equal(expired.statusCode, 401);
    assert.equal(expired.authErrorCode, "ACCESS_TOKEN_EXPIRED");
    assert.equal(invalid.statusCode, 401);
    assert.equal(invalid.authErrorCode, undefined);
  });
});
