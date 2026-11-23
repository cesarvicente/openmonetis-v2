import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { usePrivacyMode } from "@/components/privacy-provider";
import { useTheme } from "@/components/theme-provider";
import { authClient } from "@/lib/auth-client";
import { userPreferencesQueryOptions } from "../preferences.queries";

export function PreferencesSynchronizer() {
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const preferencesQuery = useQuery(userPreferencesQueryOptions(Boolean(userId)));
  const { setPrivacyModeEnabled } = usePrivacyMode();
  const { setColorTheme, setTheme } = useTheme();
  const privacyInitializedForUser = useRef<string | null>(null);

  // Independent effects: saving one of them must not undo a preview of the other.
  const savedTheme = preferencesQuery.data?.theme;
  const savedColorTheme = preferencesQuery.data?.colorTheme;
  useEffect(() => {
    if (savedTheme) setTheme(savedTheme);
  }, [savedTheme, setTheme]);
  useEffect(() => {
    if (savedColorTheme) setColorTheme(savedColorTheme);
  }, [savedColorTheme, setColorTheme]);

  useEffect(() => {
    if (!userId) {
      privacyInitializedForUser.current = null;
      setPrivacyModeEnabled(false);
      return;
    }
    if (!preferencesQuery.data || privacyInitializedForUser.current === userId) return;

    setPrivacyModeEnabled(preferencesQuery.data.hideValuesOnStart);
    privacyInitializedForUser.current = userId;
  }, [preferencesQuery.data, setPrivacyModeEnabled, userId]);

  return null;
}
