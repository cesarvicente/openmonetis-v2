import assert from "node:assert/strict";
import test from "node:test";
import {
  createEstablishmentInitials,
  createEstablishmentNameKey,
  normalizeLogoDomain,
} from "./establishments";

test("establishment names normalize accents and punctuation without changing initials semantics", () => {
  assert.equal(createEstablishmentNameKey(" Café São-Paulo! "), "cafe-sao-paulo");
  for (const [name, expected] of [
    ["", "?"],
    ["  ", "?"],
    ["Café", "CA"],
    ["João da Silva", "JS"],
  ])
    assert.equal(createEstablishmentInitials(name), expected);
  assert.equal(normalizeLogoDomain("HTTPS://EXAMPLE.COM/path"), "example.com");
});
