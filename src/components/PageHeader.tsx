import type { ReactNode } from "react";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import { Avatar, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink, useLocation } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}

const navItems = [
  { label: "Home", to: "/", matches: (pathname: string) => pathname === "/" },
  { label: "App", to: "/app", matches: (pathname: string) => pathname.startsWith("/app") || pathname.startsWith("/player") }
];

export function PageHeader({ title, subtitle, trailing }: PageHeaderProps) {
  const location = useLocation();

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

          {trailing ? <Box sx={{ flexShrink: 0 }}>{trailing}</Box> : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
