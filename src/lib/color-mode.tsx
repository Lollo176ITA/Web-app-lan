import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { CssBaseline, type PaletteMode } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { createAppTheme } from "../theme";

const STORAGE_KEY = "routeroom-color-mode";

interface ColorModeContextValue {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
  toggleColorMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

function readInitialMode(): PaletteMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedMode = window.localStorage.getItem(STORAGE_KEY);

  if (storedMode === "light" || storedMode === "dark") {
    return storedMode;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(readInitialMode);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  return (
    <ColorModeContext.Provider
      value={{
        mode,
        setMode,
        toggleColorMode: () => {
          setMode((currentMode) => (currentMode === "light" ? "dark" : "light"));
        }
      }}
    >
      <ThemeProvider theme={createAppTheme(mode)}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  const context = useContext(ColorModeContext);

  if (!context) {
    throw new Error("useColorMode must be used within AppThemeProvider");
  }

  return context;
}
