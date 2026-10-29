import { passkeyClient } from "@better-auth/passkey/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    passkeyClient(),
    inferAdditionalFields({
      user: { role: { type: "string", required: false, input: false } },
    }),
  ],
});
