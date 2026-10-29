import { normalizeSignupEmail, type UserRole } from "@openmonetis/domain/signup-allowlist";
import type {
  CreateSignupAllowlistEntryInput,
  SignupAllowlistEntryOutput,
} from "@openmonetis/validators/signup-allowlist";
import { conflict, notFound } from "../utils/errors";

type SignupAllowlistRecord = {
  id: string;
  email: string;
  role: UserRole;
  registered: boolean;
  createdAt: Date;
};

export type SignupAllowlistRepository = {
  list(): Promise<SignupAllowlistRecord[]>;
  insert(data: { email: string; role: UserRole }): Promise<SignupAllowlistRecord | null>;
  insertIfMissing(data: { email: string; role: UserRole }): Promise<void>;
  findRoleByEmail(email: string): Promise<UserRole | null>;
  remove(id: string): Promise<boolean>;
};

// The allowlist is instance-wide: it is managed by admins and is not owned by a single user.
export function createSignupAllowlistService(repository: SignupAllowlistRepository) {
  return {
    async list(): Promise<SignupAllowlistEntryOutput[]> {
      return (await repository.list()).map(toOutput);
    },

    async create(input: CreateSignupAllowlistEntryInput): Promise<SignupAllowlistEntryOutput> {
      const record = await repository.insert({
        email: normalizeSignupEmail(input.email),
        role: input.role,
      });
      if (!record) {
        throw conflict("Email is already allowed to sign up", "signup_allowlist_entry_exists");
      }
      return toOutput(record);
    },

    async remove(id: string) {
      const removed = await repository.remove(id);
      if (!removed) {
        throw notFound("Signup allowlist entry not found", "signup_allowlist_entry_not_found");
      }
      return { id };
    },

    async resolveSignupRole(email: string): Promise<UserRole | null> {
      return repository.findRoleByEmail(normalizeSignupEmail(email));
    },

    async ensureInitialAdmin(email: string) {
      await repository.insertIfMissing({ email: normalizeSignupEmail(email), role: "admin" });
    },
  };
}

function toOutput(record: SignupAllowlistRecord): SignupAllowlistEntryOutput {
  return {
    id: record.id,
    email: record.email,
    role: record.role,
    registered: record.registered,
    createdAt: record.createdAt.toISOString(),
  };
}

export type SignupAllowlistService = ReturnType<typeof createSignupAllowlistService>;
