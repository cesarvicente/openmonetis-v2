import { serve } from "@hono/node-server";
import { app } from "./app";
import { signupAllowlistRepository } from "./repositories/signup-allowlist.repository";
import { createSignupAllowlistService } from "./services/signup-allowlist.service";

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 7001);
const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim();

// Guarantees the first administrator can sign up on a fresh database; existing entries are kept.
if (initialAdminEmail) {
  await createSignupAllowlistService(signupAllowlistRepository).ensureInitialAdmin(
    initialAdminEmail,
  );
}

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`OpenMonetis API listening on http://localhost:${info.port}`);
  },
);

export { app };
