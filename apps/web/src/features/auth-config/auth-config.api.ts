import { AuthConfigOutputSchema } from "@openmonetis/validators/auth-config";
import { requestApi } from "@/lib/api-client";

export async function getAuthConfig() {
  return AuthConfigOutputSchema.parse(await requestApi("/auth-config"));
}
