export const apiKeyNameMaximumLength = 80;
export const apiKeyMaximumActiveCount = 10;
export const apiKeyPrefix = "omk_";
export const apiKeyLifetimeOptions = [30, 90, 365] as const;

export type ApiKeyLifetimeDays = (typeof apiKeyLifetimeOptions)[number];

export function normalizeApiKeyName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

// A null lifetime creates a key that stays valid until it is revoked.
export function getApiKeyExpiration(
  lifetimeDays: ApiKeyLifetimeDays | null,
  createdAt = new Date(),
) {
  if (lifetimeDays === null) return null;
  return new Date(createdAt.getTime() + lifetimeDays * 24 * 60 * 60 * 1_000);
}

export function hasApiKeyFormat(value: string) {
  return new RegExp(`^${apiKeyPrefix}[A-Za-z0-9_-]{43}$`).test(value);
}
