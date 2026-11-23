import {
  type DashboardWidgetLayout,
  dashboardWidgetSpan,
  resolveDashboardWidgetHeight,
  resolveDashboardWidgetWidth,
} from "@openmonetis/domain/dashboard";
import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  type DashboardWidgetItemStructure,
  getDashboardWidgetCapacity,
  getDashboardWidgetContentRows,
} from "../dashboard.presentation";

type DashboardWidgetLayoutContextValue = {
  onContentRowsChange: (rows: number) => void;
  rows: number;
  scroll: boolean;
};

const DashboardWidgetLayoutContext = createContext<DashboardWidgetLayoutContextValue | null>(null);

/** Posiciona um widget no mosaico e informa a ele o espaço disponível. */
export function DashboardWidgetFrame({
  children,
  columns,
  layout,
}: {
  children: ReactNode;
  columns: number;
  layout: DashboardWidgetLayout;
}) {
  const [contentRows, setContentRows] = useState<number>(dashboardWidgetSpan.min);
  const rows = resolveDashboardWidgetHeight(layout, contentRows);
  const width = resolveDashboardWidgetWidth(layout.width, columns);
  const context = useMemo(
    () => ({ onContentRowsChange: setContentRows, rows, scroll: layout.scroll }),
    [layout.scroll, rows],
  );

  return (
    <DashboardWidgetLayoutContext value={context}>
      <div
        className="min-w-0"
        style={{ gridColumn: `span ${width}`, gridRow: `span ${rows}` }}
        data-dashboard-widget-frame
      >
        {children}
      </div>
    </DashboardWidgetLayoutContext>
  );
}

export function useIsInDashboardWidgetFrame() {
  return useContext(DashboardWidgetLayoutContext) !== null;
}

/**
 * Itens que cabem no espaço do widget. Com barra de rolagem, todos são exibidos. `reservedRem` é a
 * altura ocupada por outros elementos do corpo, e `active` falso indica que a lista não está em uso.
 */
export function useDashboardWidgetItems<Item>(
  items: readonly Item[],
  {
    active = true,
    reservedRem = 0,
    structure = "details",
  }: {
    active?: boolean;
    reservedRem?: number;
    structure?: DashboardWidgetItemStructure;
  } = {},
) {
  const layout = useContext(DashboardWidgetLayoutContext);
  const contentRows = getDashboardWidgetContentRows(
    active ? items.length : 0,
    structure,
    reservedRem,
  );
  const onContentRowsChange = layout?.onContentRowsChange;

  useLayoutEffect(() => {
    onContentRowsChange?.(contentRows);
  }, [contentRows, onContentRowsChange]);

  if (layout?.scroll) return { hiddenCount: 0, visibleItems: [...items] };

  const capacity = getDashboardWidgetCapacity(
    layout?.rows ?? dashboardWidgetSpan.min,
    structure,
    reservedRem,
  );
  return {
    hiddenCount: Math.max(0, items.length - capacity),
    visibleItems: items.slice(0, capacity),
  };
}
