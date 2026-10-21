import {
  assertCategoryHierarchy,
  CategoryConstraintError,
  type CategoryCreateDraft,
  type CategoryType,
  canChangeCategoryType,
  createCategoryDraft,
  createDefaultCategoryDrafts,
} from "@openmonetis/domain/categories";
import type {
  CategoryOutput,
  CreateCategoryInput,
  ReplaceCategoryInput,
  UpdateCategoryInput,
} from "@openmonetis/validators/categories";
import { badRequest, conflict, notFound } from "../utils/errors";

export type CategoryRecord = {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  isSystem: boolean;
  parentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
type CategoryCreateRecord = Omit<CategoryRecord, "id" | "createdAt" | "updatedAt">;
type CategoryUpdateRecord = Partial<Pick<CategoryRecord, "name" | "type" | "icon" | "parentId">>;
export type CategoriesRepository = {
  insertDefaults(data: CategoryCreateDraft[]): Promise<void>;
  insert(data: CategoryCreateRecord): Promise<CategoryRecord>;
  listByUser(userId: string): Promise<CategoryRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<CategoryRecord | null>;
  findSystemByNameForUser(name: string, userId: string): Promise<CategoryRecord | null>;
  updateForUser(
    id: string,
    userId: string,
    data: CategoryUpdateRecord,
  ): Promise<CategoryRecord | null>;
  deleteForUser(id: string, userId: string): Promise<CategoryRecord | null>;
  hasFinancialReferencesForUser(id: string, userId: string): Promise<boolean>;
};

function toOutput(
  category: CategoryRecord,
  categories: readonly CategoryRecord[] = [],
): CategoryOutput {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    icon: category.icon,
    isSystem: category.isSystem,
    parentId: category.parentId ?? null,
    parentName: categories.find((item) => item.id === category.parentId)?.name ?? null,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function createCategoriesService(repository: CategoriesRepository) {
  async function write<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof CategoryConstraintError) {
        if (error.code === "category_name_conflict")
          throw conflict("Category name already exists in this group", error.code);
        throw badRequest("Invalid category hierarchy or category in use", error.code);
      }
      throw error;
    }
  }
  async function validateHierarchy(
    id: string | undefined,
    userId: string,
    type: CategoryType,
    parentId: string | null,
  ) {
    const categories = await repository.listByUser(userId);
    assertCategoryHierarchy({ id, type, parentId, categories });
    return categories;
  }
  async function editableCategory(id: string, userId: string) {
    const category = await repository.findByIdForUser(id, userId);
    if (!category || category.isSystem) throw notFound("Category not found", "category_not_found");
    return category;
  }
  async function assertTypeChange(
    category: CategoryRecord,
    nextType: CategoryType,
    userId: string,
  ) {
    if (category.type === nextType) return;
    const hasFinancialReferences = await repository.hasFinancialReferencesForUser(
      category.id,
      userId,
    );
    if (
      !canChangeCategoryType({
        currentType: category.type,
        nextType,
        hasFinancialReferences,
      })
    ) {
      throw badRequest("The type of a category in use cannot be changed", "category_type_in_use");
    }
  }
  return {
    async seedDefaults(userId: string) {
      await repository.insertDefaults(createDefaultCategoryDrafts(userId));
    },
    async create(input: CreateCategoryInput, userId: string) {
      return write(async () => {
        const categories = await validateHierarchy(
          undefined,
          userId,
          input.type,
          input.parentId ?? null,
        );
        return toOutput(
          await repository.insert(
            createCategoryDraft({
              userId,
              name: input.name,
              type: input.type,
              icon: input.icon ?? null,
              parentId: input.parentId ?? null,
            }),
          ),
          categories,
        );
      });
    },
    async list(userId: string) {
      const categories = await repository.listByUser(userId);
      return categories.map((category) => toOutput(category, categories));
    },
    async get(id: string, userId: string) {
      const category = await repository.findByIdForUser(id, userId);
      if (!category) throw notFound("Category not found", "category_not_found");
      return toOutput(category, await repository.listByUser(userId));
    },
    async replace(id: string, userId: string, input: ReplaceCategoryInput) {
      return write(async () => {
        const current = await editableCategory(id, userId);
        const parentId = input.parentId === undefined ? (current.parentId ?? null) : input.parentId;
        const categories = await validateHierarchy(id, userId, input.type, parentId);
        await assertTypeChange(current, input.type, userId);
        const category = await repository.updateForUser(id, userId, {
          name: input.name.trim(),
          type: input.type,
          icon: input.icon?.trim() || null,
          parentId,
        });
        if (!category) throw notFound("Category not found", "category_not_found");
        return toOutput(category, categories);
      });
    },
    async update(id: string, userId: string, input: UpdateCategoryInput) {
      return write(async () => {
        const current = await editableCategory(id, userId);
        const categories = await validateHierarchy(
          id,
          userId,
          input.type ?? current.type,
          input.parentId === undefined ? (current.parentId ?? null) : input.parentId,
        );
        if (input.type !== undefined) await assertTypeChange(current, input.type, userId);
        const values: CategoryUpdateRecord = {};
        if (input.name !== undefined) values.name = input.name.trim();
        if (input.type !== undefined) values.type = input.type;
        if (input.icon !== undefined) values.icon = input.icon?.trim() || null;
        if (input.parentId !== undefined) values.parentId = input.parentId;
        const category = await repository.updateForUser(id, userId, values);
        if (!category) throw notFound("Category not found", "category_not_found");
        return toOutput(category, categories);
      });
    },
    async remove(id: string, userId: string) {
      return write(async () => {
        await editableCategory(id, userId);
        if ((await repository.listByUser(userId)).some((category) => category.parentId === id))
          throw new CategoryConstraintError("category_has_children");
        if (await repository.hasFinancialReferencesForUser(id, userId))
          throw badRequest("Category has financial references", "category_in_use");
        const category = await repository.deleteForUser(id, userId);
        if (!category) throw notFound("Category not found", "category_not_found");
        return { id: category.id };
      });
    },
  };
}
export type CategoriesService = ReturnType<typeof createCategoriesService>;
