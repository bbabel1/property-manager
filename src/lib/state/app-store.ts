"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

type AppStoreState = {
  // Entity selections
  selectedPropertyId: string | null
  selectedUnitId: string | null
  selectedOwnerId: string | null

  // UI state
  sidebarOpen: boolean

  // Actions
  setSelectedPropertyId: (id: string | null) => void
  setSelectedUnitId: (id: string | null) => void
  setSelectedOwnerId: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      selectedPropertyId: null,
      selectedUnitId: null,
      selectedOwnerId: null,
      sidebarOpen: true,

      setSelectedPropertyId: (id) => set({ selectedPropertyId: id }),
      setSelectedUnitId: (id) => set({ selectedUnitId: id }),
      setSelectedOwnerId: (id) => set({ selectedOwnerId: id }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: "app-store",
      partialize: (state) => ({
        selectedPropertyId: state.selectedPropertyId,
        selectedUnitId: state.selectedUnitId,
        selectedOwnerId: state.selectedOwnerId,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
)

