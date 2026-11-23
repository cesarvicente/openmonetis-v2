import type { DashboardInstallmentExpensesOutput } from "@openmonetis/validators/installments";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ListOrdered, RefreshCw } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { useDashboardWidgetItems } from "@/features/dashboard/components/dashboard-widget-layout";
import { DashboardWidgetListSheet } from "@/features/dashboard/components/dashboard-widget-list-sheet";
import { DashboardWidgetRow } from "@/features/dashboard/components/dashboard-widget-row";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { cn } from "@/lib/utils";
import { formatInstallmentEndPeriod } from "../installments.presentation";
import { dashboardInstallmentExpensesQueryOptions } from "../installments.queries";

type InstallmentExpense = DashboardInstallmentExpensesOutput["items"][number];

export function InstallmentExpensesWidget({ period }: { period: string }) {
  const [isListOpen, setIsListOpen] = useState(false);
  const query = useQuery(dashboardInstallmentExpensesQueryOptions(period));
  const items = query.data?.items ?? [];
  const { hiddenCount, visibleItems } = useDashboardWidgetItems(items, {
    loading: query.isPending,
    structure: "progress",
  });

  return (
    <DashboardWidget
      description="Parcelas do mês mais próximas da quitação"
      footer={
        items.length > 0 ? (
          <div className="flex items-center justify-between gap-3">
            {hiddenCount > 0 ? (
              <DashboardWidgetListSheet
                description="Consulte valores e progresso dos parcelamentos no mês."
                onOpenChange={setIsListOpen}
                open={isListOpen}
                title="Despesas parceladas"
                triggerLabel={`Ver mais ${hiddenCount} ${hiddenCount === 1 ? "despesa" : "despesas"}`}
              >
                <InstallmentExpenseList items={items} />
              </DashboardWidgetListSheet>
            ) : null}
            <Link
              className={dashboardWidgetFooterNavigationLinkClassName}
              search={{ period, status: "open" }}
              to="/reports/installments"
            >
              Ver parcelamentos <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        ) : undefined
      }
      icon={<ListOrdered aria-hidden="true" />}
      title="Despesas parceladas"
    >
      {query.isLoading ? <InstallmentExpensesLoading /> : null}
      {query.isError ? (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="font-medium text-sm">Não foi possível carregar os parcelamentos</p>
            <Button
              className="mt-3"
              onClick={() => void query.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" /> Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}
      {query.data && !query.isError ? (
        items.length === 0 ? (
          <DashboardWidgetEmptyState
            description="As parcelas do mês aparecerão aqui."
            icon={<ListOrdered aria-hidden="true" />}
            title="Nenhuma parcela neste mês"
          />
        ) : (
          <div aria-busy={query.isFetching} className="flex flex-1 flex-col">
            <InstallmentExpenseList items={visibleItems} />
          </div>
        )
      ) : null}
    </DashboardWidget>
  );
}

function InstallmentExpenseList({ items }: { items: InstallmentExpense[] }) {
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <DashboardWidgetRow key={item.seriesId} structure="progress">
          <EstablishmentLogo
            categoryIcon={item.categoryIcon}
            className="size-8"
            name={item.name}
            size={32}
          />
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-1">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-sm">{item.name}</span>
                </div>
                <p className="truncate text-muted-foreground text-xs">
                  Parcela {item.currentInstallment} de {item.totalInstallments}
                  {item.endPeriod ? ` · ${formatInstallmentEndPeriod(item.endPeriod)}` : null}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <MoneyValue amount={item.amount} className="font-medium text-sm" />
                <p
                  className={cn("text-xs", item.isPaid ? "text-success" : "text-muted-foreground")}
                >
                  {item.isPaid ? "Paga" : `${item.pendingInstallmentCount} em aberto`}
                </p>
              </div>
            </div>
            <Progress
              aria-label={`Progresso do parcelamento: ${Math.round(item.progressPercentage)}%`}
              indicatorClassName="bg-brand/70"
              trackClassName="h-2 min-h-2"
              value={item.progressPercentage}
            />
          </div>
        </DashboardWidgetRow>
      ))}
    </ul>
  );
}

function InstallmentExpensesLoading() {
  return (
    <div aria-label="Carregando despesas parceladas" className="grid gap-3" role="status">
      {["first", "second", "third", "fourth"].map((key) => (
        <Skeleton className="h-15 w-full" key={key} />
      ))}
    </div>
  );
}
