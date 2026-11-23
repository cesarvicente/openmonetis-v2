import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useIsInDashboardWidgetFrame } from "./dashboard-widget-layout";

type DashboardWidgetProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  footer?: ReactNode;
  icon?: ReactNode;
  title: string;
};

export function DashboardWidget({
  action,
  children,
  className,
  description,
  footer,
  icon,
  title,
}: DashboardWidgetProps) {
  const isInFrame = useIsInDashboardWidgetFrame();

  // Cabeçalho, rodapé e corpo têm medidas fixas para calcular quantos itens cabem no widget.
  return (
    <Card className={cn("@container gap-0 border py-0", isInFrame ? "h-full" : "h-88", className)}>
      <div className="h-14 shrink-0 border-b">
        <CardHeader className="flex h-full flex-row items-center justify-between gap-2 px-3.5">
          <div className="flex min-w-0 items-center gap-2">
            {icon ? (
              <span className="grid size-6 shrink-0 place-items-center text-muted-foreground [&>svg]:size-4">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <CardTitle className="truncate text-sm leading-tight">{title}</CardTitle>
              {description ? (
                <CardDescription
                  className="mt-0.5 truncate text-xs leading-tight"
                  title={description}
                >
                  {description}
                </CardDescription>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </CardHeader>
      </div>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3.5 py-1">
        {children}
      </CardContent>
      {footer ? (
        <footer className="flex h-10 shrink-0 flex-col justify-center border-t px-3.5">
          {footer}
        </footer>
      ) : null}
    </Card>
  );
}
