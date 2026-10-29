import { isAdminRole } from "@openmonetis/domain/signup-allowlist";
import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

// Hides the admin UI from other users; the API enforces the same role on every admin request.
export function AdminRoute({ children }: { children: ReactNode }) {
  const session = authClient.useSession();

  if (session.isPending) return null;
  if (!session.data) return <Navigate to="/" replace />;
  if (!isAdminRole(session.data.user.role)) return <Navigate to="/dashboard" replace />;

  return children;
}
