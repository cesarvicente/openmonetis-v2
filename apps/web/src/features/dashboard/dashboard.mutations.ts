import {
  createDefaultDashboardWidgetPreferences,
  type DashboardWidgetPreferences,
} from "@openmonetis/domain/dashboard";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resetDashboardWidgetPreferences, updateDashboardWidgetPreferences } from "./dashboard.api";
import { areDashboardWidgetPreferencesEqual } from "./dashboard.presentation";
import { dashboardKeys } from "./dashboard.queries";

export function useSaveDashboardWidgetPreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (preferences: DashboardWidgetPreferences) =>
      areDashboardWidgetPreferencesEqual(preferences, createDefaultDashboardWidgetPreferences())
        ? resetDashboardWidgetPreferences()
        : updateDashboardWidgetPreferences(preferences),
    onSuccess: (preferences) => {
      queryClient.setQueryData(dashboardKeys.preferences(), preferences);
    },
  });
}
