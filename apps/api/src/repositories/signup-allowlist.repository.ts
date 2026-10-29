import { db, signupAllowlist, user } from "@openmonetis/db";
import { asc, eq, sql } from "drizzle-orm";
import type { SignupAllowlistRepository } from "../services/signup-allowlist.service";

const registered = sql<boolean>`exists (
  select 1 from ${user} where lower(${user.email}) = ${signupAllowlist.email}
)`;

export const signupAllowlistRepository: SignupAllowlistRepository = {
  async list() {
    return db
      .select({
        id: signupAllowlist.id,
        email: signupAllowlist.email,
        role: signupAllowlist.role,
        registered,
        createdAt: signupAllowlist.createdAt,
      })
      .from(signupAllowlist)
      .orderBy(asc(signupAllowlist.email));
  },

  async insert(data) {
    const [record] = await db
      .insert(signupAllowlist)
      .values(data)
      .onConflictDoNothing({ target: signupAllowlist.email })
      .returning();
    if (!record) return null;

    const [status] = await db
      .select({ registered })
      .from(signupAllowlist)
      .where(eq(signupAllowlist.id, record.id));
    return { ...record, registered: status?.registered ?? false };
  },

  async insertIfMissing(data) {
    await db
      .insert(signupAllowlist)
      .values(data)
      .onConflictDoNothing({ target: signupAllowlist.email });
  },

  async findRoleByEmail(email) {
    const [record] = await db
      .select({ role: signupAllowlist.role })
      .from(signupAllowlist)
      .where(eq(signupAllowlist.email, email))
      .limit(1);
    return record?.role ?? null;
  },

  async remove(id) {
    const [record] = await db
      .delete(signupAllowlist)
      .where(eq(signupAllowlist.id, id))
      .returning({ id: signupAllowlist.id });
    return Boolean(record);
  },
};
