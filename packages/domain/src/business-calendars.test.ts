import assert from "node:assert/strict";
import test from "node:test";
import { defaultBusinessCalendar, isBusinessDay } from "./business-calendars";

test("calendar distinguishes weekends, fixed national and explicitly configured holidays", () => {
  assert.equal(isBusinessDay("2026-10-12", defaultBusinessCalendar), false);
  assert.equal(isBusinessDay("2026-11-20", defaultBusinessCalendar), false);
  assert.equal(isBusinessDay("2026-10-13", defaultBusinessCalendar), true);
  assert.equal(
    isBusinessDay("2026-10-10", {
      ...defaultBusinessCalendar,
      workingWeekdays: [1, 2, 3, 4, 5, 6],
    }),
    true,
  );
  assert.equal(
    isBusinessDay("2026-10-13", { ...defaultBusinessCalendar, holidays: ["2026-10-13"] }),
    false,
  );
  assert.equal(
    isBusinessDay("2026-10-12", { ...defaultBusinessCalendar, includeNationalHolidays: false }),
    true,
  );
});

test("published holiday dates are exactly the dates excluded by the national calendar", async () => {
  const { listNationalHolidays } = await import("./business-calendars");
  const everyWeekday = { ...defaultBusinessCalendar, workingWeekdays: [0, 1, 2, 3, 4, 5, 6] };
  const holidays = listNationalHolidays(2026);
  assert.equal(holidays.length, 9);
  assert.equal(new Set(holidays.map((holiday) => holiday.date)).size, holidays.length);
  for (const holiday of holidays) {
    assert.equal(isBusinessDay(holiday.date, everyWeekday), false, holiday.id);
    assert.equal(
      isBusinessDay(holiday.date, { ...everyWeekday, includeNationalHolidays: false }),
      true,
      holiday.id,
    );
  }
  assert.equal(
    listNationalHolidays(2023).some((holiday) => holiday.id === "blackAwarenessDay"),
    false,
  );
  assert.equal(
    listNationalHolidays(2024).some((holiday) => holiday.id === "blackAwarenessDay"),
    true,
  );
});
