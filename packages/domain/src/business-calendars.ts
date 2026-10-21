export type BusinessCalendar = {
  workingWeekdays: number[];
  includeNationalHolidays: boolean;
  holidays: string[];
};
export const defaultBusinessCalendar: BusinessCalendar = {
  workingWeekdays: [1, 2, 3, 4, 5],
  includeNationalHolidays: true,
  holidays: [],
};
export const nationalHolidayIds = [
  "newYear",
  "tiradentes",
  "labourDay",
  "independenceDay",
  "ourLadyOfAparecida",
  "allSoulsDay",
  "republicProclamation",
  "blackAwarenessDay",
  "christmas",
] as const;
const nationalHolidays: Array<{
  id: (typeof nationalHolidayIds)[number];
  monthDay: string;
  fromYear?: number;
}> = [
  { id: "newYear", monthDay: "01-01" },
  { id: "tiradentes", monthDay: "04-21" },
  { id: "labourDay", monthDay: "05-01" },
  { id: "independenceDay", monthDay: "09-07" },
  { id: "ourLadyOfAparecida", monthDay: "10-12" },
  { id: "allSoulsDay", monthDay: "11-02" },
  { id: "republicProclamation", monthDay: "11-15" },
  { id: "blackAwarenessDay", monthDay: "11-20", fromYear: 2024 },
  { id: "christmas", monthDay: "12-25" },
];
export function listNationalHolidays(year: number) {
  return nationalHolidays
    .filter((holiday) => !holiday.fromYear || year >= holiday.fromYear)
    .map(({ id, monthDay }) => ({ id, date: `${year}-${monthDay}` }));
}
export function isBusinessDay(date: string, calendar: BusinessCalendar) {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return (
    calendar.workingWeekdays.includes(weekday) &&
    !(
      calendar.includeNationalHolidays &&
      listNationalHolidays(Number(date.slice(0, 4))).some((holiday) => holiday.date === date)
    ) &&
    !calendar.holidays.includes(date)
  );
}
