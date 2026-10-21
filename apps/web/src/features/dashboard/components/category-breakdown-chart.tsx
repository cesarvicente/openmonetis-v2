import type { DashboardCategoryBreakdownOutput } from "@openmonetis/validators/dashboard";
import { DashboardDistributionChart } from "./dashboard-distribution-chart";

type CategoryBreakdownItem = DashboardCategoryBreakdownOutput["expenses"][number];
const maximumChartCategories = 7;

export function CategoryBreakdownChart({
  items,
  percentageDigits,
}: {
  items: CategoryBreakdownItem[];
  percentageDigits: number;
}) {
  return (
    <DashboardDistributionChart
      items={createChartData(items)}
      percentageDigits={percentageDigits}
      label="Distribuição por categoria"
    />
  );
}

function createChartData(items: CategoryBreakdownItem[]) {
  const positiveItems = items.filter((item) => item.amount > 0);
  const positiveTotal = positiveItems.reduce((total, item) => total + item.amount, 0);
  const visibleItems = positiveItems.slice(0, maximumChartCategories);
  const entries = visibleItems.map((item) => ({
    key: item.categoryId,
    label: item.categoryName,
    percentage: positiveTotal > 0 ? (item.amount / positiveTotal) * 100 : 0,
    amount: item.amount,
  }));
  const remainingItems = positiveItems.slice(maximumChartCategories);

  if (remainingItems.length > 0) {
    entries.push({
      key: "others",
      label: "Outros",
      percentage:
        positiveTotal > 0
          ? (remainingItems.reduce((total, item) => total + item.amount, 0) / positiveTotal) * 100
          : 0,
      amount: remainingItems.reduce((total, item) => total + item.amount, 0),
    });
  }

  return entries;
}
