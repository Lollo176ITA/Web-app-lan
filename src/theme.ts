import type { PaletteMode } from "@mui/material";
import { alpha, createTheme } from "@mui/material/styles";

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === "dark";
  const primary = {
    main: isDark ? "#6caeff" : "#1769aa",
    light: isDark ? "#9bcbff" : "#4393d6",
    dark: isDark ? "#2d7bc3" : "#00467d"
  };
  const secondary = {
    main: isDark ? "#56d7ca" : "#0f9d94",
    light: isDark ? "#8ff0e4" : "#4fcfc3",
    dark: isDark ? "#119489" : "#006d66"
  };
  const background = {
    default: isDark ? "#07111a" : "#eef4f8",
    paper: isDark ? "#0d1924" : "#fbfdff"
  };
  const text = {
    primary: isDark ? "#edf5fb" : "#10273a",
    secondary: isDark ? "#96aec1" : "#4d6578"
  };

  return createTheme({
    palette: {
      mode,
      primary,
      secondary,
      background,
      text,
      divider: alpha(primary.main, isDark ? 0.18 : 0.08),
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
            background: isDark
              ? `
                  radial-gradient(circle at 0 0, ${alpha(primary.light, 0.16)}, transparent 18%),
                  radial-gradient(circle at 100% 0, ${alpha(secondary.light, 0.12)}, transparent 18%),
                  linear-gradient(180deg, #07111a 0%, #09131d 55%, #0b1823 100%)
                `
              : `
                  radial-gradient(circle at 0 0, ${alpha(primary.light, 0.18)}, transparent 18%),
                  radial-gradient(circle at 100% 0, ${alpha(secondary.main, 0.14)}, transparent 18%),
                  linear-gradient(180deg, #eef4f8 0%, #f7fafc 55%, #edf4f8 100%)
                `,
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
            boxShadow: isDark ? "0 18px 36px rgba(0, 0, 0, 0.32)" : undefined
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
            background: isDark
              ? `linear-gradient(180deg, ${alpha(background.paper, 0.98)} 0%, ${alpha("#0a1621", 0.94)} 100%)`
              : "rgba(255,255,255,0.88)",
            border: `1px solid ${alpha(primary.main, isDark ? 0.16 : 0.08)}`,
            boxShadow: isDark ? "0 24px 60px rgba(0, 0, 0, 0.34)" : "0 18px 50px rgba(16, 39, 58, 0.06)"
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
            background: isDark
              ? `linear-gradient(180deg, ${alpha(background.paper, 0.98)} 0%, ${alpha("#0a1621", 0.98)} 100%)`
              : undefined
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            background: isDark
              ? `linear-gradient(180deg, ${alpha(background.paper, 0.98)} 0%, ${alpha("#08131d", 0.98)} 100%)`
              : undefined
          }
        }
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            background: isDark
              ? `linear-gradient(180deg, ${alpha(background.paper, 0.98)} 0%, ${alpha("#0a1621", 0.98)} 100%)`
              : undefined
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
