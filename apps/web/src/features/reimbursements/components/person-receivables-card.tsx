import type { PersonOutput } from "@openmonetis/validators/people";
import { useQuery } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeriod } from "@/features/transactions/transactions.presentation";
import { reimbursementsSummaryQueryOptions } from "../reimbursements.queries";
import { PersonReceivableRows } from "./person-receivable-rows";

export function PersonReceivablesCard({
  period,
  person,
}: {
  period: string;
  person: PersonOutput;
}) {
  const query = useQuery({
    ...reimbursementsSummaryQueryOptions(period),
    enabled: person.role === "external",
  });
  if (person.role !== "external") return null;
  const receivable = query.data?.items.find((item) => item.personId === person.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HandCoins aria-hidden="true" className="size-4 text-muted-foreground" />
          Reembolsos
        </CardTitle>
        <CardDescription className="text-xs">
          O que {person.name} ainda deve e o que já pagou. Registre os recebimentos em Lançamentos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {query.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : query.isError ? (
          <p className="text-muted-foreground text-sm">Não foi possível carregar os reembolsos.</p>
        ) : receivable ? (
          <>
            <div>
              <p className="text-muted-foreground text-xs">Total a receber</p>
              <MoneyValue
                amount={receivable.pendingAmount}
                className="font-semibold text-2xl tracking-tight"
              />
            </div>
            <PersonReceivableRows periodLabel={formatPeriod(period)} receivable={receivable} />
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Nada a receber.</p>
        )}
      </CardContent>
    </Card>
  );
}
