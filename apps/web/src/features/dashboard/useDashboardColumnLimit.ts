import { useSyncExternalStore } from "react";
import { dashboardColumnBreakpoints } from "./dashboard.presentation";

function subscribe(callback: () => void) {
  const queries = dashboardColumnBreakpoints.map(({ mediaQuery }) => window.matchMedia(mediaQuery));
  for (const query of queries) query.addEventListener("change", callback);

  return () => {
    for (const query of queries) query.removeEventListener("change", callback);
  };
}

function getBrowserSnapshot() {
  return (
    dashboardColumnBreakpoints.find(({ mediaQuery }) => window.matchMedia(mediaQuery).matches)
      ?.columns ?? 1
  );
}

function getServerSnapshot() {
  return 1;
}

/** Quantas colunas do mosaico cabem na largura atual da tela. */
export function useDashboardColumnLimit() {
  return useSyncExternalStore(subscribe, getBrowserSnapshot, getServerSnapshot);
}
