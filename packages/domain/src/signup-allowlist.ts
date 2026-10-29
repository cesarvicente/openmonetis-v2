export const userRoles = ["member", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const signupEmailMaximumLength = 320;

export function normalizeSignupEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAdminRole(role: unknown): role is "admin" {
  return role === "admin";
}
