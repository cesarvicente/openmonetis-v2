import {
  getTagNameKey,
  normalizeTagName,
  summarizeTags,
  type TaggedFinancialEntry,
} from "@openmonetis/domain/tags";
import type { CreateTagInput, UpdateTagInput } from "@openmonetis/validators/tags";
import { conflict, notFound } from "../utils/errors";

export type TagRecord = {
  id: string;
  userId: string;
  name: string;
  nameKey: string;
  createdAt: Date;
  updatedAt: Date;
};
export type TagsRepository = {
  listForUser(userId: string): Promise<TagRecord[]>;
  createForUser(userId: string, name: string, nameKey: string): Promise<TagRecord | null>;
  updateForUser(
    id: string,
    userId: string,
    name: string,
    nameKey: string,
  ): Promise<TagRecord | null | "duplicate">;
  deleteForUser(id: string, userId: string): Promise<boolean>;
};
function toOutput(tag: TagRecord) {
  return {
    id: tag.id,
    name: tag.name,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  };
}
export function createTagsService(
  repository: TagsRepository,
  loadEntries: (userId: string, period: string) => Promise<TaggedFinancialEntry[]>,
) {
  return {
    async list(userId: string) {
      return (await repository.listForUser(userId)).map(toOutput);
    },
    async create(input: CreateTagInput, userId: string) {
      const tag = await repository.createForUser(
        userId,
        normalizeTagName(input.name),
        getTagNameKey(input.name),
      );
      if (!tag) throw conflict("Tag already exists", "tag_name_conflict");
      return toOutput(tag);
    },
    async update(id: string, input: UpdateTagInput, userId: string) {
      const tag = await repository.updateForUser(
        id,
        userId,
        normalizeTagName(input.name),
        getTagNameKey(input.name),
      );
      if (tag === "duplicate") throw conflict("Tag already exists", "tag_name_conflict");
      if (!tag) throw notFound("Tag not found", "tag_not_found");
      return toOutput(tag);
    },
    async remove(id: string, userId: string) {
      if (!(await repository.deleteForUser(id, userId)))
        throw notFound("Tag not found", "tag_not_found");
      return { id };
    },
    async report(period: string, userId: string) {
      const [tags, entries] = await Promise.all([
        repository.listForUser(userId),
        loadEntries(userId, period),
      ]);
      return {
        period,
        items: summarizeTags(
          tags.map((tag) => tag.id),
          entries,
        ),
      };
    },
  };
}
export type TagsService = ReturnType<typeof createTagsService>;
