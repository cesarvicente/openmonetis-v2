import type { PersonReceivableOutput } from "@openmonetis/validators/reimbursements";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, HandCoins, RefreshCw } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardItemLinkArrow } from "@/features/dashboard/components/dashboard-item-link-arrow";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { useDashboardWidgetItems } from "@/features/dashboard/components/dashboard-widget-layout";
import { formatCurrency } from "@/lib/money-presentation";
import { getInitials } from "@/lib/name-presentation";
import { getReceivedPercentage } from "../reimbursements.presentation";
import { reimbursementsSummaryQueryOptions } from "../reimbursements.queries";

const skeletonKeys = ["first", "second"] as const;

export function ReimbursementsWidget({ period }: { period: string }) {
  const query = useQuery(reimbursementsSummaryQueryOptions(period));
  const summary = query.data;
  const items = summary?.items ?? [];
  const { visibleItems } = useDashboardWidgetItems(items, {
    loading: query.isPending,
    structure: "settlement",
  });

  return (
    <DashboardWidget
      action={
        summary?.overdueAmount ? (
          <Badge variant="destructive">{formatCurrency(summary.overdueAmount)} em atraso</Badge>
        ) : null
      }
      description="O que cada pessoa ainda deve a você"
      footer={
        items.length ? (
          <Link className={dashboardWidgetFooterNavigationLinkClassName} to="/people">
            Ver pessoas <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : undefined
      }
      icon={<HandCoins aria-hidden="true" />}
      title="Reembolsos por pessoa"
    >
      {query.isLoading ? (
        <div aria-label="Carregando reembolsos" className="grid gap-3 py-3" role="status">
          {skeletonKeys.map((key) => (
            <Skeleton className="h-29 w-full" key={key} />
          ))}
        </div>
      ) : null}
      {query.isError ? (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="font-medium text-sm">Não foi possível carregar os reembolsos</p>
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
      {summary && !query.isError ? (
        items.length ? (
          <ol aria-busy={query.isFetching} className="divide-y">
            {visibleItems.map((item) => (
              <ReimbursementItem item={item} key={item.personId} period={period} />
            ))}
          </ol>
        ) : (
          <DashboardWidgetEmptyState
            description="Despesas em nome de outra pessoa geram um reembolso aqui."
            icon={<HandCoins aria-hidden="true" />}
            title="Nada a receber"
          />
        )
      ) : null}
    </DashboardWidget>
  );
}

function ReimbursementItem({ item, period }: { item: PersonReceivableOutput; period: string }) {
  const percentage = getReceivedPercentage(
    item.receivedAmount,
    item.overdueAmount + item.dueAmount,
  );

  return (
    <li className="grid h-29 content-center gap-2">
      <div className="flex items-center gap-3">
        <Avatar className="size-8 overflow-hidden">
          {item.personAvatarUrl ? (
            <AvatarImage
              alt={`Avatar de ${item.personName}`}
              className="scale-[1.06]"
              src={item.personAvatarUrl}
            />
          ) : null}
          <AvatarFallback>{getInitials(item.personName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <Link
            className="group inline-flex min-w-0 items-center gap-1 rounded-sm font-medium text-sm transition-transform duration-200 ease-out hover:translate-x-1 focus-visible:translate-x-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
            params={{ personId: item.personId }}
            search={{ period, view: "transactions" }}
            to="/people/$personId"
          >
            <span className="truncate">{item.personName}</span>
            <DashboardItemLinkArrow />
          </Link>
          <p className="text-muted-foreground text-xs">
            {item.receivedAmount > 0
              ? `${formatCurrency(item.receivedAmount)} recebidos no mês`
              : "Nada recebido no mês"}
          </p>
        </div>
        <MoneyValue amount={item.pendingAmount} className="shrink-0 font-medium text-sm" />
      </div>

      <Progress
        aria-label={`${item.personName}: ${percentage}% recebido no mês`}
        indicatorClassName="bg-success"
        trackClassName="bg-warning/25"
        value={percentage}
      />

      <div className="grid grid-cols-3 gap-3 text-xs">
        <Amount amount={item.overdueAmount} className="text-destructive" label="Atrasado" />
        <Amount amount={item.dueAmount} label="A vencer" />
        <Amount amount={item.upcomingAmount} label="Futuro" />
      </div>
    </li>
  );
}

function Amount({
  amount,
  className,
  label,
}: {
  amount: number;
  className?: string;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <span className="block text-muted-foreground">{label}</span>
      <span className={amount > 0 ? className : undefined}>
        <MoneyValue amount={amount} className="font-medium text-sm" />
      </span>
    </div>
  );
}
