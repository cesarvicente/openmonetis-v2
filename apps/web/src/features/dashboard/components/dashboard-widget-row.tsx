import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type DashboardWidgetRowProps = ComponentProps<"li"> & {
  structure?: "details" | "progress";
};

export function DashboardWidgetRow({
  className,
  structure = "details",
  ...props
}: DashboardWidgetRowProps) {
  return (
    <li
      className={cn(
        "flex items-center gap-2.5",
        structure === "details" ? "h-12" : "h-15 py-1",
        className,
      )}
      {...props}
    />
  );
}
