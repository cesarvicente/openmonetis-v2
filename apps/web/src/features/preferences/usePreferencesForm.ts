import {
  UpdateUserPreferencesInputSchema,
  type UserPreferencesOutput,
} from "@openmonetis/validators/preferences";
import { useForm, useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import { useUpdateUserPreferencesMutation } from "./preferences.mutations";
import { preferencesMutationErrorMessage } from "./preferences.presentation";
import { defaultUserPreferencesQueryOptions } from "./preferences.queries";

export function usePreferencesForm(preferences: UserPreferencesOutput) {
  const queryClient = useQueryClient();
  const updatePreferences = useUpdateUserPreferencesMutation();
  const { setColorTheme, setTheme, theme } = useTheme();
  const [isRestoring, setIsRestoring] = useState(false);
  // `form.options` keeps the values from the first render, so changes are compared with this one.
  const savedPreferences = useRef(preferences);
  const appliedTheme = useRef(theme);
  const form = useForm({
    defaultValues: preferences,
    validators: {
      onSubmit: ({ value }) =>
        UpdateUserPreferencesInputSchema.safeParse(value).success
          ? undefined
          : "Revise as preferências selecionadas.",
    },
    onSubmitInvalid: () => toast.error("Revise as preferências selecionadas."),
    onSubmit: async ({ value }) => {
      try {
        const changes = Object.fromEntries(
          Object.entries(value).filter(
            ([key, entry]) =>
              entry !== savedPreferences.current[key as keyof UserPreferencesOutput],
          ),
        );
        if (Object.keys(changes).length === 0) return;
        const saved = await updatePreferences.mutateAsync(
          UpdateUserPreferencesInputSchema.parse(changes),
        );
        savedPreferences.current = saved;
        form.reset(saved);
        setTheme(saved.theme);
        setColorTheme(saved.colorTheme);
        toast.success("Preferências salvas");
      } catch (error) {
        toast.error(preferencesMutationErrorMessage(error));
      }
    },
  });

  // Live preview: the chosen theme and palette are applied while editing and the saved ones come
  // back when leaving the settings without saving.
  const previewTheme = useStore(form.store, (state) => state.values.theme);
  const previewColorTheme = useStore(form.store, (state) => state.values.colorTheme);
  useEffect(() => {
    savedPreferences.current = preferences;
  }, [preferences]);
  useEffect(() => {
    setTheme(previewTheme);
  }, [previewTheme, setTheme]);
  useEffect(() => {
    setColorTheme(previewColorTheme);
  }, [previewColorTheme, setColorTheme]);
  // The header toggle saves the theme on its own, so the form follows it.
  useEffect(() => {
    if (appliedTheme.current === theme) return;
    appliedTheme.current = theme;
    if (form.getFieldValue("theme") !== theme) form.setFieldValue("theme", theme);
  }, [form, theme]);
  useEffect(
    () => () => {
      setTheme(savedPreferences.current.theme);
      setColorTheme(savedPreferences.current.colorTheme);
    },
    [setColorTheme, setTheme],
  );

  async function restoreDefaults() {
    setIsRestoring(true);
    try {
      const defaults = await queryClient.fetchQuery(defaultUserPreferencesQueryOptions());
      form.reset(defaults, { keepDefaultValues: true });
      toast.info("Padrões carregados", {
        description: "Salve para aplicar ou descarte as alterações.",
      });
    } catch {
      toast.error("Não foi possível carregar os padrões. Tente novamente.");
    } finally {
      setIsRestoring(false);
    }
  }

  return { form, isRestoring, restoreDefaults };
}

export type PreferencesFormApi = ReturnType<typeof usePreferencesForm>["form"];
