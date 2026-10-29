import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../utils/errors";
import {
  createSignupAllowlistService,
  type SignupAllowlistRepository,
} from "./signup-allowlist.service";

const createdAt = new Date("2026-10-29T12:00:00.000Z");
const entryId = "00000000-0000-4000-8000-000000000001";

function createRepository(
  overrides: Partial<SignupAllowlistRepository> = {},
): SignupAllowlistRepository {
  return {
    list: async () => [],
    insert: async (data) => ({ id: entryId, ...data, registered: false, createdAt }),
    insertIfMissing: async () => undefined,
    findRoleByEmail: async () => null,
    remove: async () => false,
    ...overrides,
  };
}

test("allowlist entries are stored with normalized emails", async () => {
  let storedEmail = "";
  const service = createSignupAllowlistService(
    createRepository({
      insert: async (data) => {
        storedEmail = data.email;
        return { id: entryId, ...data, registered: false, createdAt };
      },
    }),
  );

  const created = await service.create({ email: " Pessoa@Exemplo.com ", role: "member" });

  assert.equal(storedEmail, "pessoa@exemplo.com");
  assert.deepEqual(created, {
    id: entryId,
    email: "pessoa@exemplo.com",
    role: "member",
    registered: false,
    createdAt: createdAt.toISOString(),
  });
});

test("duplicate allowlist entries and missing removals become typed errors", async () => {
  const service = createSignupAllowlistService(createRepository({ insert: async () => null }));

  await assert.rejects(
    service.create({ email: "pessoa@exemplo.com", role: "member" }),
    (error) => error instanceof ApiError && error.status === 409,
  );
  await assert.rejects(
    service.remove(entryId),
    (error) => error instanceof ApiError && error.status === 404,
  );
});

test("signup role lookup and initial admin bootstrap use normalized emails", async () => {
  const lookedUp: string[] = [];
  let bootstrap: { email: string; role: string } | null = null;
  const service = createSignupAllowlistService(
    createRepository({
      findRoleByEmail: async (email) => {
        lookedUp.push(email);
        return email === "admin@exemplo.com" ? "admin" : null;
      },
      insertIfMissing: async (data) => {
        bootstrap = data;
      },
    }),
  );

  assert.equal(await service.resolveSignupRole("ADMIN@exemplo.com"), "admin");
  assert.equal(await service.resolveSignupRole("outra@exemplo.com"), null);
  await service.ensureInitialAdmin(" Admin@Exemplo.com ");

  assert.deepEqual(lookedUp, ["admin@exemplo.com", "outra@exemplo.com"]);
  assert.deepEqual(bootstrap, { email: "admin@exemplo.com", role: "admin" });
});
