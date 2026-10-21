import type { DashboardExpenseDistributionOutput } from "@openmonetis/validators/dashboard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Layers3 } from "lucide-react";
import { useState } from "react";
import {
  transactionConditionIcons,
  transactionConditionLabels,
} from "@/features/transactions/transactions.presentation";
import { dashboardExpenseDistributionQueryOptions } from "../dashboard.queries";
import { useAdminPersonSlug } from "../useAdminPersonSlug";
import { DashboardDistributionChart } from "./dashboard-distribution-chart";
import { DashboardWidget } from "./dashboard-widget";
import { dashboardWidgetFooterNavigationLinkClassName } from "./dashboard-widget-footer-link";
import { DashboardWidgetViewToggle } from "./dashboard-widget-view-toggle";
import {
  ExpenseDistributionList,
  type ExpenseDistributionListItem,
} from "./expense-distribution-list";
import {
  DistributionEmpty,
  DistributionError,
  DistributionLoading,
} from "./expense-distribution-states";

export function PaymentConditionsWidget({ period }: { period: string }) {
  const [activeView, setActiveView] = useState<"list" | "chart">("list");
  const query = useQuery(dashboardExpenseDistributionQueryOptions(period));
  const adminPersonSlug = useAdminPersonSlug();
  const items = query.data ? buildItems(query.data.conditions, period, adminPersonSlug) : [];

  return (
    <DashboardWidget
      action={
        query.data && !query.isError && items.length > 0 ? (
          <DashboardWidgetViewToggle
            view={activeView}
            onToggle={() => setActiveView((view) => (view === "list" ? "chart" : "list"))}
          />
        ) : undefined
      }
      description="Despesas à vista, parceladas e recorrentes"
      footer={
        items.length > 0 && adminPersonSlug ? (
          <Link
            className={dashboardWidgetFooterNavigationLinkClassName}
            search={{ people: adminPersonSlug, period, type: "expense" }}
            to="/transactions"
          >
            Ver despesas <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : undefined
      }
      icon={<Layers3 aria-hidden="true" />}
      title="Condições de pagamento"
    >
      {query.isLoading ? <DistributionLoading /> : null}
      {query.isError ? <DistributionError onRetry={() => void query.refetch()} /> : null}
      {query.data && !query.isError ? (
        items.length === 0 ? (
          <DistributionEmpty />
        ) : activeView === "chart" ? (
          <div aria-busy={query.isFetching} className="flex flex-1 items-center">
            <DashboardDistributionChart
              items={items}
              label="Distribuição por condição de pagamento"
            />
          </div>
        ) : (
          <div aria-busy={query.isFetching} className="flex flex-1 flex-col">
            <ExpenseDistributionList items={items} />
          </div>
        )
      ) : null}
    </DashboardWidget>
  );
}

function buildItems(
  conditions: DashboardExpenseDistributionOutput["conditions"],
  period: string,
  adminPersonSlug?: string,
): ExpenseDistributionListItem[] {
  return conditions.map((condition) => {
    const Icon = transactionConditionIcons[condition.key];

    return {
      ...condition,
      icon: <Icon aria-hidden="true" />,
      label: transactionConditionLabels[condition.key],
      search: adminPersonSlug
        ? { condition: condition.key, people: adminPersonSlug, period, type: "expense" }
        : undefined,
    };
  });
}
