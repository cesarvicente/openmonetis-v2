import { useQuery } from "@tanstack/react-query";
import { Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { tagsQueryOptions } from "../tags.queries";
export function TransactionTags({ tagIds }: { tagIds?: string[] }) {
  const query = useQuery({ ...tagsQueryOptions(), enabled: Boolean(tagIds?.length) });
  if (!tagIds?.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {query.data
        ?.filter((tag) => tagIds.includes(tag.id))
        .map((tag) => (
          <Badge variant="secondary" className="max-w-48 text-xs" title={tag.name} key={tag.id}>
            <Tag aria-hidden="true" data-icon="inline-start" className="shrink-0" />
            <span className="truncate">{tag.name}</span>
          </Badge>
        ))}
    </span>
  );
}
