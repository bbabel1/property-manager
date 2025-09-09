"use client";

import { createContext, useContext, useMemo } from "react";
import { useAppStore } from "@/lib/state/app-store";

type AppState = {
  selectedPropertyId: string | null;
  setSelectedPropertyId: (id: string | null) => void;
  selectedUnitId: string | null;
  setSelectedUnitId: (id: string | null) => void;
  selectedOwnerId: string | null;
  setSelectedOwnerId: (id: string | null) => void;
};

const AppStateContext = createContext<AppState | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const {
    selectedPropertyId,
    setSelectedPropertyId,
    selectedUnitId,
    setSelectedUnitId,
    selectedOwnerId,
    setSelectedOwnerId,
  } = useAppStore();

  const value = useMemo(
    () => ({
      selectedPropertyId,
      setSelectedPropertyId,
      selectedUnitId,
      setSelectedUnitId,
      selectedOwnerId,
      setSelectedOwnerId,
    }),
    [selectedPropertyId, selectedUnitId, selectedOwnerId]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
