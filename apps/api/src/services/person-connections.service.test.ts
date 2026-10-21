import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import {
  createPersonConnectionsService,
  type PersonConnectionInvitationRecord,
  type PersonConnectionRecord,
  type PersonConnectionsRepository,
} from "./person-connections.service";

function fixture() {
  const now = new Date("2020-01-10T12:00:00Z");
  const secret = "unit-connection-secret";
  const invitation: PersonConnectionInvitationRecord = {
    id: "invitation",
    ownerUserId: "owner",
    ownerName: "Owner",
    personId: "person",
    personName: "Guest",
    claimedByUserId: "recipient",
    claimedAccountName: "Recipient",
    tokenDigest: "private-token-digest",
    confirmationCodeDigest: createHmac("sha256", secret).update("123456").digest("hex"),
    confirmationAttempts: 0,
    status: "claimed",
    expiresAt: new Date("2020-01-11T12:00:00Z"),
    confirmationExpiresAt: new Date("2020-01-10T12:10:00Z"),
    claimedAt: now,
    confirmedAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const connection: PersonConnectionRecord = {
    id: "connection",
    invitationId: invitation.id,
    ownerUserId: "owner",
    personId: "person",
    personName: "Guest",
    recipientUserId: "recipient",
    recipientName: "Recipient",
    recipientAvatarUrl: null,
    ownerName: "Owner",
    ownerAvatarUrl: null,
    status: "active",
    connectedAt: now,
    revokedAt: null,
  };
  const writes: Array<{ operation: string; input: unknown }> = [];
  const synced: unknown[][] = [];
  const repository: PersonConnectionsRepository = {
    findExternalPersonForUser: async (id, user) =>
      user === "owner" && id === "person" ? { id, name: "Guest" } : null,
    findActiveConnectionForPerson: async () => null,
    expireInvitations: async (user, at) => {
      assert.equal(user, "owner");
      assert.deepEqual(at, now);
    },
    insertInvitation: async (input) => {
      writes.push({ operation: "create", input });
      return { ...invitation, ...input, status: "pending" };
    },
    listInvitationsForOwner: async (user) => {
      assert.equal(user, "owner");
      return [invitation];
    },
    findInvitationForOwner: async (id, user) =>
      id === invitation.id && user === "owner" ? invitation : null,
    claimInvitation: async (input) => {
      writes.push({ operation: "claim", input });
      return { ...invitation, ...input };
    },
    incrementConfirmationAttempts: async (id, user) => {
      writes.push({ operation: "attempt", input: [id, user] });
    },
    confirmInvitation: async (input) => {
      writes.push({ operation: "confirm", input });
      return connection;
    },
    cancelInvitation: async (input) => {
      writes.push({ operation: "cancel", input });
      return { ...invitation, status: "cancelled" };
    },
    listConnectionsForUser: async () => [connection],
    revokeConnection: async (input) => {
      writes.push({ operation: "revoke", input });
      return { ...connection, status: "revoked", revokedAt: now };
    },
  };
  return {
    now,
    secret,
    invitation,
    connection,
    writes,
    synced,
    repository,
    service: createPersonConnectionsService(repository, {
      secret,
      now: () => now,
      synchronizeRecurringExternalExpenses: async (...args) => {
        synced.push(args);
      },
    }),
  };
}

test("invitation creation delivers a token once, stores only its digest and hides internal fields", async () => {
  const f = fixture();
  const created = await f.service.createInvitation("person", "owner");
  assert.match(created.token, /^[\w-]{43}$/);
  const input = f.writes[0].input as Parameters<PersonConnectionsRepository["insertInvitation"]>[0];
  assert.equal(input.tokenDigest, createHash("sha256").update(created.token).digest("hex"));
  assert.equal(input.ownerUserId, "owner");
  assert.equal(input.personId, "person");
  assert.ok(input.expiresAt > f.now);
  const listed = await f.service.listInvitations("owner");
  assert.equal("token" in listed[0], false);
  assert.doesNotMatch(
    JSON.stringify(listed),
    /tokenDigest|confirmationCodeDigest|ownerUserId|claimedByUserId/,
  );
});

for (const scenario of ["foreign person", "connected", "pending"] as const)
  test(`creating an invitation rejects ${scenario}`, async () => {
    const f = fixture();
    if (scenario === "connected")
      f.repository.findActiveConnectionForPerson = async () => f.connection;
    if (scenario === "pending") f.repository.insertInvitation = async () => null;
    await assert.rejects(
      f.service.createInvitation(scenario === "foreign person" ? "foreign" : "person", "owner"),
      {
        code:
          scenario === "foreign person"
            ? "person_not_found"
            : scenario === "connected"
              ? "person_already_connected"
              : "invitation_already_pending",
      },
    );
    assert.deepEqual(f.writes, []);
  });

test("claim delivers a six digit code and stores only its keyed digest", async () => {
  const f = fixture();
  const result = await f.service.claimInvitation("opaque-token", "recipient");
  assert.match(result.confirmationCode, /^\d{6}$/);
  const input = f.writes[0].input as Parameters<PersonConnectionsRepository["claimInvitation"]>[0];
  assert.equal(
    input.confirmationCodeDigest,
    createHmac("sha256", f.secret).update(result.confirmationCode).digest("hex"),
  );
  assert.equal(input.recipientUserId, "recipient");
  assert.equal(input.tokenDigest, createHash("sha256").update("opaque-token").digest("hex"));
  assert.doesNotMatch(JSON.stringify(result), /Digest|ownerUserId|recipientUserId/);
});

for (const scenario of ["invalid", "self"] as const)
  test(`invitation claim rejects ${scenario}`, async () => {
    const f = fixture();
    if (scenario === "invalid") f.repository.claimInvitation = async () => null;
    await assert.rejects(
      f.service.claimInvitation("opaque", scenario === "self" ? "owner" : "recipient"),
      { code: scenario === "invalid" ? "invitation_invalid" : "self_connection_not_allowed" },
    );
  });

test("confirming uses owner-scoped state, synchronizes recurring expenses and exposes counterpart perspective", async () => {
  const f = fixture();
  const result = await f.service.confirmInvitation("invitation", "owner", {
    confirmationCode: "123456",
  });
  assert.equal(result.perspective, "owner");
  assert.equal(result.personId, "person");
  assert.equal(result.counterpartName, "Recipient");
  assert.deepEqual(f.synced, [["owner", "2020-01"]]);
  const recipient = (await f.service.listConnections("recipient"))[0];
  assert.equal(recipient.personId, null);
  assert.equal(recipient.counterpartName, "Owner");
  assert.doesNotMatch(JSON.stringify(recipient), /ownerUserId|recipientUserId/);
});

for (const scenario of [
  "foreign",
  "status",
  "expired",
  "code expired",
  "locked",
  "wrong code",
  "bad digest",
  "race",
] as const)
  test(`confirmation rejects ${scenario} with no successful confirmation`, async () => {
    const f = fixture();
    if (scenario === "status") f.invitation.status = "confirmed";
    if (scenario === "expired") f.invitation.expiresAt = f.now;
    if (scenario === "code expired") f.invitation.confirmationExpiresAt = f.now;
    if (scenario === "locked") f.invitation.confirmationAttempts = 5;
    if (scenario === "bad digest") f.invitation.confirmationCodeDigest = "aabb";
    if (scenario === "race") f.repository.confirmInvitation = async () => null;
    const codes = {
      foreign: "invitation_not_found",
      status: "person_connection_state_conflict",
      expired: "confirmation_expired",
      "code expired": "confirmation_expired",
      locked: "confirmation_locked",
      "wrong code": "confirmation_code_invalid",
      "bad digest": "confirmation_code_invalid",
      race: "invitation_state_conflict",
    };
    await assert.rejects(
      f.service.confirmInvitation("invitation", scenario === "foreign" ? "stranger" : "owner", {
        confirmationCode: scenario === "wrong code" ? "654321" : "123456",
      }),
      { code: codes[scenario] },
    );
    assert.equal(
      f.writes.some((w) => w.operation === "confirm"),
      false,
    );
    assert.equal(
      f.writes.filter((w) => w.operation === "attempt").length,
      ["wrong code", "bad digest"].includes(scenario) ? 1 : 0,
    );
  });

test("cancellation and bilateral revocation return public state with scoped identities", async () => {
  const f = fixture();
  assert.equal((await f.service.cancelInvitation("invitation", "owner")).status, "cancelled");
  assert.equal(
    (await f.service.revokeConnection("connection", "recipient")).perspective,
    "recipient",
  );
  assert.deepEqual(
    f.writes.map((w) => w.operation),
    ["cancel", "revoke"],
  );
});

for (const scenario of ["missing", "status", "race"] as const)
  test(`cancelling rejects ${scenario}`, async () => {
    const f = fixture();
    if (scenario === "status") f.invitation.status = "confirmed";
    if (scenario === "race") f.repository.cancelInvitation = async () => null;
    await assert.rejects(
      f.service.cancelInvitation("invitation", scenario === "missing" ? "stranger" : "owner"),
      { code: scenario === "missing" ? "invitation_not_found" : "invitation_state_conflict" },
    );
  });

test("revocation rejects an unowned connection and repository errors propagate", async () => {
  const f = fixture();
  f.repository.revokeConnection = async () => null;
  await assert.rejects(f.service.revokeConnection("foreign", "owner"), {
    code: "connection_not_found",
  });
  const failure = new Error("Database unavailable");
  f.repository.listConnectionsForUser = async () => {
    throw failure;
  };
  await assert.rejects(f.service.listConnections("owner"), (error) => error === failure);
});
