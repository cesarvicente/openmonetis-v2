export function extractBearerToken(value: string | undefined) {
  if (!value || value.length > 256) return null;
  return /^Bearer ([^\s]+)$/i.exec(value)?.[1] ?? null;
}
