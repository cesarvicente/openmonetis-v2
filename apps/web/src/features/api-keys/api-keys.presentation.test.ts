import assert from "node:assert/strict";
import test from "node:test";
import {
  formatApiKeyExpiration,
  formatApiKeyLastUsed,
  formatApiKeyUsageExample,
  parseApiKeyLifetime,
} from "./api-keys.presentation";

test("API key lifetime options map to the API contract", () => {
  assert.equal(parseApiKeyLifetime("90"), 90);
  assert.equal(parseApiKeyLifetime("never"), null);
});

test("API key labels describe missing usage and expiration", () => {
  assert.equal(formatApiKeyLastUsed(null), "Ainda não usada");
  assert.equal(formatApiKeyExpiration(null), "Sem expiração");
});

test("API key usage example targets the same-origin proxy", () => {
  assert.equal(
    formatApiKeyUsageExample("https://finance.example.com", "omk_x"),
    'curl -H "Authorization: Bearer omk_x" https://finance.example.com/api-proxy/accounts',
  );
});
