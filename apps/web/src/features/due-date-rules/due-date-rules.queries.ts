import { queryOptions } from "@tanstack/react-query";
import {
  getDueDateRuleHolidays,
  getDueDateRuleOptions,
  getDueDateRules,
} from "./due-date-rules.api";
export const dueDateRuleKeys = {
  all: ["due-date-rules"] as const,
  options: ["due-date-rules", "options"] as const,
};
export const dueDateRulesQueryOptions = () =>
  queryOptions({ queryKey: dueDateRuleKeys.all, queryFn: getDueDateRules });
export const dueDateRuleOptionsQueryOptions = () =>
  queryOptions({ queryKey: dueDateRuleKeys.options, queryFn: getDueDateRuleOptions });

export const dueDateRuleHolidaysQueryOptions = (year: number) =>
  queryOptions({
    queryKey: [...dueDateRuleKeys.all, "holidays", year],
    queryFn: () => getDueDateRuleHolidays(year),
  });
