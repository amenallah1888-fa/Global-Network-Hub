import React, { createContext, useContext, useMemo, useState } from "react";

type Ctx = {
  composeText: string;
  setComposeText: (s: string) => void;
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [composeText, setComposeText] = useState("");
  const value = useMemo(() => ({ composeText, setComposeText }), [composeText]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
