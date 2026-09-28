const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { restrictTo } = require("./auth.middleware");

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