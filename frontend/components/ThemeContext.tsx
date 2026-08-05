import React, { createContext, useContext, useState, useEffect } from "react";

export interface ThemeColors {
  isDark: boolean;
  toggleTheme: () => void;
  glassBg: string;
  glassBorder: string;
  textPrimary: string;
  textSecondary: string;
  bgMain: string;
  cardBg: string;
  cardHeaderBg: string;
  sidebarBg: string;
}

const ThemeContext = createContext<ThemeColors | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always lock to light mode (isDark = false)
  const isDark = false;

  const toggleTheme = () => {
    // No-op to satisfy the interface but stay in light mode
  };

  const themeValues: ThemeColors = {
    isDark,
    toggleTheme,
    glassBg: "bg-white border border-slate-200 shadow-sm rounded-xl",
    glassBorder: "border border-slate-200",
    textPrimary: "text-slate-900",
    textSecondary: "text-slate-700",
    bgMain: "bg-slate-100 text-slate-900 font-sans selection:bg-indigo-100",
    cardBg: "bg-white border border-slate-200 shadow-sm rounded-xl",
    cardHeaderBg: "border-b border-slate-100 bg-slate-50/40",
    sidebarBg: "bg-[#0f172a] border-r border-[#1e293b]"
  };

  return (
    <ThemeContext.Provider value={themeValues}>
      <div className={`${themeValues.bgMain} min-h-screen font-sans antialiased`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be rendered within a ThemeProvider container.");
  }
  return context;
}
