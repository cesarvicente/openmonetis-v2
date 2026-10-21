import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { otherExpenseCategoryName, otherIncomeCategoryName } from "@openmonetis/domain/categories";
import type { TransactionOutput } from "@openmonetis/validators/transactions";

export type TestIdentity = {
  id: string;
  cookie: string;
  personId: string;
  expenseCategoryId: string;
  incomeCategoryId: string;
};

export async function createTestApiClient() {
  const { app } = await import("../app");
  const { db, people, categories } = await import("@openmonetis/db");
  const { and, eq } = await import("drizzle-orm");
  function request(path: string, identity?: TestIdentity, method = "GET", body?: unknown) {
    return app.request(`http://localhost:7001${path}`, {
      method,
      headers: {
        origin: "http://localhost:7002",
        ...(identity ? { cookie: identity.cookie } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function data<T>(response: Response, status = 200): Promise<T> {
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    assert.equal(body.error, null);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.doesNotMatch(
      JSON.stringify(body),
      /"(?:userId|ownerUserId|recipientUserId|claimedByUserId|tokenDigest|confirmationCodeDigest|fileKey|password|stack)"\s*:/,
    );
    return body.data;
  }
  async function error(response: Response, status: number, code?: string) {
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    assert.equal(body.error, true);
    if (code) assert.equal(body.code, code);
    assert.doesNotMatch(JSON.stringify(body), /"(?:userId|tokenDigest|fileKey|stack)"\s*:/);
  }
  async function register(): Promise<TestIdentity> {
    const response = await request("/api/auth/sign-up/email", undefined, "POST", {
      name: "Test user",
      email: `${randomUUID()}@example.test`,
      password: "integration-test-password-123",
    });
    assert.equal(response.status, 200, await response.clone().text());
    const body = await response.json();
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .join("; ");
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.userId, body.user.id), eq(people.role, "admin")));
    const ownedCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, body.user.id));
    const expense = ownedCategories.find((row) => row.name === otherExpenseCategoryName);
    const income = ownedCategories.find((row) => row.name === otherIncomeCategoryName);
    assert.ok(person && expense && income && cookie);
    return {
      id: body.user.id,
      cookie,
      personId: person.id,
      expenseCategoryId: expense.id,
      incomeCategoryId: income.id,
    };
  }
  async function account(identity: TestIdentity) {
    return data<{ id: string }>(
      await request("/accounts", identity, "POST", {
        name: `Account ${randomUUID()}`,
        type: "checking",
      }),
      201,
    );
  }
  async function expense(identity: TestIdentity, overrides: Record<string, unknown> = {}) {
    const target = await account(identity);
    return data<TransactionOutput>(
      await request("/transactions", identity, "POST", {
        type: "expense",
        paymentMethod: "pix",
        name: "Test purchase",
        amount: 10.01,
        purchaseDate: "2020-01-10",
        personId: identity.personId,
        categoryId: identity.expenseCategoryId,
        accountId: target.id,
        ...overrides,
      }),
      201,
    );
  }
  return { app, request, data, error, register, account, expense };
}
