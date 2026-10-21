import { ApiClientError } from "@/lib/api-client";
export function getTagErrorMessage(error: unknown) {
  return error instanceof ApiClientError && error.code === "tag_name_conflict"
    ? "Já existe uma etiqueta com esse nome."
    : "Não foi possível salvar a etiqueta. Tente novamente.";
}
