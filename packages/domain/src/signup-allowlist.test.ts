import assert from "node:assert/strict";
import test from "node:test";
import { isAdminRole, normalizeSignupEmail } from "./signup-allowlist";

test("normalizes signup emails for case-insensitive allowlist matching", () => {
  assert.equal(normalizeSignupEmail("  Pessoa@Exemplo.COM "), "pessoa@exemplo.com");
});

test("recognizes only the admin role as administrative", () => {
  assert.equal(isAdminRole("admin"), true);
  assert.equal(isAdminRole("member"), false);
  assert.equal(isAdminRole(undefined), false);
});
