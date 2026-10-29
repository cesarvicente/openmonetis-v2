import assert from "node:assert/strict";
import test from "node:test";
import {
  apiKeyPrefix,
  getApiKeyExpiration,
  hasApiKeyFormat,
  normalizeApiKeyName,
} from "./api-keys";

const createdAt = new Date("2026-10-29T12:00:00.000Z");

test("API key expiration follows the chosen lifetime and allows keys without expiration", () => {
  assert.equal(getApiKeyExpiration(30, createdAt)?.toISOString(), "2026-11-28T12:00:00.000Z");
  assert.equal(getApiKeyExpiration(null, createdAt), null);
});

test("API key format accepts only the generated shape", () => {
  assert.equal(hasApiKeyFormat(`${apiKeyPrefix}${"a".repeat(43)}`), true);
  assert.equal(hasApiKeyFormat(`opm_${"a".repeat(43)}`), false);
  assert.equal(hasApiKeyFormat(`${apiKeyPrefix}${"a".repeat(42)}`), false);
  assert.equal(hasApiKeyFormat(`${apiKeyPrefix}${"a".repeat(42)}!`), false);
});

test("API key names collapse whitespace", () => {
  assert.equal(normalizeApiKeyName("  Agente   de  IA "), "Agente de IA");
});
