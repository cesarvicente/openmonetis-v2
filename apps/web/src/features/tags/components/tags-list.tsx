import type { TagOutput, TagsReportOutput } from "@openmonetis/validators/tags";
import { Link } from "@tanstack/react-router";
import { Pencil, Tag, Trash2 } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const reportColumns = [
  { key: "income", label: "Receitas" },
  { key: "expenses", label: "Despesas" },
  { key: "balance", label: "Resultado" },
] as const;

export function TagsList({
  tags,
  period,
  report,
  loading,
  onEdit,
  onRemove,
}: {
  tags: TagOutput[];
  period: string;
  report: TagsReportOutput | undefined;
  loading: boolean;
  onEdit: (tag: TagOutput) => void;
  onRemove: (tag: TagOutput) => void;
}) {
  function tagLink(tag: TagOutput) {
    return (
      <Link
        className="inline-flex min-w-0 items-center gap-2 font-medium hover:underline"
        to="/transactions"
        search={{ period, tags: tag.id }}
      >
        <Tag aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 break-words">{tag.name}</span>
      </Link>
    );
  }
  function tagActions(tag: TagOutput) {
    return (
      <div className="flex shrink-0 items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="max-md:size-11"
          aria-label={`Editar ${tag.name}`}
          onClick={() => onEdit(tag)}
        >
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="max-md:size-11"
          aria-label={`Excluir ${tag.name}`}
          onClick={() => onRemove(tag)}
        >
          <Trash2 aria-hidden="true" className="text-destructive" />
        </Button>
      </div>
    );
  }
  function reportValue(tagId: string, key: (typeof reportColumns)[number]["key"]) {
    const totals = report?.items.find((item) => item.tagId === tagId);
    return totals ? (
      <MoneyValue amount={totals[key]} />
    ) : (
      <span className="text-muted-foreground text-sm">
        {loading ? "Carregando..." : "Indisponível"}
      </span>
    );
  }
  return (
    <>
      <ul className="grid min-w-0 gap-3 md:hidden" aria-label="Etiquetas">
        {tags.map((tag) => (
          <li className="min-w-0" key={tag.id}>
            <Card className="min-w-0 gap-3 p-4">
              <div className="flex min-w-0 items-center justify-between gap-2">
                {tagLink(tag)}
                {tagActions(tag)}
              </div>
              <dl className="grid gap-2">
                {reportColumns.map(({ key, label }) => (
                  <div className="flex items-baseline justify-between gap-3" key={key}>
                    <dt className="text-muted-foreground text-sm">{label}</dt>
                    <dd className={key === "balance" ? "font-medium" : undefined}>
                      {reportValue(tag.id, key)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </li>
        ))}
      </ul>
      <Card className="hidden min-w-0 overflow-hidden py-2 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etiqueta</TableHead>
              {reportColumns.map(({ key, label }) => (
                <TableHead key={key}>{label}</TableHead>
              ))}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.map((tag) => (
              <TableRow key={tag.id}>
                <TableCell className="max-w-64">{tagLink(tag)}</TableCell>
                {reportColumns.map(({ key }) => (
                  <TableCell key={key}>{reportValue(tag.id, key)}</TableCell>
                ))}
                <TableCell>{tagActions(tag)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
