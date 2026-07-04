import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";

export type ThemeMode = "system" | "light" | "dark";

type Ctx = {
  themeMode: ThemeMode;
  resolvedScheme: "light" | "dark";
  setThemeMode: (mode: ThemeMode) => void;
};

const STORAGE_KEY = "theme_mode";

const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark" || stored === "system") {
          setThemeModeState(stored);
        }
      })
      .catch(() => {});
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  };

  const resolvedScheme: "light" | "dark" =
    themeMode === "system" ? (systemScheme === "dark" ? "dark" : "light") : themeMode;

  const value = useMemo(
    () => ({ themeMode, resolvedScheme, setThemeMode }),
    [themeMode, resolvedScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
