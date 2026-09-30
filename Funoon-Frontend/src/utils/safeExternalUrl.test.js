import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeExternalUrl } from "./safeExternalUrl.js";

describe("safeExternalUrl", () => {
  it("accepts HTTP(S) URLs and normalizes hostnames", () => {
    assert.equal(
      safeExternalUrl("https://example.com/path"),
      "https://example.com/path",
    );
    assert.equal(
      safeExternalUrl("example.com/path"),
      "https://example.com/path",
    );
    assert.equal(
      safeExternalUrl("//example.com/path"),
      "https://example.com/path",
    );
  });

  it("rejects executable, non-web, credentialed, and empty URLs", () => {
    assert.equal(safeExternalUrl("javascript:alert(1)"), null);
    assert.equal(
      safeExternalUrl("data:text/html,<script>alert(1)</script>"),
      null,
    );
    assert.equal(safeExternalUrl("ftp://example.com/file"), null);
    assert.equal(safeExternalUrl("https://user:pass@example.com"), null);
    assert.equal(safeExternalUrl("@artist"), null);
    assert.equal(safeExternalUrl("  "), null);
  });
});
