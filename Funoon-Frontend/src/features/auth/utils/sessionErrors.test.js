import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDefinitiveSessionError,
  isTemporarySessionError,
} from "./sessionErrors.js";

describe("session error classification", () => {
  it("keeps transient failures retryable", () => {
    assert.equal(isTemporarySessionError({ response: { status: 429 } }), true);
    assert.equal(isTemporarySessionError({ response: { status: 503 } }), true);
    assert.equal(isTemporarySessionError({ status: 0 }), true);
    assert.equal(isTemporarySessionError({ code: "ERR_NETWORK" }), true);
  });

  it("distinguishes definitive auth failures from other client errors", () => {
    assert.equal(isDefinitiveSessionError({ response: { status: 401 } }), true);
    assert.equal(isDefinitiveSessionError({ response: { status: 403 } }), true);
    assert.equal(isDefinitiveSessionError({ response: { status: 400 } }), false);
  });
});