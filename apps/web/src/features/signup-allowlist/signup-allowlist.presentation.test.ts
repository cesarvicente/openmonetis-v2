import assert from "node:assert/strict";
import test from "node:test";
import { ApiClientError } from "../../lib/api-client";
import { signupAllowlistCreateErrorMessage, userRoleLabels } from "./signup-allowlist.presentation";

test("signup allowlist errors are translated into short Portuguese messages", () => {
  assert.equal(
    signupAllowlistCreateErrorMessage(
      new ApiClientError("failed", "signup_allowlist_entry_exists", 409),
    ),
    "Este e-mail já está autorizado.",
  );
  assert.equal(
    signupAllowlistCreateErrorMessage(new ApiClientError("failed", "rate_limited", 429)),
    "Muitas tentativas. Aguarde um minuto e tente novamente.",
  );
  assert.equal(
    signupAllowlistCreateErrorMessage(new Error("x")),
    "Não foi possível autorizar o e-mail.",
  );
});

test("user roles have Portuguese labels", () => {
  assert.deepEqual(userRoleLabels, { member: "Usuário", admin: "Administrador" });
});
