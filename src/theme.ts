import { alpha, createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1769aa",
      light: "#4393d6",
      dark: "#00467d"
    },
    secondary: {
      main: "#0f9d94",
      light: "#4fcfc3",
      dark: "#006d66"
    },
    background: {
      default: "#eef4f8",
      paper: "#fbfdff"
    },
    text: {
      primary: "#10273a",
      secondary: "#4d6578"
    }
  },
  shape: {
    borderRadius: 24
  },
  typography: {
    fontFamily: '"Roboto Flex", "Segoe UI", sans-serif',
    h1: {
      fontSize: "clamp(3rem, 5vw, 4.9rem)",
      lineHeight: 0.95,
      fontWeight: 700,
      letterSpacing: "-0.06em"
    },
    h2: {
      fontSize: "clamp(2.1rem, 4vw, 3.25rem)",
      lineHeight: 1,
      fontWeight: 700,
      letterSpacing: "-0.04em"
    },
    h3: {
      fontSize: "clamp(1.45rem, 2vw, 2rem)",
      lineHeight: 1.1,
      fontWeight: 700
    },
    button: {
      fontWeight: 700,
      textTransform: "none",
      letterSpacing: "-0.01em"
    }
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 22,
          minHeight: 48
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: `1px solid ${alpha("#1769aa", 0.08)}`
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999
        }
      }
    }
  }
});
