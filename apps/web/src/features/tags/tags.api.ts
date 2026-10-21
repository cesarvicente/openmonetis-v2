import type {
  CreateTagInput,
  TagOutput,
  TagsReportOutput,
  UpdateTagInput,
} from "@openmonetis/validators/tags";
import { requestApi } from "@/lib/api-client";
export const getTags = () => requestApi<TagOutput[]>("/tags");
export const createTag = (input: CreateTagInput) =>
  requestApi<TagOutput>("/tags", { method: "POST", body: JSON.stringify(input) });
export const updateTag = ({ id, input }: { id: string; input: UpdateTagInput }) =>
  requestApi<TagOutput>(`/tags/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteTag = (id: string) =>
  requestApi<{ id: string }>(`/tags/${id}`, { method: "DELETE" });
export const getTagsReport = (period: string) =>
  requestApi<TagsReportOutput>(`/tags/report?${new URLSearchParams({ period })}`);
