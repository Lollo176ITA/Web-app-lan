import type { ReactNode } from "react";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import { Avatar, Box, Button, ButtonBase, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useIdentity } from "../lib/identity-context";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  trailingLinkTo?: string;
}

const navItems = [
  { label: "Home", to: "/", matches: (pathname: string) => pathname === "/" },
  { label: "App", to: "/app", matches: (pathname: string) => pathname.startsWith("/app") || pathname.startsWith("/player") },
  { label: "Chat", to: "/chat/globale", matches: (pathname: string) => pathname.startsWith("/chat") },
  { label: "Streaming", to: "/stream", matches: (pathname: string) => pathname.startsWith("/stream") }
];

export function PageHeader({ title, subtitle, trailing, trailingLinkTo }: PageHeaderProps) {
  const location = useLocation();
  const { identity } = useIdentity();
  const profilePath = identity ? `/utente/${identity.id}` : null;
  const profileInitial = identity?.nickname.trim().charAt(0).toUpperCase() ?? "?";

  return (
    <Paper
      elevation={0}
      sx={{
        px: { xs: 1, md: 2 },
        py: { xs: 1, md: 1.5 },
        borderRadius: { xs: 3, md: 4 },
        bgcolor: "rgba(255,255,255,0.78)",
        backdropFilter: "blur(20px)"
      }}
    >
      <Stack
        direction="row"
        spacing={{ xs: 1, md: 2 }}
        alignItems="center"
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={{ xs: 0.9, md: 1.25 }} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
          <Avatar
            sx={{
              width: { xs: 36, md: 40 },
              height: { xs: 36, md: 40 },
              bgcolor: alpha("#1769aa", 0.12),
              color: "primary.main"
            }}
          >
            <LanRoundedIcon sx={{ fontSize: { xs: 20, md: 24 } }} />
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

        <Stack
          direction="row"
          spacing={{ xs: 0.5, sm: 1 }}
          alignItems="center"
          sx={{ flexShrink: 0 }}
        >
          <Stack direction="row" spacing={{ xs: 0.25, sm: 0.75 }} sx={{ flexWrap: "nowrap" }}>
            {navItems.map((item) => {
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
                    bgcolor: isActive ? alpha("#1769aa", 0.12) : "transparent",
                    color: isActive ? "primary.main" : "text.secondary",
                    "&:hover": {
                      bgcolor: alpha("#1769aa", 0.08)
                    }
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>

          {trailing ? (
            trailingLinkTo ? (
              <ButtonBase
                component={RouterLink}
                to={trailingLinkTo}
                sx={{
                  borderRadius: 2,
                  overflow: "hidden"
                }}
              >
                <Box sx={{ flexShrink: 0 }}>{trailing}</Box>
              </ButtonBase>
            ) : (
              <Box sx={{ flexShrink: 0 }}>{trailing}</Box>
            )
          ) : null}

          {profilePath ? (
            <ButtonBase
              component={RouterLink}
              to={profilePath}
              sx={{
                borderRadius: 2,
                overflow: "hidden"
              }}
            >
              <Avatar
                sx={{
                  width: { xs: 38, md: 42 },
                  height: { xs: 38, md: 42 },
                  bgcolor: location.pathname.startsWith("/utente/") ? alpha("#1769aa", 0.16) : alpha("#10273a", 0.08),
                  color: location.pathname.startsWith("/utente/") ? "primary.main" : "text.primary",
                  fontWeight: 700
                }}
              >
                {profileInitial}
              </Avatar>
            </ButtonBase>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
