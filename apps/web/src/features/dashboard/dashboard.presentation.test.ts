import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultDashboardWidgetPreferences } from "@openmonetis/domain/dashboard";
import {
  areDashboardWidgetPreferencesEqual,
  changeDashboardWidgetLayout,
  getDashboardWidgetCapacity,
  getDashboardWidgetContentRows,
} from "./dashboard.presentation";

test("a widget with one row shows the same number of items as before", () => {
  assert.equal(getDashboardWidgetCapacity(1, "details"), 5);
  assert.equal(getDashboardWidgetCapacity(1, "progress"), 4);
  assert.equal(getDashboardWidgetCapacity(1, "settlement"), 2);
  assert.equal(getDashboardWidgetCapacity(1, "details", 3.25), 4);
});

test("the content height is the smallest one that fits every item, within the limit", () => {
  assert.equal(getDashboardWidgetContentRows(0, "details"), 1);
  assert.equal(getDashboardWidgetContentRows(5, "details"), 1);
  assert.equal(getDashboardWidgetContentRows(6, "details"), 2);
  assert.equal(
    getDashboardWidgetContentRows(getDashboardWidgetCapacity(3, "progress"), "progress"),
    3,
  );
  assert.equal(getDashboardWidgetContentRows(500, "details"), 4);
});

test("layout changes affect only the chosen widget and mark the preferences as different", () => {
  const defaults = createDefaultDashboardWidgetPreferences();
  const changed = changeDashboardWidgetLayout(defaults, "accounts", { width: 4 });

  assert.deepEqual(changed.layouts.accounts, { ...defaults.layouts.accounts, width: 4 });
  assert.deepEqual(changed.layouts.bills, defaults.layouts.bills);
  assert.equal(areDashboardWidgetPreferencesEqual(defaults, changed), false);
  assert.equal(areDashboardWidgetPreferencesEqual(defaults, { ...defaults, columns: 4 }), false);
  assert.equal(
    areDashboardWidgetPreferencesEqual(defaults, createDefaultDashboardWidgetPreferences()),
    true,
  );
});
