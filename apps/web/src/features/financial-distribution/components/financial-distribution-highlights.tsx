import type { FinancialDistributionOutput } from "@openmonetis/validators/financial-distribution";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Layers, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { MoneyValue } from "@/components/money-value";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryIcon } from "@/features/categories/category-icons";
import { distributionCategoryLabel } from "../financial-distribution.presentation";
import { FinancialDistributionPercentage } from "./financial-distribution-percentage";

type Props = { report: FinancialDistributionOutput; personScope: string };
type Category = FinancialDistributionOutput["categories"][number];

type TileProps = {
  label: string;
  icon: ReactNode;
  title: ReactNode;
  amount: number;
  percentage: number | null;
  percentageLabel: string;
};

function HighlightTile({ label, icon, title, amount, percentage, percentageLabel }: TileProps) {
  return (
    <div className="grid min-w-0 content-between gap-4 rounded-lg border bg-muted/20 p-4">
      <div className="grid gap-3">
        <p className="flex items-center gap-2 text-muted-foreground text-xs">
          <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-muted">
            {icon}
          </span>
          {label}
        </p>
        <div className="min-w-0 font-medium leading-snug">{title}</div>
      </div>
      <div className="grid gap-1">
        <MoneyValue amount={amount} className="text-2xl" />
        <span className="text-muted-foreground text-xs">
          <FinancialDistributionPercentage value={percentage} /> {percentageLabel}
        </span>
      </div>
    </div>
  );
}

function CategoryTitle({
  category,
  period,
  personScope,
}: {
  category: Category;
  period: string;
  personScope: string;
}) {
  const label = distributionCategoryLabel(category);
  const content = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <CategoryIcon name={category.icon} className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </>
  );
  return category.categoryId ? (
    <Link
      className="group flex min-w-0 items-center gap-2 rounded-sm hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      to="/categories/$categoryId"
      params={{ categoryId: category.categoryId }}
      search={{ period, personScope }}
      title={label}
    >
      {content}
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  ) : (
    <span className="flex min-w-0 items-center gap-2" title={label}>
      {content}
    </span>
  );
}

export function FinancialDistributionHighlights({ report, personScope }: Props) {
  const leadingExpenses = report.categories
    .filter((category) => category.type === "expense" && category.amount > 0)
    .slice(0, 2);
  const largestExpense = leadingExpenses[0];
  const largestIncome = report.categories
    .filter((category) => category.type === "income" && category.amount > 0)
    .reduce<Category | undefined>(
      (largest, category) => (!largest || category.amount > largest.amount ? category : largest),
      undefined,
    );

  return (
    <Card className="min-w-0 gap-0 pt-0">
      <CardHeader className="border-b py-5">
        <CardTitle>
          <h2>Destaques do mês</h2>
        </CardTitle>
        <CardDescription>
          As categorias que mais pesam nas suas receitas e despesas.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        {largestExpense || largestIncome ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {largestExpense ? (
              <HighlightTile
                label="Maior categoria de despesa"
                icon={<TrendingDown className="size-3.5" />}
                title={
                  <CategoryTitle
                    category={largestExpense}
                    period={report.period}
                    personScope={personScope}
                  />
                }
                amount={largestExpense.amount}
                percentage={largestExpense.percentage}
                percentageLabel="das despesas"
              />
            ) : null}
            {leadingExpenses.length > 1 ? (
              <HighlightTile
                label="Duas maiores despesas juntas"
                icon={<Layers className="size-3.5" />}
                title={
                  <p className="line-clamp-2">
                    {leadingExpenses.map(distributionCategoryLabel).join(" e ")}
                  </p>
                }
                amount={report.leadingExpensesAmount}
                percentage={report.leadingExpensesPercentage}
                percentageLabel="das despesas"
              />
            ) : null}
            {largestIncome ? (
              <HighlightTile
                label="Maior fonte de receita"
                icon={<TrendingUp className="size-3.5" />}
                title={
                  <CategoryTitle
                    category={largestIncome}
                    period={report.period}
                    personScope={personScope}
                  />
                }
                amount={largestIncome.amount}
                percentage={largestIncome.percentage}
                percentageLabel="das receitas"
              />
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Nenhuma movimentação neste período.</p>
        )}
      </CardContent>
    </Card>
  );
}
