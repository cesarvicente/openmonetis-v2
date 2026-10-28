import { CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

type ChartLegendMarkerProps = {
  /** Any CSS color, usually a chart token such as `var(--chart-1)`. */
  color?: string;
  /** Tailwind text color class, for markers tied to a semantic token such as `text-success`. */
  className?: string;
};

export function ChartLegendMarker({ color, className }: ChartLegendMarkerProps) {
  return (
    <CircleDashed
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", className)}
      strokeWidth={2.5}
      style={color ? { color } : undefined}
    />
  );
}
