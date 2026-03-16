import { useState, type ReactNode } from "react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useColorMode } from "../lib/color-mode";
import { useIdentity } from "../lib/identity-context";

type NetworkState = "live" | "fallback" | "connecting";

interface PageHeaderProps {
  networkState?: NetworkState;
  subtitle?: string;
  title: string;
  trailing?: ReactNode;
  trailingLinkTo?: string;
}

const navItems = [
  { label: "Home", to: "/", matches: (pathname: string) => pathname === "/" },
  { label: "App", to: "/app", matches: (pathname: string) => pathname.startsWith("/app") || pathname.startsWith("/player") },
  { label: "Chat", to: "/chat/globale", matches: (pathname: string) => pathname.startsWith("/chat") },
  { label: "Streaming", to: "/stream", matches: (pathname: string) => pathname.startsWith("/stream") }
];

function getNetworkChipLabel(networkState: NetworkState) {
  switch (networkState) {
    case "live":
      return "Live";
    case "fallback":
      return "Polling";
    default:
      return "Connessione";
  }
}

export function PageHeader({ title, subtitle, networkState, trailing, trailingLinkTo }: PageHeaderProps) {
  const location = useLocation();
  const theme = useTheme();
  const { mode, toggleColorMode } = useColorMode();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { identity } = useIdentity();
  const profilePath = identity ? `/utente/${identity.id}` : null;
  const profileInitial = identity?.nickname.trim().charAt(0).toUpperCase() ?? "?";
  const diagnosticsLink = trailingLinkTo ?? (networkState ? "/diagnostics" : undefined);
  const shellActions =
    trailing ??
    (networkState ? (
      <Chip
        component={diagnosticsLink ? RouterLink : "div"}
        to={diagnosticsLink}
        clickable={Boolean(diagnosticsLink)}
        icon={networkState === "live" ? <WifiRoundedIcon /> : <AutorenewRoundedIcon />}
        label={getNetworkChipLabel(networkState)}
        sx={{
          color: networkState === "live" ? "secondary.main" : "text.secondary",
          bgcolor: networkState === "live" ? theme.app.kind.image.soft : alpha(theme.palette.text.primary, 0.08),
          border: `1px solid ${
            networkState === "live" ? theme.app.kind.image.border : alpha(theme.palette.text.primary, 0.12)
          }`
        }}
      />
    ) : null);

  return (
    <>
      <AppBar position="sticky" color="transparent" sx={{ top: { xs: 8, md: 12 }, borderRadius: 4 }}>
        <Container maxWidth="xl" disableGutters>
          <Toolbar sx={{ px: { xs: 1.5, md: 2.5 }, gap: { xs: 1, md: 2 } }}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <Avatar
                variant="rounded"
                sx={{
                  width: { xs: 42, md: 48 },
                  height: { xs: 42, md: 48 },
                  bgcolor: "transparent",
                  boxShadow: theme.palette.mode === "dark"
                    ? "0 14px 28px rgba(0, 0, 0, 0.32)"
                    : "0 12px 26px rgba(30, 136, 229, 0.2)"
                }}
              >
                <Box component="img" src="/brand/routy-mark.svg" alt="Routy" sx={{ width: "100%", height: "100%" }} />
              </Avatar>

              <Box sx={{ minWidth: 0 }}>
                {subtitle ? (
                  <Typography variant="overline" color="secondary.main" sx={{ display: "block", lineHeight: 1.1 }}>
                    {subtitle}
                  </Typography>
                ) : null}
                <Typography variant="h4" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {title}
                </Typography>
              </Box>
            </Stack>

            {isMobile ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton
                  aria-label={mode === "dark" ? "Attiva modalità chiara" : "Attiva modalità scura"}
                  onClick={toggleColorMode}
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.08),
                    border: `1px solid ${theme.app.outlines.soft}`
                  }}
                >
                  {mode === "dark" ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
                </IconButton>
                <IconButton
                  aria-label={mobileMenuOpen ? "Chiudi menu" : "Apri menu"}
                  onClick={() => {
                    setMobileMenuOpen((currentValue) => !currentValue);
                  }}
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.08),
                    border: `1px solid ${theme.app.outlines.soft}`
                  }}
                >
                  <MenuRoundedIcon />
                </IconButton>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexShrink: 0 }}>
                <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
                  {navItems.map((item) => {
                    const active = item.matches(location.pathname);

                    return (
                      <Button
                        key={item.to}
                        component={RouterLink}
                        to={item.to}
                        variant={active ? "contained" : "text"}
                        color={active ? "primary" : "inherit"}
                        sx={{
                          color: active ? undefined : "text.secondary",
                          bgcolor: active ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.1) : "transparent"
                        }}
                      >
                        {item.label}
                      </Button>
                    );
                  })}
                </Stack>

                {shellActions}

                <IconButton
                  aria-label={mode === "dark" ? "Attiva modalità chiara" : "Attiva modalità scura"}
                  onClick={toggleColorMode}
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.08),
                    border: `1px solid ${theme.app.outlines.soft}`
                  }}
                >
                  {mode === "dark" ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
                </IconButton>

                {profilePath ? (
                  <IconButton component={RouterLink} to={profilePath} aria-label={identity?.nickname ?? "Profilo"}>
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: alpha(theme.palette.primary.main, location.pathname.startsWith("/utente/") ? 0.2 : 0.1),
                        color: location.pathname.startsWith("/utente/") ? "primary.main" : "text.primary",
                        fontWeight: 700
                      }}
                    >
                      {profileInitial}
                    </Avatar>
                  </IconButton>
                ) : null}
              </Stack>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => {
          setMobileMenuOpen(false);
        }}
        PaperProps={{
          sx: {
            width: "min(88vw, 360px)",
            px: 1,
            py: 1.5
          }
        }}
      >
        <Stack spacing={1.5}>
          <Box sx={{ px: 1.5 }}>
            <Typography variant="overline" color="secondary.main">
              Navigazione
            </Typography>
            <Typography variant="h5">{title}</Typography>
          </Box>

          <List disablePadding>
            {navItems.map((item) => (
              <ListItemButton
                key={item.to}
                component={RouterLink}
                to={item.to}
                selected={item.matches(location.pathname)}
                onClick={() => {
                  setMobileMenuOpen(false);
                }}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
            {diagnosticsLink ? (
              <ListItemButton
                component={RouterLink}
                to={diagnosticsLink}
                selected={location.pathname.startsWith("/diagnostics")}
                onClick={() => {
                  setMobileMenuOpen(false);
                }}
              >
                <ListItemText primary="Diagnostica" />
              </ListItemButton>
            ) : null}
            {profilePath ? (
              <ListItemButton
                component={RouterLink}
                to={profilePath}
                selected={location.pathname.startsWith("/utente/")}
                onClick={() => {
                  setMobileMenuOpen(false);
                }}
              >
                <ListItemText primary="Profilo" />
              </ListItemButton>
            ) : null}
          </List>

          {shellActions ? <Box sx={{ px: 1 }}>{shellActions}</Box> : null}
        </Stack>
      </Drawer>
    </>
  );
}
