import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeInternalPath } from "./safeInternalPath.js";

describe("safeInternalPath", () => {
  it("preserves an internal path and its query", () => {
    assert.equal(
      safeInternalPath("/orders/123?tab=active#details"),
      "/orders/123?tab=active#details",
    );
  });

  it("rejects absolute, protocol-relative, and backslash redirects", () => {
    assert.equal(safeInternalPath("https://evil.example"), null);
    assert.equal(safeInternalPath("//evil.example"), null);
    assert.equal(safeInternalPath("/\\evil.example"), null);
    assert.equal(safeInternalPath("/"), "/");
  });
});