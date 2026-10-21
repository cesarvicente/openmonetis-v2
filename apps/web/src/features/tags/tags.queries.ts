import { queryOptions } from "@tanstack/react-query";
import { getTags, getTagsReport } from "./tags.api";
export const tagsQueryOptions = () => queryOptions({ queryKey: ["tags"], queryFn: getTags });
export const tagsReportQueryOptions = (period: string) =>
  queryOptions({ queryKey: ["tags", "report", period], queryFn: () => getTagsReport(period) });
