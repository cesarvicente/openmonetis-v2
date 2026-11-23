import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Inbox, RefreshCw } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { useDashboardWidgetItems } from "@/features/dashboard/components/dashboard-widget-layout";
import { DashboardWidgetRow } from "@/features/dashboard/components/dashboard-widget-row";
import { formatInboxTimestamp, getInboxSourceMatch } from "../inbox.presentation";
import { inboxSnapshotQueryOptions } from "../inbox.queries";
import { InboxSourceLogo } from "./inbox-source-logo";

const maximumCaptures = 50;

export function InboxWidget() {
  const query = useQuery(inboxSnapshotQueryOptions(maximumCaptures));
  const accountsQuery = useQuery(accountsQueryOptions());
  const cardsQuery = useQuery(cardsQueryOptions());
  const snapshot = query.data;
  const { visibleItems: visibleCompanionItems } = useDashboardWidgetItems(
    snapshot?.recentItems ?? [],
  );

  return (
    <DashboardWidget
      action={
        snapshot?.pendingCount ? <Badge variant="secondary">{snapshot.pendingCount}</Badge> : null
      }
      description="Capturas aguardando sua confirmação"
      footer={
        snapshot && snapshot.pendingCount > 0 ? (
          <Link
            className={dashboardWidgetFooterNavigationLinkClassName}
            search={{
              app: undefined,
              date: undefined,
              page: undefined,
              rule: undefined,
              status: undefined,
            }}
            to="/inbox"
          >
            Ver caixa de entrada <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : undefined
      }
      icon={<Inbox aria-hidden="true" />}
      title="Caixa de entrada"
    >
      {query.isLoading ? <InboxWidgetLoading /> : null}
      {query.isError ? (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="font-medium text-sm">Não foi possível carregar as capturas</p>
            <Button
              className="mt-3"
              onClick={() => void query.refetch()}
              size="sm"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" /> Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}
      {snapshot && !query.isError ? (
        snapshot.pendingCount === 0 ? (
          <DashboardWidgetEmptyState
            description="Novas capturas aparecerão aqui."
            icon={<Inbox aria-hidden="true" />}
            title="Nenhuma captura pendente"
          />
        ) : (
          <ul className="divide-y">
            {visibleCompanionItems.map((item) => {
              const sourceMatch = getInboxSourceMatch(
                item.sourceAppName,
                accountsQuery.data ?? [],
                cardsQuery.data ?? [],
              );
              return (
                <DashboardWidgetRow key={item.id}>
                  <InboxSourceLogo className="size-8" match={sourceMatch} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">
                      {item.parsedName ?? "Notificação financeira"}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">
                      {sourceMatch
                        ? `${sourceMatch.kind === "card" ? "Cartão" : "Conta"} · ${sourceMatch.name}`
                        : (item.sourceAppName ?? "App financeiro")}{" "}
                      · {formatInboxTimestamp(item.notificationTimestamp)}
                    </p>
                  </div>
                  {item.parsedAmount !== null ? (
                    <MoneyValue
                      amount={item.parsedAmount}
                      className="shrink-0 font-medium text-sm"
                    />
                  ) : null}
                </DashboardWidgetRow>
              );
            })}
          </ul>
        )
      ) : null}
    </DashboardWidget>
  );
}

function InboxWidgetLoading() {
  return (
    <div className="grid gap-2 py-2" role="status" aria-label="Carregando Caixa de entrada">
      {["first", "second", "third", "fourth"].map((key) => (
        <Skeleton className="h-12" key={key} />
      ))}
    </div>
  );
}
