import { useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
  Avatar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
  useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink, useLocation } from "react-router-dom";
import type { FeatureFlags } from "../../shared/types";
import { getFeatureFlags, useAppShell } from "../lib/app-shell-context";
import { useColorMode } from "../lib/color-mode";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

interface NavItem {
  feature?: keyof FeatureFlags;
  label: string;
  matches: (pathname: string) => boolean;
  to: string;
}

const navItems: NavItem[] = [
  { label: "Home", to: "/", feature: "homepage", matches: (pathname: string) => pathname === "/" },
  { label: "App", to: "/app", matches: (pathname: string) => pathname.startsWith("/app") || pathname.startsWith("/player") },
  { label: "Chat", to: "/chat/globale", feature: "chat", matches: (pathname: string) => pathname.startsWith("/chat") },
  { label: "Streaming", to: "/stream", feature: "streaming", matches: (pathname: string) => pathname.startsWith("/stream") },
  { label: "Sync", to: "/sync", feature: "sync", matches: (pathname: string) => pathname.startsWith("/sync") }
];

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  const location = useLocation();
  const theme = useTheme();
  const { mode, toggleColorMode } = useColorMode();
  const { session } = useAppShell();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDark = mode === "dark";
  const brandLogoSrc = isDark ? "/logo/logo-nero.png" : "/logo/logo-bianco.png";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const featureFlags = getFeatureFlags(session);
  const visibleNavItems = navItems.filter((item) => !item.feature || featureFlags[item.feature]);
  const mobileMenuItems = [
    ...visibleNavItems.map((item) => ({
      label: item.label,
      to: item.to,
      selected: item.matches(location.pathname)
    })),
    {
      label: "Impostazioni",
      to: "/settings",
      selected: location.pathname.startsWith("/settings")
    }
  ];
  const panelBackground = alpha(theme.palette.background.paper, isDark ? 0.92 : 0.88);

  function toggleMobileMenu() {
    setMobileMenuOpen((currentValue) => !currentValue);
  }

  function renderThemeToggleButton() {
    return (
      <IconButton
        aria-label={isDark ? "Attiva modalità chiara" : "Attiva modalità scura"}
        onClick={toggleColorMode}
        sx={{
          flexShrink: 0,
          borderRadius: 2.5,
          bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
          color: isDark ? theme.palette.primary.light : "primary.main",
          border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.24 : 0.12)}`
        }}
      >
        {isDark ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
      </IconButton>
    );
  }

  function renderSettingsButton() {
    const settingsActive = location.pathname.startsWith("/settings");

    return (
      <IconButton
        component={RouterLink}
        to="/settings"
        aria-label="Impostazioni"
        sx={{
          minWidth: 0,
          minHeight: { xs: 34, sm: 40 },
          width: { xs: 34, sm: 40 },
          height: { xs: 34, sm: 40 },
          bgcolor: settingsActive ? alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12) : "transparent",
          color: settingsActive ? (isDark ? theme.palette.primary.light : "primary.main") : "text.secondary",
          border: `1px solid ${alpha(theme.palette.primary.main, settingsActive ? (isDark ? 0.24 : 0.14) : 0)}`,
          "&:hover": {
            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.14 : 0.08)
          }
        }}
      >
        <SettingsRoundedIcon />
      </IconButton>
    );
  }

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          position: "sticky",
          top: { xs: 8, md: 12 },
          zIndex: theme.zIndex.appBar,
          px: { xs: 1, md: 2 },
          py: { xs: 1, md: 1.5 },
          borderRadius: { xs: 3, md: 4 },
          bgcolor: alpha(theme.palette.background.paper, isDark ? 0.84 : 0.78),
          background: panelBackground,
          backdropFilter: "blur(20px)",
          borderColor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)
        }}
      >
        <Stack direction="row" spacing={{ xs: 1, md: 2 }} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={{ xs: 0.9, md: 1.25 }} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            <Avatar
              variant="rounded"
              sx={{
                width: { xs: 36, md: 40 },
                height: { xs: 36, md: 40 },
                bgcolor: "transparent",
                borderRadius: 2.5,
                boxShadow: isDark
                  ? "0 14px 28px rgba(0, 0, 0, 0.32)"
                  : `0 12px 26px ${alpha(theme.palette.primary.main, 0.18)}`
              }}
            >
              <Box
                component="img"
                src={brandLogoSrc}
                alt="Routy"
                sx={{ width: "100%", height: "100%", display: "block" }}
              />
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              {subtitle ? (
                <Typography
                  variant="overline"
                  sx={{
                    display: { xs: "none", sm: "block" },
                    color: "secondary.main",
                    lineHeight: 1.1
                  }}
                >
                  {subtitle}
                </Typography>
              ) : null}
              <Typography
                variant="h4"
                sx={{
                  fontSize: { xs: "1.15rem", sm: "1.3rem", md: "clamp(1.4rem, 2vw, 2.2rem)" },
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {title}
              </Typography>
            </Box>
          </Stack>

          {isMobile ? (
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              {renderThemeToggleButton()}
              <IconButton
                aria-label={mobileMenuOpen ? "Chiudi menu" : "Apri menu"}
                onClick={toggleMobileMenu}
                sx={{
                  flexShrink: 0,
                  borderRadius: 2.5,
                  bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                  color: isDark ? theme.palette.primary.light : "primary.main",
                  border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.24 : 0.12)}`
                }}
              >
                {mobileMenuOpen ? <CloseRoundedIcon /> : <MenuRoundedIcon />}
              </IconButton>
            </Stack>
          ) : (
            <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} alignItems="center" sx={{ flexShrink: 0 }}>
              <Stack direction="row" spacing={{ xs: 0.25, sm: 0.75 }} sx={{ flexWrap: "nowrap" }}>
                {visibleNavItems.map((item) => {
                  const isActive = item.matches(location.pathname);

                  return (
                    <Button
                      key={item.to}
                      component={RouterLink}
                      to={item.to}
                      color="inherit"
                      variant={isActive ? "contained" : "text"}
                      sx={{
                        minWidth: 0,
                        minHeight: { xs: 34, sm: 40 },
                        px: { xs: 1, sm: 1.75 },
                        fontSize: { xs: "0.8rem", sm: "0.875rem" },
                        bgcolor: isActive ? alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12) : "transparent",
                        color: isActive ? (isDark ? theme.palette.primary.light : "primary.main") : "text.secondary",
                        "&:hover": {
                          bgcolor: alpha(theme.palette.primary.main, isDark ? 0.14 : 0.08)
                        }
                      }}
                    >
                      {item.label}
                    </Button>
                  );
                })}
              </Stack>

              {renderThemeToggleButton()}
              {renderSettingsButton()}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => {
          setMobileMenuOpen(false);
        }}
        PaperProps={{
          sx: {
            width: "min(82vw, 320px)",
            p: 1.5
          }
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                component="img"
                src={brandLogoSrc}
                alt="Routy"
                sx={{ width: 34, height: 34, display: "block", flexShrink: 0, borderRadius: 1.75 }}
              />
              <Box>
                <Typography variant="overline" color="secondary.main">
                  Navigazione
                </Typography>
              </Box>
            </Stack>
            <IconButton
              aria-label="Chiudi menu"
              onClick={() => {
                setMobileMenuOpen(false);
              }}
              sx={{
                flexShrink: 0,
                borderRadius: 2.5,
                bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                color: isDark ? theme.palette.primary.light : "primary.main",
                border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.24 : 0.12)}`
              }}
            >
              <CloseRoundedIcon />
            </IconButton>
          </Stack>

          <List sx={{ py: 0 }}>
            {mobileMenuItems.map((item) => (
              <ListItemButton
                key={item.to}
                component={RouterLink}
                to={item.to}
                selected={item.selected}
                onClick={() => {
                  setMobileMenuOpen(false);
                }}
                sx={{
                  borderRadius: 2.5,
                  mb: 0.5,
                  "&.Mui-selected": {
                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
                    color: isDark ? theme.palette.primary.light : "primary.main"
                  },
                  "&.Mui-selected:hover": {
                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.26 : 0.16)
                  }
                }}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Stack>
      </Drawer>
    </>
  );
}
