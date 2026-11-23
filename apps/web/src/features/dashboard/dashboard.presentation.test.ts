import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultDashboardWidgetPreferences } from "@openmonetis/domain/dashboard";
import {
  areDashboardWidgetPreferencesEqual,
  changeDashboardWidgetLayout,
  getDashboardDragShift,
  getDashboardDragTargetIndex,
  getDashboardWidgetCapacity,
  getDashboardWidgetContentRows,
  getDashboardWidgetEndIndex,
  reorderDashboardWidget,
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

test("reordering moves the widget to the exact position and ignores invalid ones", () => {
  const defaults = createDefaultDashboardWidgetPreferences();
  const [first, second, third] = defaults.order;

  assert.deepEqual(reorderDashboardWidget(defaults, first, 2).order.slice(0, 3), [
    second,
    third,
    first,
  ]);
  assert.deepEqual(reorderDashboardWidget(defaults, third, 0).order.slice(0, 3), [
    third,
    first,
    second,
  ]);
  assert.equal(reorderDashboardWidget(defaults, first, 0), defaults);
  assert.equal(reorderDashboardWidget(defaults, first, defaults.order.length), defaults);
});

test("a visible widget sent to the end stays above trailing hidden ones", () => {
  const defaults = createDefaultDashboardWidgetPreferences();
  const last = defaults.order.length - 1;
  const preferences = { ...defaults, hidden: [defaults.order[1], ...defaults.order.slice(-2)] };

  assert.equal(getDashboardWidgetEndIndex(defaults, defaults.order[0]), last);
  assert.equal(getDashboardWidgetEndIndex(preferences, defaults.order[0]), last - 2);
  assert.equal(getDashboardWidgetEndIndex(preferences, defaults.order[last - 2]), last - 2);
  assert.equal(getDashboardWidgetEndIndex(preferences, defaults.order[1]), last);

  const moved = reorderDashboardWidget(preferences, defaults.order[0], last - 2);
  assert.deepEqual(moved.order.slice(-3), [defaults.order[0], ...defaults.order.slice(-2)]);
});

test("a visible widget among only hidden ones goes to the top when sent to the end", () => {
  const defaults = createDefaultDashboardWidgetPreferences();
  const [only, ...hidden] = defaults.order;
  assert.equal(getDashboardWidgetEndIndex({ ...defaults, hidden }, only), 0);
});

test("the drag target follows the dragged item's edges", () => {
  const items = [
    { height: 100, top: 0 },
    { height: 60, top: 108 },
    { height: 100, top: 176 },
  ];

  assert.equal(getDashboardDragTargetIndex(items, 0, 0), 0);
  assert.equal(getDashboardDragTargetIndex(items, 0, 39), 1);
  assert.equal(getDashboardDragTargetIndex(items, 0, 176), 2);
  assert.equal(getDashboardDragTargetIndex(items, 2, -60), 1);
  assert.equal(getDashboardDragTargetIndex(items, 2, -176), 0);
  assert.equal(getDashboardDragTargetIndex(items, 2, 0), 2);

  assert.equal(getDashboardDragShift(items, 1, 0, 2), -108);
  assert.equal(getDashboardDragShift(items, 1, 2, 0), 108);
  assert.equal(getDashboardDragShift(items, 1, 0, 0), 0);
});
