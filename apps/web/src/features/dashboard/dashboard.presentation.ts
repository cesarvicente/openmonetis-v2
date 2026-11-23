import {
  type DashboardWidgetId,
  type DashboardWidgetLayout,
  type DashboardWidgetPreferences,
  dashboardWidgetIds,
  dashboardWidgetSpan,
} from "@openmonetis/domain/dashboard";
import {
  formatDateInBrazil,
  getCurrentHourInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";

export type MetricTrend = "down" | "flat" | "up";

const trendThreshold = 0.005;

export function getDashboardGreeting(date = new Date()) {
  const hour = getCurrentHourInBrazil(date);
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function formatDashboardDate(date = new Date()) {
  const formatted = formatDateInBrazil(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return `${formatted.charAt(0).toLocaleUpperCase("pt-BR")}${formatted.slice(1)}`;
}

export function getMetricComparison(current: number, previous: number) {
  if (Math.abs(previous) < 0.01) {
    return {
      label: Math.abs(current) < 0.01 ? "0%" : null,
      trend: "flat" as MetricTrend,
    };
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const boundedChange = Math.max(-999, Math.min(999, change));
  const trend: MetricTrend =
    change > trendThreshold ? "up" : change < -trendThreshold ? "down" : "flat";
  const label = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
    signDisplay: "always",
    style: "percent",
  }).format(boundedChange / 100);

  return { label, trend };
}

export function formatProjectedMetricHelp(period: string) {
  const formattedPeriod = formatDashboardPeriod(period).toLocaleLowerCase("pt-BR");

  return `Saldo das contas consideradas, incluindo somente entradas e saídas ainda pendentes até o fim de ${formattedPeriod}.`;
}

export function getAccountBalanceShare(balance: number, totalMagnitude: number) {
  if (totalMagnitude <= 0) return 0;
  return Math.min(100, (Math.abs(balance) / totalMagnitude) * 100);
}

export function formatAccountBalanceShare(share: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(share);
}

export function getPaymentStatusPercentage(confirmed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (confirmed / total) * 100));
}

export function formatDashboardPeriod(period: string, compact = false) {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;

  const formatted = formatDateInBrazil(periodToSafeInstant(period), {
    month: compact ? "short" : "long",
    ...(compact ? {} : { year: "numeric" }),
  });

  const normalized = formatted.replace(".", "");
  return compact
    ? normalized.toLocaleLowerCase("pt-BR")
    : `${normalized.charAt(0).toLocaleUpperCase("pt-BR")}${normalized.slice(1)}`;
}

export function formatExpenseDistributionPercentage(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDashboardTransactionCount(count: number) {
  return `${count} ${count === 1 ? "lançamento" : "lançamentos"}`;
}

export function reorderDashboardWidget(
  preferences: DashboardWidgetPreferences,
  widgetId: DashboardWidgetId,
  targetIndex: number,
): DashboardWidgetPreferences {
  const currentIndex = preferences.order.indexOf(widgetId);
  if (
    currentIndex < 0 ||
    targetIndex === currentIndex ||
    targetIndex < 0 ||
    targetIndex >= preferences.order.length
  ) {
    return preferences;
  }

  const order = preferences.order.filter((id) => id !== widgetId);
  order.splice(targetIndex, 0, widgetId);
  return { ...preferences, order };
}

/**
 * Posição de um widget ao ser levado para o final. Um widget visível fica abaixo do último visível,
 * ignorando os ocultos que vierem depois; um oculto vai para o fim da lista.
 */
export function getDashboardWidgetEndIndex(
  { hidden, order }: DashboardWidgetPreferences,
  widgetId: DashboardWidgetId,
) {
  if (hidden.includes(widgetId)) return order.length - 1;

  const others = order.filter((id) => id !== widgetId);
  return others.reduce((end, id, index) => (hidden.includes(id) ? end : index + 1), 0);
}

export type DashboardDragItem = { height: number; top: number };

/** Posição em que o item arrastado cairia, dadas as posições originais e o deslocamento vertical. */
export function getDashboardDragTargetIndex(
  items: readonly DashboardDragItem[],
  fromIndex: number,
  offset: number,
) {
  const top = items[fromIndex].top + offset;
  const bottom = top + items[fromIndex].height;
  return items.filter((item, index) => {
    const middle = item.top + item.height / 2;
    if (index < fromIndex) return middle <= top;
    return index > fromIndex && middle < bottom;
  }).length;
}

/** Quanto um item se desloca para abrir espaço ao item arrastado. */
export function getDashboardDragShift(
  items: readonly DashboardDragItem[],
  index: number,
  fromIndex: number,
  targetIndex: number,
) {
  const gap = items.length > 1 ? items[1].top - items[0].top - items[0].height : 0;
  const distance = items[fromIndex].height + gap;
  if (index > fromIndex && index <= targetIndex) return -distance;
  if (index < fromIndex && index >= targetIndex) return distance;
  return 0;
}

export function toggleDashboardWidget(
  preferences: DashboardWidgetPreferences,
  widgetId: DashboardWidgetId,
): DashboardWidgetPreferences {
  return {
    ...preferences,
    hidden: preferences.hidden.includes(widgetId)
      ? preferences.hidden.filter((id) => id !== widgetId)
      : [...preferences.hidden, widgetId],
  };
}

export function changeDashboardWidgetLayout(
  preferences: DashboardWidgetPreferences,
  widgetId: DashboardWidgetId,
  changes: Partial<DashboardWidgetLayout>,
): DashboardWidgetPreferences {
  return {
    ...preferences,
    layouts: {
      ...preferences.layouts,
      [widgetId]: { ...preferences.layouts[widgetId], ...changes },
    },
  };
}

export function areDashboardWidgetPreferencesEqual(
  left: DashboardWidgetPreferences,
  right: DashboardWidgetPreferences,
) {
  return (
    left.columns === right.columns &&
    left.order.length === right.order.length &&
    left.hidden.length === right.hidden.length &&
    left.order.every((widgetId, index) => widgetId === right.order[index]) &&
    left.hidden.every((widgetId) => right.hidden.includes(widgetId)) &&
    dashboardWidgetIds.every((widgetId) => {
      const leftLayout = left.layouts[widgetId];
      const rightLayout = right.layouts[widgetId];
      return (
        leftLayout.width === rightLayout.width &&
        leftLayout.height === rightLayout.height &&
        leftLayout.autoHeight === rightLayout.autoHeight &&
        leftLayout.scroll === rightLayout.scroll
      );
    })
  );
}

/** Da maior para a menor largura: a primeira que coincide define o limite de colunas. */
export const dashboardColumnBreakpoints = [
  { columns: 4, mediaQuery: "(min-width: 80rem)" },
  { columns: 3, mediaQuery: "(min-width: 64rem)" },
  { columns: 2, mediaQuery: "(min-width: 48rem)" },
] as const;

/** Medidas em rem; acompanham as classes de `DashboardWidget` e `DashboardWidgetRow`. */
export const dashboardGridRowRem = 22;
export const dashboardGridGapRem = 1;
const dashboardWidgetChromeRem = 6.625;
const dashboardWidgetItemRem = { details: 3, progress: 3.75, settlement: 7.25 } as const;

export type DashboardWidgetItemStructure = keyof typeof dashboardWidgetItemRem;

/** Quantos itens inteiros cabem no corpo de um widget com a altura informada. */
export function getDashboardWidgetCapacity(
  rows: number,
  structure: DashboardWidgetItemStructure,
  reservedRem = 0,
) {
  const bodyRem =
    rows * dashboardGridRowRem +
    (rows - 1) * dashboardGridGapRem -
    dashboardWidgetChromeRem -
    reservedRem;
  return Math.max(1, Math.floor(bodyRem / dashboardWidgetItemRem[structure]));
}

/** Altura mínima, em espaços do mosaico, para exibir todos os itens. */
export function getDashboardWidgetContentRows(
  itemCount: number,
  structure: DashboardWidgetItemStructure,
  reservedRem = 0,
) {
  for (let rows: number = dashboardWidgetSpan.min; rows < dashboardWidgetSpan.max; rows += 1) {
    if (getDashboardWidgetCapacity(rows, structure, reservedRem) >= itemCount) return rows;
  }
  return dashboardWidgetSpan.max;
}
