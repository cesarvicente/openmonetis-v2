import { formatDateInBrazil } from "@openmonetis/shared/date-time";
import type { UserRole } from "@openmonetis/validators/signup-allowlist";
import { ApiClientError } from "../../lib/api-client";

export const userRoleLabels: Record<UserRole, string> = {
  member: "Usuário",
  admin: "Administrador",
};

export function formatSignupAllowlistDate(value: string) {
  return formatDateInBrazil(new Date(value), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(" de ", " ");
}

export function signupAllowlistCreateErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === "signup_allowlist_entry_exists") return "Este e-mail já está autorizado.";
    if (error.status === 429) return "Muitas tentativas. Aguarde um minuto e tente novamente.";
  }
  return "Não foi possível autorizar o e-mail.";
}
