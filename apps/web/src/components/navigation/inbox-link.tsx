import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { inboxSnapshotQueryOptions } from "@/features/inbox/inbox.queries";
import { cn } from "@/lib/utils";
import { isPathActive } from "./nav-items";
import { NavLink } from "./nav-link";
import { headerIconButtonClassName } from "./navbar-options";

const refreshIntervalMs = 60_000;

export function InboxLink({ enabled }: { enabled: boolean }) {
  const location = useLocation();
  const query = useQuery({
    ...inboxSnapshotQueryOptions(1),
    enabled,
    refetchInterval: refreshIntervalMs,
  });
  const pendingCount = query.data?.pendingCount ?? 0;
  const active = isPathActive(location.pathname, "/inbox");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <NavLink
            aria-current={active ? "page" : undefined}
            aria-label={
              pendingCount > 0
                ? `Abrir caixa de entrada, ${pendingCount} ${pendingCount === 1 ? "pendente" : "pendentes"}`
                : "Abrir caixa de entrada"
            }
            className={cn(
              buttonVariants({ size: "icon-sm", variant: "ghost" }),
              headerIconButtonClassName,
              "relative",
              active && "bg-primary/10 text-foreground",
            )}
            href="/inbox"
          />
        }
      >
        <Inbox aria-hidden="true" className="size-5 md:size-4.5" />
        {pendingCount > 0 ? (
          <span className="absolute top-0 right-0 grid size-4.5 place-items-center rounded-full bg-primary font-semibold text-[10px] text-primary-foreground leading-none max-md:right-2">
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent>Caixa de entrada</TooltipContent>
    </Tooltip>
  );
}
