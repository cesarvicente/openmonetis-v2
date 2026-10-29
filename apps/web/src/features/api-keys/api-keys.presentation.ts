import type { ApiKeyLifetimeDays } from "@openmonetis/domain/api-keys";
import { formatDateInBrazil } from "@openmonetis/shared/date-time";

export const apiKeyLifetimeSelectOptions: { value: string; label: string }[] = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "1 ano" },
  { value: "never", label: "Sem expiração" },
];

export function parseApiKeyLifetime(value: string): ApiKeyLifetimeDays | null {
  return value === "never" ? null : (Number(value) as ApiKeyLifetimeDays);
}

export function formatApiKeyDate(value: string) {
  return formatDateInBrazil(new Date(value), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(" de ", " ");
}

export function formatApiKeyLastUsed(value: string | null) {
  if (!value) return "Ainda não usada";
  return `Usada em ${formatApiKeyDate(value)}`;
}

export function formatApiKeyExpiration(value: string | null) {
  if (!value) return "Sem expiração";
  return `Expira em ${formatApiKeyDate(value)}`;
}

export function formatApiKeyUsageExample(origin: string, key: string) {
  return `curl -H "Authorization: Bearer ${key}" ${origin}/api-proxy/accounts`;
}
