import type {
  DueDateRuleHolidays,
  DueDateRuleOptions,
  DueDateRulesOutput,
  DueDateRulesPreview,
  SaveDueDateRulesInput,
  SetDueDateExceptionInput,
} from "@openmonetis/validators/due-date-rules";
import { ApiClientError, requestApi } from "@/lib/api-client";
export class DueDateRulesApiError extends ApiClientError {}
function request<T>(path = "", init?: RequestInit) {
  return requestApi<T>(`/due-date-rules${path}`, init, {
    errorFactory: ({ message, code, status }) => new DueDateRulesApiError(message, code, status),
  });
}
export const getDueDateRules = () => request<DueDateRulesOutput>();
export const getDueDateRuleOptions = () => request<DueDateRuleOptions>("/options");
export const saveDueDateRules = (input: SaveDueDateRulesInput) =>
  request<DueDateRulesOutput>("", { method: "PUT", body: JSON.stringify(input) });
export const previewDueDateRules = (input: SaveDueDateRulesInput) =>
  request<DueDateRulesPreview>("/preview", { method: "POST", body: JSON.stringify(input) });

export const getDueDateRuleHolidays = (year: number) =>
  request<DueDateRuleHolidays>(`/holidays?year=${year}`);

export const setDueDateException = (input: SetDueDateExceptionInput) =>
  request<{ excluded: boolean }>("/exception", { method: "PATCH", body: JSON.stringify(input) });
