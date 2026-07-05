import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const DEV_MODE_KEY = "oasis_dev_mode_enabled";

type DevModeCtx = {
  devMode: boolean;
  toggleDevMode: () => void;
};

const DevModeContext = createContext<DevModeCtx | null>(null);

export function DevModeProvider({ children }: { children: React.ReactNode }) {
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    if (!__DEV__) return;
    (async () => {
      const stored = await AsyncStorage.getItem(DEV_MODE_KEY);
      if (stored === "true") setDevMode(true);
    })();
  }, []);

  const toggleDevMode = useCallback(() => {
    if (!__DEV__) return;
    setDevMode((prev) => {
      const next = !prev;
      AsyncStorage.setItem(DEV_MODE_KEY, next ? "true" : "false");
      return next;
    });
  }, []);

  const value = useMemo(() => ({ devMode: __DEV__ ? devMode : false, toggleDevMode }), [devMode, toggleDevMode]);

  return <DevModeContext.Provider value={value}>{children}</DevModeContext.Provider>;
}

export function useDevMode(): DevModeCtx {
  const ctx = useContext(DevModeContext);
  if (!ctx) throw new Error("useDevMode must be used within DevModeProvider");
  return ctx;
}
