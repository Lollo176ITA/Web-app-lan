import type { PaletteMode } from "@mui/material";
import { alpha, createTheme } from "@mui/material/styles";

const themeTokens = {
  light: {
    primary: {
      main: "#6D3CD7",
      light: "#9F78FF",
      dark: "#5127AE"
    },
    secondary: {
      main: "#6053A6",
      light: "#8F81D0",
      dark: "#403284"
    },
    background: {
      default: "#FAF9FC",
      paper: "#F3F3F7"
    },
    text: {
      primary: "#2F3337",
      secondary: "#5C5F64"
    },
    error: {
      main: "#A8364B",
      light: "#F97386",
      dark: "#6E0523"
    },
    warning: {
      main: "#B76A15",
      light: "#E4A34E",
      dark: "#7C4700"
    },
    info: {
      main: "#7862D9",
      light: "#AA99F3",
      dark: "#5841AE"
    },
    success: {
      main: "#2F8A63",
      light: "#66C99A",
      dark: "#205F46"
    }
  },
  dark: {
    primary: {
      main: "#9F78FF",
      light: "#D8CBFF",
      dark: "#6D3CD7"
    },
    secondary: {
      main: "#D7CEFF",
      light: "#F1ECFF",
      dark: "#403284"
    },
    background: {
      default: "#111218",
      paper: "#17181F"
    },
    text: {
      primary: "#F1F1F4",
      secondary: "#C3C5CC"
    },
    error: {
      main: "#F97386",
      light: "#FFD8DF",
      dark: "#6B0221"
    },
    warning: {
      main: "#F2BE66",
      light: "#FFE1B2",
      dark: "#8B5A13"
    },
    info: {
      main: "#C4B3FF",
      light: "#ECE5FF",
      dark: "#7B63D9"
    },
    success: {
      main: "#75D2A7",
      light: "#BFF0D8",
      dark: "#2A6A4E"
    }
  }
} as const;

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === "dark";
  const { primary, secondary, background, text, error, warning, info, success } = themeTokens[mode];
  const elevatedSurface = isDark ? "#1b1d24" : "#f6f1ff";
  const drawerSurface = isDark ? "#15161d" : "#fbf9ff";

  return createTheme({
    palette: {
      mode,
      primary,
      secondary,
      background,
      text,
      error,
      warning,
      info,
      success,
      divider: alpha(isDark ? secondary.main : primary.main, isDark ? 0.22 : 0.08),
      action: {
        hover: alpha(primary.main, isDark ? 0.12 : 0.06),
        selected: alpha(primary.main, isDark ? 0.18 : 0.1),
        focus: alpha(primary.main, isDark ? 0.24 : 0.14)
      }
    },
    shape: {
      borderRadius: 18
    },
    typography: {
      fontFamily: '"Titillium Web", "Segoe UI", sans-serif',
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
      MuiCssBaseline: {
        styleOverrides: {
          ":root": {
            fontSynthesis: "none",
            textRendering: "optimizeLegibility",
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale"
          },
          html: {
            scrollBehavior: "smooth"
          },
          body: {
            margin: 0,
            minWidth: "320px",
            minHeight: "100vh",
            color: text.primary,
            backgroundColor: background.default,
            backgroundAttachment: "fixed"
          },
          a: {
            color: "inherit",
            textDecoration: "none"
          },
          "*": {
            boxSizing: "border-box"
          },
          "::-webkit-scrollbar": {
            width: "12px",
            height: "12px"
          },
          "::-webkit-scrollbar-thumb": {
            background: alpha(isDark ? primary.light : primary.main, isDark ? 0.3 : 0.22),
            borderRadius: "999px",
            border: `3px solid ${alpha(isDark ? background.paper : "#ffffff", isDark ? 0.86 : 0.65)}`
          },
          "::-webkit-scrollbar-track": {
            background: "transparent"
          }
        }
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true
        },
        styleOverrides: {
          root: {
            borderRadius: 20,
            paddingInline: 22,
            minHeight: 48
          },
          contained: {
            boxShadow: `0 18px 36px ${alpha(primary.dark, isDark ? 0.34 : 0.18)}`
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: `1px solid ${alpha(primary.main, isDark ? 0.16 : 0.08)}`
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 20,
            backgroundColor: isDark ? elevatedSurface : alpha(background.paper, 0.96),
            border: `1px solid ${alpha(primary.main, isDark ? 0.16 : 0.08)}`,
            boxShadow: isDark
              ? `0 24px 60px ${alpha("#000000", 0.34)}`
              : `0 18px 50px ${alpha(primary.dark, 0.08)}`
          }
        }
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: 24,
            "&:last-child": {
              paddingBottom: 24
            }
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? drawerSurface : background.paper
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? drawerSurface : background.paper
          }
        }
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? drawerSurface : background.paper
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: alpha(background.paper, isDark ? 0.76 : 0.92),
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(primary.main, isDark ? 0.18 : 0.12)
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(primary.main, isDark ? 0.32 : 0.2)
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: primary.main
            }
          }
        }
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 44,
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 16,
            marginRight: 8,
            minWidth: 0,
            paddingInline: 16
          }
        }
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 46
          },
          scroller: {
            overflow: "auto !important"
          },
          indicator: {
            height: 0
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 16
          }
        }
      }
    }
  });
}
