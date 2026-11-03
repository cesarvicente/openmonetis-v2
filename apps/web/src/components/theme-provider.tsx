import {
  type ApplicationColorTheme,
  type ApplicationTheme,
  applicationColorThemes,
  defaultApplicationColorTheme,
} from "@openmonetis/domain/preferences";
import { ScriptOnce } from "@tanstack/react-router";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

type Theme = ApplicationTheme;
type ColorTheme = ApplicationColorTheme;

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  colorStorageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorTheme: ColorTheme;
  setColorTheme: (colorTheme: ColorTheme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

/** Browser UI color (address bar) for each palette, in its light and dark variants. */
const browserThemeColors: Record<ColorTheme, { light: string; dark: string }> = {
  sepia: { light: "#fc941d", dark: "#191919" },
  graphite: { light: "#18181b", dark: "#121214" },
  blue: { light: "#2563eb", dark: "#0f172a" },
  green: { light: "#059669", dark: "#0c1a14" },
  violet: { light: "#7c3aed", dark: "#151023" },
  rose: { light: "#ec4899", dark: "#1f1018" },
  nord: { light: "#5e81ac", dark: "#2e3440" },
  catppuccin: { light: "#8839ef", dark: "#1e1e2e" },
};

function isColorTheme(value: string | null): value is ColorTheme {
  return applicationColorThemes.includes(value as ColorTheme);
}

function getThemeScript(storageKey: string, colorStorageKey: string, defaultTheme: Theme) {
  const key = JSON.stringify(storageKey);
  const colorKey = JSON.stringify(colorStorageKey);
  const fallback = JSON.stringify(defaultTheme);
  const colorFallback = JSON.stringify(defaultApplicationColorTheme);
  const colors = JSON.stringify(browserThemeColors);

  return `(function(){try{var c=${colors};var t=localStorage.getItem(${key});if(t!=="light"&&t!=="dark"&&t!=="system"){t=${fallback}}var p=localStorage.getItem(${colorKey});if(!c[p]){p=${colorFallback}}var d=matchMedia("(prefers-color-scheme: dark)").matches;var r=t==="system"?(d?"dark":"light"):t;var e=document.documentElement;e.classList.add(r);e.style.colorScheme=r;e.setAttribute("data-color-theme",p);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",c[p][r])}catch(e){}})();`;
}

function applyTheme(theme: Theme, colorTheme: ColorTheme) {
  const root = document.documentElement;
  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.style.colorScheme = resolvedTheme;
  root.setAttribute("data-color-theme", colorTheme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", browserThemeColors[colorTheme][resolvedTheme]);
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "openmonetis-theme",
  colorStorageKey = "openmonetis-color-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(defaultApplicationColorTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem(storageKey);
    const storedColorTheme = localStorage.getItem(colorStorageKey);
    setThemeState(
      storedTheme === "dark" || storedTheme === "light" || storedTheme === "system"
        ? storedTheme
        : defaultTheme,
    );
    setColorThemeState(
      isColorTheme(storedColorTheme) ? storedColorTheme : defaultApplicationColorTheme,
    );
    setMounted(true);
  }, [colorStorageKey, defaultTheme, storageKey]);

  useEffect(() => {
    if (mounted) {
      applyTheme(theme, colorTheme);
    }
  }, [colorTheme, mounted, theme]);

  useEffect(() => {
    if (!mounted || theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = () => applyTheme("system", colorTheme);
    mediaQuery.addEventListener("change", applySystemTheme);

    return () => mediaQuery.removeEventListener("change", applySystemTheme);
  }, [colorTheme, mounted, theme]);

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      localStorage.setItem(storageKey, nextTheme);
      setThemeState(nextTheme);
    },
    [storageKey],
  );

  const setColorTheme = useCallback(
    (nextColorTheme: ColorTheme) => {
      localStorage.setItem(colorStorageKey, nextColorTheme);
      setColorThemeState(nextColorTheme);
    },
    [colorStorageKey],
  );

  return (
    <ThemeProviderContext value={{ theme, setTheme, colorTheme, setColorTheme }}>
      <ScriptOnce>{getThemeScript(storageKey, colorStorageKey, defaultTheme)}</ScriptOnce>
      {children}
    </ThemeProviderContext>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
