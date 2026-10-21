import assert from "node:assert/strict";
import test from "node:test";
import { buildNotifications, type NotificationSources } from "./notifications";

for (const categoryIcon of ["shopping-cart", null]) {
  test(`bill notifications preserve the category icon ${categoryIcon} and read state`, () => {
    const sources: NotificationSources = {
      bills: [
        {
          id: "bill-1",
          name: "Conta a pagar",
          categoryIcon,
          amount: 120,
          dueDate: "2026-10-10",
          period: "2026-10",
          isSettled: false,
        },
      ],
      invoices: [],
      budgets: [],
      inbox: { pendingCount: 0, latestItemAt: null },
      externalExpenses: {
        pendingCount: 0,
        totalAmount: 0,
        counterpartCount: 0,
        latestCounterpartName: null,
        latestUpdatedAt: null,
        latestPeriod: null,
      },
      tasks: [],
    };
    const readAt = "2026-10-11T12:00:00.000Z";
    const items = buildNotifications({
      today: "2026-10-12",
      dueSoonDays: 5,
      sources,
      states: [
        {
          notificationKey: "bill:bill-1",
          fingerprint: "overdue:2026-10-10",
          readAt,
          archivedAt: null,
        },
      ],
    });

    assert.equal(items.length, 1);
    const notification = items[0];
    assert.ok(notification?.kind === "bill");
    assert.equal(notification.categoryIcon, categoryIcon);
    assert.equal(notification.isRead, true);
    assert.equal(notification.readAt, readAt);
    assert.equal(notification.isArchived, false);
  });
}
