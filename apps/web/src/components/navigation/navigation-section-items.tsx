import { useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

import { isNavItemActive, type NavItem } from "./nav-items";
import { NavLink } from "./nav-link";

export function NavigationSectionItems({
  className,
  items,
  onNavigate,
}: {
  className?: string;
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const location = useLocation();

  return (
    <div className={cn("grid gap-1", className)}>
      {items.map((item) => {
        const active = isNavItemActive(item, location);

        return (
          <NavLink
            className={cn(
              "flex items-start gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground",
            )}
            href={item.href}
            key={item.label}
            onClick={onNavigate}
            preservePeriod={item.preservePeriod}
            search={item.search}
          >
            <span className="mt-0.5 shrink-0 text-brand-strong">{item.icon}</span>
            <span className="grid min-w-0 gap-0.5">
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground text-xs leading-snug xl:whitespace-nowrap">
                {item.description}
              </span>
            </span>
          </NavLink>
        );
      })}
    </div>
  );
}
