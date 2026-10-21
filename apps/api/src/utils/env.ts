const PRODUCTION = process.env.NODE_ENV === "production";

function requireProductionEnv(name: string) {
  const value = process.env[name];

  if (PRODUCTION && !value) {
    throw new Error(`${name} is required in production`);
  }

  return value;
}

export function parseCsvEnv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseBooleanEnv(name: string, fallback = false) {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

export function getRequiredProductionEnv(name: string, fallback: string) {
  return requireProductionEnv(name) ?? fallback;
}

export function assertProductionSecret(name: string, unsafeValues: string[]) {
  const value = requireProductionEnv(name);

  if (PRODUCTION && value && unsafeValues.includes(value)) {
    throw new Error(`${name} uses an unsafe production value`);
  }

  return value;
}

export function parsePositiveIntegerEnv(name: string, fallback: number) {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
