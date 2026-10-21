import assert from "node:assert/strict";
import test from "node:test";
import type { InstallmentReportRow } from "@openmonetis/domain/installments";
import type { InstallmentsRepository } from "./installments.service";
import { createInstallmentsService } from "./installments.service";

const userId = "10000000-0000-4000-8000-000000000001";
const seriesId = "20000000-0000-4000-8000-000000000002";

function installment(currentInstallment: number, period: string): InstallmentReportRow {
  return {
    id: `30000000-0000-4000-8000-00000000000${currentInstallment}`,
    seriesId,
    name: "Compra dividida",
    note: "Garantia estendida incluída.",
    amount: "-50.00",
    purchaseDate: "2026-08-24",
    period,
    dueDate: null,
    currentInstallment,
    paymentMethod: "credit_card",
    isSettled: null,
    invoicePaymentStatus: null,
    totalInstallments: 3,
    trackedFromInstallment: 1,
    originalAmount: "150.00",
    personId: "40000000-0000-4000-8000-000000000004",
    personName: "Felipe",
    personAvatarUrl: null,
    categoryId: null,
    categoryName: null,
    categoryIcon: null,
    cardId: "50000000-0000-4000-8000-000000000005",
    cardName: "Cartao",
    cardLogo: null,
    cardDueDay: 10,
    accountId: null,
    accountName: null,
    accountLogo: null,
  };
}

function repository(listForUser: InstallmentsRepository["listForUser"]): InstallmentsRepository {
  return new Proxy(
    { listForUser },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected repository call: ${String(property)}`);
        };
      },
    },
  ) as InstallmentsRepository;
}

test("installment report uses only the admin person's allocation", async () => {
  let receivedOptions: { personScope?: "admin" | "all" } | undefined;
  const service = createInstallmentsService(
    repository(async (_receivedUserId, options) => {
      receivedOptions = options;
      return [installment(1, "2026-09"), installment(2, "2026-10"), installment(3, "2026-11")];
    }),
    () => "2026-09",
  );

  const report = await service.list(userId, {
    period: "2026-09",
    status: "all",
  });

  assert.deepEqual(receivedOptions, { personScope: "admin" });
  assert.equal(report.groups[0]?.originalAmount, 150);
  assert.equal(report.groups[0]?.trackedAmount, 150);
  assert.equal(report.groups[0]?.pendingAmount, 150);
  assert.equal(report.groups[0]?.note, "Garantia estendida incluída.");
  assert.deepEqual(
    report.groups[0]?.installments.map((item) => item.amount),
    [50, 50, 50],
  );
  assert.equal(report.monthlyHistory.length, 13);
  assert.equal(report.monthlyHistory[0]?.period, "2025-10");
  assert.deepEqual(report.monthlyHistory.slice(-2), [
    { period: "2026-09", totalAmount: 50, activePurchaseCount: 1 },
    { period: "2026-10", totalAmount: 50, activePurchaseCount: 1 },
  ]);
});

test("monthly history and overview stay complete when the list is filtered", async () => {
  const service = createInstallmentsService(
    repository(async () => [
      { ...installment(1, "2026-08"), amount: "-10.10" },
      { ...installment(2, "2026-09"), amount: "-20.20" },
      { ...installment(3, "2026-10"), amount: "-30.30" },
    ]),
    () => "2026-09",
  );

  const report = await service.list(userId, {
    period: "2026-09",
    status: "completed",
  });

  assert.equal(report.groups.length, 0);
  assert.equal(report.summary.totalPendingAmount, 60.6);
  assert.equal(report.summary.dueInPeriodAmount, 20.2);
  assert.deepEqual(report.monthlyHistory.slice(-3), [
    { period: "2026-08", totalAmount: 10.1, activePurchaseCount: 1 },
    { period: "2026-09", totalAmount: 20.2, activePurchaseCount: 1 },
    { period: "2026-10", totalAmount: 30.3, activePurchaseCount: 1 },
  ]);
  const otherReference = await service.list(userId, { period: "2025-01", status: "open" });
  assert.deepEqual(otherReference.monthlyHistory, report.monthlyHistory);
});

test("paid installments remain in monthly history when only open purchases are listed", async () => {
  const service = createInstallmentsService(
    repository(async () =>
      [installment(1, "2026-07"), installment(2, "2026-08"), installment(3, "2026-09")].map(
        (row) => ({ ...row, invoicePaymentStatus: "paid" as const }),
      ),
    ),
    () => "2026-09",
  );

  const report = await service.list(userId, { period: "2026-09", status: "open" });

  assert.equal(report.groups.length, 0);
  assert.equal(report.summary.totalPendingAmount, 0);
  assert.deepEqual(report.monthlyHistory.slice(-3), [
    { period: "2026-08", totalAmount: 50, activePurchaseCount: 1 },
    { period: "2026-09", totalAmount: 50, activePurchaseCount: 1 },
    { period: "2026-10", totalAmount: 0, activePurchaseCount: 0 },
  ]);
});

test("monthly purchase count includes each series once per month", async () => {
  const secondSeriesId = "20000000-0000-4000-8000-000000000003";
  const service = createInstallmentsService(
    repository(async () => [
      installment(1, "2026-09"),
      installment(2, "2026-09"),
      { ...installment(1, "2026-09"), seriesId: secondSeriesId },
    ]),
    () => "2026-09",
  );

  const report = await service.list(userId, { period: "2026-09", status: "all" });

  assert.deepEqual(report.monthlyHistory.at(-2), {
    period: "2026-09",
    totalAmount: 150,
    activePurchaseCount: 2,
  });
});

test("anticipation reports a paid target invoice separately from selection conflicts", async () => {
  const repo = repository(async () => []);
  const future = installment(2, "2026-10");
  repo.findByIdsForUser = async () => [
    {
      ...future,
      userId,
      type: "expense",
      condition: "installment",
      splitShares: [],
    },
  ];
  repo.createAnticipation = async () => ({ reason: "targetInvoicePaid" });
  const service = createInstallmentsService(repo);
  await assert.rejects(
    service.anticipate(userId, seriesId, {
      installmentIds: [future.id],
      targetPeriod: "2026-09",
      discount: 0,
    }),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "installment_target_invoice_paid",
  );
});

function anticipationFixture() {
  const anticipationId = "60000000-0000-4000-8000-000000000006";
  const rows = [installment(2, "2026-10"), installment(3, "2026-11")];
  const calls: Parameters<InstallmentsRepository["undoAnticipation"]>[0][] = [];
  let record: Awaited<ReturnType<InstallmentsRepository["findAnticipationForUser"]>> = {
    id: anticipationId,
    seriesId,
    targetPeriod: "2026-09",
    discount: "10.01",
    items: rows.map((row) => ({
      id: row.id,
      personId: row.personId,
      amount: row.amount,
      installmentNumber: row.currentInstallment,
      totalInstallments: row.totalInstallments,
      originalPeriod: row.period,
      splitShares: [
        { personId: row.personId, amount: "-30.00" },
        { personId: "guest", amount: "-20.00" },
      ],
    })),
  };
  const repo = repository(async () => rows);
  repo.findAnticipationForUser = async (requestedUser, requestedSeries, requestedId) => {
    assert.equal(requestedUser, userId);
    assert.equal(requestedSeries, seriesId);
    assert.equal(requestedId, anticipationId);
    return record;
  };
  repo.undoAnticipation = async (data) => {
    calls.push(data);
    return { id: anticipationId };
  };
  repo.findByIdsForUser = async (ids, requestedUser) => {
    assert.equal(requestedUser, userId);
    return rows
      .filter((row) => ids.includes(row.id))
      .map((row) => ({
        ...row,
        userId,
        type: "expense",
        condition: "installment",
        splitShares: [],
      }));
  };
  return {
    anticipationId,
    rows,
    calls,
    repo,
    service: createInstallmentsService(repo),
    removeRecord() {
      record = null;
    },
  };
}

test("installment dashboard scopes the owner and primary person's allocation", async () => {
  const service = createInstallmentsService(
    repository(async (owner, options) => {
      assert.equal(owner, userId);
      assert.deepEqual(options, { personScope: "admin" });
      return [installment(2, "2026-10"), installment(3, "2026-11")];
    }),
  );
  const result = await service.dashboard(userId, "2026-10");
  assert.equal(result.period, "2026-10");
  assert.equal(result.items.length, 1);
});

test("anticipation persists the selected future installments and conserves discount cents", async () => {
  const f = anticipationFixture();
  const drafts: Parameters<InstallmentsRepository["createAnticipation"]>[0][] = [];
  f.repo.createAnticipation = async (draft) => {
    drafts.push(draft);
    return { id: f.anticipationId };
  };
  const result = await f.service.anticipate(userId, seriesId, {
    installmentIds: f.rows.map((row) => row.id),
    targetPeriod: "2026-09",
    discount: 10.01,
  });
  assert.deepEqual(result, {
    id: f.anticipationId,
    seriesId,
    targetPeriod: "2026-09",
    installmentCount: 2,
    totalAmount: 100,
    discount: 10.01,
    finalAmount: 89.99,
  });
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].userId, userId);
  assert.deepEqual(
    drafts[0].installmentIds,
    f.rows.map((row) => row.id),
  );
  assert.equal(
    drafts[0].discountAllocations.reduce((sum, item) => sum + Math.round(item.amount * 100), 0),
    1001,
  );
});

type QuoteRecord = Awaited<ReturnType<InstallmentsRepository["findByIdsForUser"]>>[number];
for (const [label, patch, code] of [
  ["foreign owner", { userId: "stranger" }, "installment_not_anticipatable"],
  ["different series", { seriesId: "other" }, "installment_not_anticipatable"],
  ["income", { type: "income" }, "installment_not_anticipatable"],
  ["single", { condition: "single" }, "installment_not_anticipatable"],
  ["account payment", { paymentMethod: "pix" }, "installment_not_anticipatable"],
  ["missing card", { cardId: null }, "installment_not_anticipatable"],
  ["current month", { period: "2026-09" }, "installment_not_anticipatable"],
  [
    "settled",
    { isSettled: true, paymentMethod: "credit_card", invoicePaymentStatus: "paid" },
    "installment_already_paid",
  ],
] as Array<[string, Partial<QuoteRecord>, string]>) {
  test(`anticipation rejects ${label} before persistence`, async () => {
    const f = anticipationFixture();
    const find = f.repo.findByIdsForUser;
    f.repo.findByIdsForUser = async (...args) =>
      (await find(...args)).map((row) => ({ ...row, ...patch }));
    let writes = 0;
    f.repo.createAnticipation = async () => {
      writes++;
      return { id: f.anticipationId };
    };
    await assert.rejects(
      f.service.anticipate(userId, seriesId, {
        installmentIds: [f.rows[0].id],
        targetPeriod: "2026-09",
        discount: 0,
      }),
      { code },
    );
    assert.equal(writes, 0);
  });
}

for (const invalid of ["missing", "duplicate", "mixed_cards", "discount"] as const) {
  test(`anticipation rejects ${invalid} selection without writes`, async () => {
    const f = anticipationFixture();
    const find = f.repo.findByIdsForUser;
    f.repo.findByIdsForUser = async (...args) => {
      const rows = await find(...args);
      if (invalid === "missing") return [];
      if (invalid === "duplicate") return [rows[0], rows[0]];
      if (invalid === "mixed_cards") rows[1].cardId = "another-card";
      return rows;
    };
    await assert.rejects(
      f.service.anticipate(userId, seriesId, {
        installmentIds: f.rows.map((row) => row.id),
        targetPeriod: "2026-09",
        discount: invalid === "discount" ? 101 : 0,
      }),
      {
        code:
          invalid === "mixed_cards"
            ? "mixed_installment_cards"
            : invalid === "discount"
              ? "invalid_anticipation_discount"
              : "invalid_installment_selection",
      },
    );
  });
}

for (const patch of [
  { type: "income" },
  { condition: "single" },
  { seriesId: null },
  { currentInstallment: null },
] as Partial<QuoteRecord>[]) {
  test(`installment quote rejects malformed installment ${JSON.stringify(patch)}`, async () => {
    const f = anticipationFixture();
    const find = f.repo.findByIdsForUser;
    f.repo.findByIdsForUser = async (...args) =>
      (await find(...args)).map((row) => ({ ...row, ...patch }));
    await assert.rejects(f.service.quote(userId, { installmentIds: [f.rows[0].id] }), {
      code: "invalid_installment_selection",
    });
  });
}

test("a concurrent change during anticipation returns a conflict", async () => {
  const f = anticipationFixture();
  f.repo.createAnticipation = async () => null;
  await assert.rejects(
    f.service.anticipate(userId, seriesId, {
      installmentIds: [f.rows[0].id],
      targetPeriod: "2026-09",
      discount: 0,
    }),
    { status: 409, code: "installment_anticipation_conflict" },
  );
});

for (const operation of [
  "dashboard",
  "list",
  "quote",
  "anticipate",
  "getAnticipation",
  "undoAnticipation",
] as const) {
  test(`installment ${operation} propagates repository failures without retry`, async () => {
    const f = anticipationFixture();
    const failure = new Error("Persistence unavailable");
    let calls = 0;
    const reject = async () => {
      calls++;
      throw failure;
    };
    if (operation === "dashboard" || operation === "list") f.repo.listForUser = reject;
    else if (operation === "quote") f.repo.findByIdsForUser = reject;
    else if (operation === "anticipate") f.repo.createAnticipation = reject;
    else if (operation === "getAnticipation") f.repo.findAnticipationForUser = reject;
    else f.repo.undoAnticipation = reject;
    const result =
      operation === "dashboard"
        ? f.service.dashboard(userId, "2026-09")
        : operation === "list"
          ? f.service.list(userId, { period: "2026-09", status: "all" })
          : operation === "quote"
            ? f.service.quote(userId, { installmentIds: [f.rows[0].id] })
            : operation === "anticipate"
              ? f.service.anticipate(userId, seriesId, {
                  installmentIds: [f.rows[0].id],
                  targetPeriod: "2026-09",
                  discount: 0,
                })
              : operation === "getAnticipation"
                ? f.service.getAnticipation(userId, seriesId, f.anticipationId)
                : f.service.undoAnticipation(userId, seriesId, f.anticipationId, {
                    installmentIds: [f.rows[0].id],
                  });
    await assert.rejects(result, (error) => error === failure);
    assert.equal(calls, 1);
  });
}

test("anticipation details preserve original months and expose only public financial fields", async () => {
  const f = anticipationFixture();
  assert.deepEqual(await f.service.getAnticipation(userId, seriesId, f.anticipationId), {
    id: f.anticipationId,
    seriesId,
    targetPeriod: "2026-09",
    discount: 10.01,
    installments: f.rows.map((row) => ({
      id: row.id,
      installmentNumber: row.currentInstallment,
      totalInstallments: 3,
      amount: 50,
      originalPeriod: row.period,
    })),
  });
  assert.deepEqual(f.calls, []);
});

for (const operation of ["details", "undo"] as const) {
  test(`missing or unowned anticipation rejects ${operation} before mutations`, async () => {
    const f = anticipationFixture();
    f.removeRecord();
    await assert.rejects(
      operation === "details"
        ? f.service.getAnticipation(userId, seriesId, f.anticipationId)
        : f.service.undoAnticipation(userId, seriesId, f.anticipationId, {
            installmentIds: [f.rows[0].id],
          }),
      { status: 404, code: "INSTALLMENT_ANTICIPATION_NOT_FOUND" },
    );
    assert.deepEqual(f.calls, []);
  });
}

test("partial anticipation undo conserves discount cents and remaining responsibilities", async () => {
  const f = anticipationFixture();
  const result = await f.service.undoAnticipation(userId, seriesId, f.anticipationId, {
    installmentIds: [f.rows[0].id],
  });
  assert.deepEqual(result, {
    id: f.anticipationId,
    restoredInstallmentCount: 1,
    remainingInstallmentCount: 1,
    restoredDiscount: 5,
    remainingDiscount: 5.01,
  });
  assert.deepEqual(f.calls, [
    {
      userId,
      seriesId,
      anticipationId: f.anticipationId,
      installmentIds: [f.rows[0].id],
      expectedInstallmentCount: 2,
      expectedDiscount: 10.01,
      remainingDiscount: 5.01,
      remainingDiscountAllocations: [
        { personId: f.rows[0].personId, amount: 3 },
        { personId: "guest", amount: 2.01 },
      ],
    },
  ]);
});

test("full anticipation undo restores the entire discount and leaves no remaining allocation", async () => {
  const f = anticipationFixture();
  const result = await f.service.undoAnticipation(userId, seriesId, f.anticipationId, {
    installmentIds: f.rows.map((row) => row.id),
  });
  assert.deepEqual(result, {
    id: f.anticipationId,
    restoredInstallmentCount: 2,
    remainingInstallmentCount: 0,
    restoredDiscount: 10.01,
    remainingDiscount: 0,
  });
  assert.deepEqual(f.calls[0].remainingDiscountAllocations, []);
});

for (const selection of [[], ["foreign"], ["duplicate", "duplicate"]]) {
  test(`invalid anticipation undo selection ${JSON.stringify(selection)} does not reach persistence`, async () => {
    const f = anticipationFixture();
    const ids = selection.map((id) => (id === "duplicate" ? f.rows[0].id : id));
    await assert.rejects(
      f.service.undoAnticipation(userId, seriesId, f.anticipationId, { installmentIds: ids }),
      { status: 400, code: "invalid_installment_selection" },
    );
    assert.deepEqual(f.calls, []);
  });
}

test("a paid or concurrently changed anticipation cannot be undone", async () => {
  const f = anticipationFixture();
  f.repo.undoAnticipation = async (data) => {
    f.calls.push(data);
    return null;
  };
  await assert.rejects(
    f.service.undoAnticipation(userId, seriesId, f.anticipationId, {
      installmentIds: [f.rows[0].id],
    }),
    { status: 400, code: "INSTALLMENT_ANTICIPATION_NOT_CANCELLABLE" },
  );
  assert.equal(f.calls.length, 1);
});

for (const operation of ["details", "undo"] as const) {
  test(`anticipation ${operation} propagates persistence failures without retrying a mutation`, async () => {
    const f = anticipationFixture();
    const failure = new Error("Database unavailable");
    if (operation === "details")
      f.repo.findAnticipationForUser = async () => {
        throw failure;
      };
    else
      f.repo.undoAnticipation = async (data) => {
        f.calls.push(data);
        throw failure;
      };
    await assert.rejects(
      operation === "details"
        ? f.service.getAnticipation(userId, seriesId, f.anticipationId)
        : f.service.undoAnticipation(userId, seriesId, f.anticipationId, {
            installmentIds: [f.rows[0].id],
          }),
      (error) => error === failure,
    );
    assert.equal(f.calls.length, operation === "details" ? 0 : 1);
  });
}

test("installment quote preserves cents and rejects missing or already paid records", async () => {
  const f = anticipationFixture();
  assert.deepEqual(await f.service.quote(userId, { installmentIds: f.rows.map((row) => row.id) }), {
    installmentCount: 2,
    totalAmount: 100,
  });
  await assert.rejects(f.service.quote(userId, { installmentIds: [f.rows[0].id, "foreign"] }), {
    code: "invalid_installment_selection",
  });
  f.rows[0].invoicePaymentStatus = "paid";
  await assert.rejects(f.service.quote(userId, { installmentIds: [f.rows[0].id] }), {
    code: "installment_already_paid",
  });
});
