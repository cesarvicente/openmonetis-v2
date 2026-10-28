import { Select as SelectPrimitive } from "@base-ui/react/select";
import { createContext, useState } from "react";

export const MobileSelectCloseContext = createContext<{ open: boolean; close: () => void } | null>(
  null,
);

export function MobileSelect<Value, Multiple extends boolean | undefined = false>(
  props: SelectPrimitive.Root.Props<Value, Multiple>,
) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <MobileSelectCloseContext value={{ open: props.open ?? open, close: () => setOpen(false) }}>
      <SelectPrimitive.Root
        {...props}
        open={props.open ?? open}
        onOpenChange={(nextOpen, details) => {
          // Keep the popup open while its desktop/mobile presentation is replaced.
          if (details.reason === "window-resize") {
            details.cancel();
            return;
          }
          props.onOpenChange?.(nextOpen, details);
          if (!details.isCanceled && props.open === undefined) setOpen(nextOpen);
        }}
      />
    </MobileSelectCloseContext>
  );
}
