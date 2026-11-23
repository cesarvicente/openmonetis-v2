import type { DashboardWidgetId } from "@openmonetis/domain/dashboard";
import {
  BookOpenText,
  CalendarClock,
  ChartNoAxesCombined,
  CircleDollarSign,
  CreditCard,
  FileClock,
  FolderKanban,
  Goal,
  HandCoins,
  Landmark,
  type LucideIcon,
  PieChart,
  ReceiptText,
  RefreshCcw,
  Tags,
  Target,
  Users,
  WalletCards,
  Waypoints,
} from "lucide-react";
import type { ReactNode } from "react";
import { BillsWidget } from "@/features/bills/components/bills-widget";
import { BudgetsWidget } from "@/features/budgets/components/budgets-widget";
import { CategoryTrendsWidget } from "@/features/category-trends/components/category-trends-widget";
import { GoalsWidget } from "@/features/goals/components/goals-widget";
import { InboxWidget } from "@/features/inbox/components/inbox-widget";
import { InstallmentExpensesWidget } from "@/features/installments/components/installment-expenses-widget";
import { InvoicesWidget } from "@/features/invoices/components/invoices-widget";
import { NotesWidget } from "@/features/notes/components/notes-widget";
import { RecurringExpensesWidget } from "@/features/recurring-expenses/components/recurring-expenses-widget";
import { ReimbursementsWidget } from "@/features/reimbursements/components/reimbursements-widget";
import { CategoryBreakdownWidget } from "./category-breakdown-widget";
import { CategoryTransactionsWidget } from "./category-transactions-widget";
import { IncomeExpenseBalanceWidget } from "./income-expense-balance-widget";
import { MyAccountsWidget } from "./my-accounts-widget";
import { PaymentConditionsWidget } from "./payment-conditions-widget";
import { PaymentMethodsWidget } from "./payment-methods-widget";
import { PaymentStatusWidget } from "./payment-status-widget";
import { PeopleWidget } from "./people-widget";

export type DashboardWidgetDefinition = {
  description: string;
  icon: LucideIcon;
  id: DashboardWidgetId;
  /** Falso para widgets sem lista, que não usam altura responsiva nem barra de rolagem. */
  isList: boolean;
  render: (period: string) => ReactNode;
  title: string;
};

export const dashboardWidgetRegistry: readonly DashboardWidgetDefinition[] = [
  {
    id: "accounts",
    title: "Minhas contas",
    description: "Saldos disponíveis e consolidado",
    icon: Landmark,
    isList: true,
    render: (period) => <MyAccountsWidget period={period} />,
  },
  {
    id: "invoices",
    title: "Minhas faturas",
    description: "Resumo das faturas do período",
    icon: CreditCard,
    isList: true,
    render: (period) => <InvoicesWidget period={period} />,
  },
  {
    id: "bills",
    title: "Contas a pagar",
    description: "Vencimentos e pagamentos do período",
    icon: ReceiptText,
    isList: true,
    render: (period) => <BillsWidget period={period} />,
  },
  {
    id: "payment-status",
    title: "Status de pagamento",
    description: "Valores confirmados e pendentes",
    icon: CircleDollarSign,
    isList: false,
    render: (period) => <PaymentStatusWidget period={period} />,
  },
  {
    id: "inbox",
    title: "Caixa de entrada",
    description: "Capturas e itens pendentes de revisão",
    icon: FileClock,
    isList: true,
    render: () => <InboxWidget />,
  },
  {
    id: "reimbursements",
    title: "Reembolsos por pessoa",
    description: "O que cada pessoa ainda deve a você",
    icon: HandCoins,
    isList: true,
    render: (period) => <ReimbursementsWidget period={period} />,
  },
  {
    id: "income-expense-balance",
    title: "Receitas, despesas e resultado",
    description: "Evolução dos últimos seis meses",
    icon: ChartNoAxesCombined,
    isList: false,
    render: (period) => <IncomeExpenseBalanceWidget period={period} />,
  },
  {
    id: "budgets",
    title: "Orçamentos",
    description: "Progresso por categoria no período",
    icon: FolderKanban,
    isList: true,
    render: (period) => <BudgetsWidget period={period} />,
  },
  {
    id: "goals",
    title: "Metas",
    description: "Progresso dos objetivos ativos",
    icon: Goal,
    isList: true,
    render: () => <GoalsWidget />,
  },
  {
    id: "category-trends",
    title: "Tendências de categorias",
    description: "Maiores variações contra o mês anterior",
    icon: Target,
    isList: true,
    render: (period) => <CategoryTrendsWidget period={period} />,
  },
  {
    id: "expense-categories",
    title: "Despesas por categoria",
    description: "Distribuição das despesas do período",
    icon: PieChart,
    isList: true,
    render: (period) => <CategoryBreakdownWidget period={period} variant="expense" />,
  },
  {
    id: "income-categories",
    title: "Receitas por categoria",
    description: "Distribuição das receitas do período",
    icon: PieChart,
    isList: true,
    render: (period) => <CategoryBreakdownWidget period={period} variant="income" />,
  },
  {
    id: "category-transactions",
    title: "Lançamentos por categoria",
    description: "Categorias com maior movimentação",
    icon: Tags,
    isList: true,
    render: (period) => <CategoryTransactionsWidget period={period} />,
  },
  {
    id: "people",
    title: "Pessoas",
    description: "Despesas por pessoa no período",
    icon: Users,
    isList: true,
    render: (period) => <PeopleWidget period={period} />,
  },
  {
    id: "payment-conditions",
    title: "Condições de pagamento",
    description: "À vista, parceladas e recorrentes",
    icon: Waypoints,
    isList: true,
    render: (period) => <PaymentConditionsWidget period={period} />,
  },
  {
    id: "payment-methods",
    title: "Formas de pagamento",
    description: "Distribuição por meio de pagamento",
    icon: WalletCards,
    isList: true,
    render: (period) => <PaymentMethodsWidget period={period} />,
  },
  {
    id: "installments",
    title: "Lançamentos parcelados",
    description: "Parcelas abertas e andamento",
    icon: CalendarClock,
    isList: true,
    render: (period) => <InstallmentExpensesWidget period={period} />,
  },
  {
    id: "recurring-expenses",
    title: "Lançamentos recorrentes",
    description: "Compromissos recorrentes do período",
    icon: RefreshCcw,
    isList: true,
    render: (period) => <RecurringExpensesWidget period={period} />,
  },
  {
    id: "notes",
    title: "Anotações",
    description: "Anotações ativas mais recentes",
    icon: BookOpenText,
    isList: true,
    render: () => <NotesWidget />,
  },
] as const;

export const dashboardWidgetById = new Map(
  dashboardWidgetRegistry.map((widget) => [widget.id, widget]),
);
