import type {} from "@mui/x-data-grid/themeAugmentation";
import type {} from "@mui/x-tree-view/themeAugmentation";
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
  const app = {
    surfaces: {
      shell: isDark ? alpha("#09131d", 0.84) : alpha("#ffffff", 0.76),
      sunken: isDark ? alpha("#08131d", 0.92) : alpha("#f4f8fb", 0.96),
      raised: isDark ? alpha("#10202d", 0.94) : alpha("#ffffff", 0.9),
      overlay: isDark ? alpha("#122231", 0.98) : alpha("#fbfdff", 0.98),
      contrast: "#ffffff"
    },
    outlines: {
      soft: alpha(primary.main, isDark ? 0.16 : 0.08),
      strong: alpha(primary.main, isDark ? 0.28 : 0.16),
      focus: alpha(primary.main, isDark ? 0.46 : 0.3)
    },
    gradients: {
      hero: isDark
        ? "linear-gradient(180deg, rgba(8, 19, 29, 0.96) 0%, rgba(7, 17, 26, 0.98) 100%)"
        : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(246, 251, 255, 0.92) 100%)",
      shell: isDark
        ? `linear-gradient(180deg, ${alpha(background.paper, 0.92)} 0%, ${alpha("#08131d", 0.9)} 100%)`
        : "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(248,251,254,0.86) 100%)",
      accent: "linear-gradient(135deg, #1769aa 0%, #0f9d94 100%)",
      media: "linear-gradient(180deg, rgba(4, 9, 15, 0.98) 0%, rgba(3, 6, 10, 1) 100%)"
    },
    status: {
      pass: {
        main: "#2e7d32",
        soft: alpha("#2e7d32", isDark ? 0.16 : 0.08),
        border: alpha("#2e7d32", isDark ? 0.26 : 0.18),
        label: "OK"
      },
      warn: {
        main: "#ed6c02",
        soft: alpha("#ed6c02", isDark ? 0.16 : 0.08),
        border: alpha("#ed6c02", isDark ? 0.26 : 0.18),
        label: "Da verificare"
      },
      fail: {
        main: "#c62828",
        soft: alpha("#c62828", isDark ? 0.16 : 0.08),
        border: alpha("#c62828", isDark ? 0.26 : 0.18),
        label: "Errore"
      },
      info: {
        main: primary.main,
        soft: alpha(primary.main, isDark ? 0.16 : 0.08),
        border: alpha(primary.main, isDark ? 0.26 : 0.18),
        label: "Info"
      }
    },
    kind: {
      folder: {
        main: primary.main,
        soft: alpha(primary.main, isDark ? 0.18 : 0.1),
        border: alpha(primary.main, isDark ? 0.28 : 0.18),
        contrastText: isDark ? primary.light : primary.dark
      },
      video: {
        main: primary.main,
        soft: alpha(primary.main, isDark ? 0.18 : 0.1),
        border: alpha(primary.main, isDark ? 0.28 : 0.18),
        contrastText: isDark ? primary.light : primary.dark
      },
      image: {
        main: secondary.main,
        soft: alpha(secondary.main, isDark ? 0.18 : 0.1),
        border: alpha(secondary.main, isDark ? 0.28 : 0.18),
        contrastText: isDark ? secondary.light : secondary.dark
      },
      audio: {
        main: isDark ? "#7f95ff" : "#4553c7",
        soft: alpha(isDark ? "#7f95ff" : "#4553c7", isDark ? 0.18 : 0.1),
        border: alpha(isDark ? "#7f95ff" : "#4553c7", isDark ? 0.28 : 0.18),
        contrastText: isDark ? "#ccd5ff" : "#3240a7"
      },
      document: {
        main: isDark ? "#f0b66d" : "#c47917",
        soft: alpha(isDark ? "#f0b66d" : "#c47917", isDark ? 0.18 : 0.1),
        border: alpha(isDark ? "#f0b66d" : "#c47917", isDark ? 0.28 : 0.18),
        contrastText: isDark ? "#ffd8a7" : "#8e5208"
      },
      archive: {
        main: isDark ? "#c7a5ff" : "#8b4fcf",
        soft: alpha(isDark ? "#c7a5ff" : "#8b4fcf", isDark ? 0.18 : 0.1),
        border: alpha(isDark ? "#c7a5ff" : "#8b4fcf", isDark ? 0.28 : 0.18),
        contrastText: isDark ? "#e1d2ff" : "#6f34b4"
      },
      other: {
        main: isDark ? "#a0b5c7" : "#5a7184",
        soft: alpha(isDark ? "#a0b5c7" : "#5a7184", isDark ? 0.18 : 0.1),
        border: alpha(isDark ? "#a0b5c7" : "#5a7184", isDark ? 0.28 : 0.18),
        contrastText: isDark ? "#deebf5" : "#43596b"
      }
    }
  };

  return createTheme({
    palette: {
      mode,
      primary,
      secondary,
      background,
      text,
      divider: app.outlines.soft,
      DataGrid: {
        bg: app.surfaces.sunken,
        headerBg: app.surfaces.overlay,
        pinnedBg: app.surfaces.overlay
      },
      action: {
        hover: alpha(primary.main, isDark ? 0.12 : 0.06),
        selected: alpha(primary.main, isDark ? 0.18 : 0.1),
        focus: alpha(primary.main, isDark ? 0.24 : 0.14)
      }
    },
    app,
    shape: {
      borderRadius: 4
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
      h4: {
        fontSize: "clamp(1.28rem, 2vw, 1.8rem)",
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
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: app.gradients.shell,
            backdropFilter: "blur(18px)",
            border: `1px solid ${app.outlines.soft}`,
            boxShadow: "none"
          }
        }
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            minHeight: 72
          }
        }
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true
        },
        styleOverrides: {
          root: {
            borderRadius: 12,
            paddingInline: 20,
            minHeight: 44
          },
          contained: {
            boxShadow: isDark ? "0 18px 36px rgba(0, 0, 0, 0.32)" : "0 10px 28px rgba(23, 105, 170, 0.16)"
          }
        }
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 12
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: `1px solid ${app.outlines.soft}`
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            background: isDark
              ? `linear-gradient(180deg, ${alpha(background.paper, 0.98)} 0%, ${alpha("#0a1621", 0.94)} 100%)`
              : "rgba(255,255,255,0.9)",
            border: `1px solid ${app.outlines.soft}`,
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
              : app.surfaces.raised,
            borderRadius: 18
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            background: isDark
              ? `linear-gradient(180deg, ${alpha(background.paper, 0.98)} 0%, ${alpha("#08131d", 0.98)} 100%)`
              : app.surfaces.raised
          }
        }
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            background: isDark
              ? `linear-gradient(180deg, ${alpha(background.paper, 0.98)} 0%, ${alpha("#0a1621", 0.98)} 100%)`
              : app.surfaces.raised
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: alpha(background.paper, isDark ? 0.76 : 0.92),
            borderRadius: 12,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: app.outlines.soft
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: app.outlines.strong
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
            borderRadius: 10,
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
            height: 3,
            borderRadius: 999
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            fontWeight: 600
          }
        }
      },
      MuiDataGrid: {
        styleOverrides: {
          root: {
            border: `1px solid ${app.outlines.soft}`,
            borderRadius: 14,
            overflow: "hidden"
          },
          columnHeaders: {
            borderBottom: `1px solid ${app.outlines.soft}`
          },
          cell: {
            borderBottom: `1px solid ${alpha(primary.main, isDark ? 0.1 : 0.05)}`
          },
          row: {
            "&:hover": {
              backgroundColor: alpha(primary.main, isDark ? 0.1 : 0.04)
            },
            "&.Mui-selected": {
              backgroundColor: alpha(primary.main, isDark ? 0.16 : 0.08)
            }
          },
          footerContainer: {
            borderTop: `1px solid ${app.outlines.soft}`
          }
        }
      },
      MuiRichTreeView: {
        styleOverrides: {
          root: {
            padding: 8
          }
        }
      },
      MuiTreeItem: {
        styleOverrides: {
          content: {
            minHeight: 42,
            borderRadius: 8,
            paddingInline: 10,
            "&.Mui-selected": {
              backgroundColor: alpha(primary.main, isDark ? 0.18 : 0.1)
            }
          },
          label: {
            fontWeight: 600
          }
        }
      }
    }
  });
}
