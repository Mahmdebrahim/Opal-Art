const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { escapeRegex } = require("./regex");

describe("escapeRegex", () => {
  it("treats user search text as a literal pattern", () => {
    const input = ".*+$?{}[]()|\\^";
    const escaped = escapeRegex(input);

    assert.equal(new RegExp(escaped).test(input), true);
    assert.equal(new RegExp(escaped).test("anything"), false);
  });
});