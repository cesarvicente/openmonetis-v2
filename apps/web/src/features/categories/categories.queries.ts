import { queryOptions } from "@tanstack/react-query";
import { getCategories, getCategory } from "./categories.api";
import { categoryIconOptions } from "./category-icons";

const categoryKeys = {
  all: ["categories"] as const,
  detail: (id: string) => ["categories", id] as const,
};
export const categoriesQueryOptions = () =>
  queryOptions({ queryKey: categoryKeys.all, queryFn: getCategories });
export const categoryQueryOptions = (id: string) =>
  queryOptions({ queryKey: categoryKeys.detail(id), queryFn: () => getCategory(id) });

/** Biblioteca de ícones carregada sob demanda, fora do pacote inicial da aplicação. */
export const categoryIconLibraryQueryOptions = () =>
  queryOptions({
    queryKey: ["category-icon-library"],
    queryFn: async () => {
      const { categoryIconGroups, createCategoryIconLibrary, getCategoryIconSections } =
        await import("./category-icon-library");
      return {
        groups: categoryIconGroups,
        options: createCategoryIconLibrary(categoryIconOptions),
        getSections: getCategoryIconSections,
      };
    },
    staleTime: Number.POSITIVE_INFINITY,
    structuralSharing: false,
  });
