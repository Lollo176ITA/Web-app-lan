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
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.25, md: 1.5 },
        borderRadius: { xs: 3, md: 4 },
        bgcolor: "rgba(255,255,255,0.78)",
        backdropFilter: "blur(20px)"
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 1.5, md: 2 }}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: alpha("#1769aa", 0.12),
              color: "primary.main"
            }}
          >
            <LanRoundedIcon />
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {subtitle ? (
              <Typography
                variant="overline"
                sx={{
                  display: "block",
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
                fontSize: "clamp(1.4rem, 2vw, 2.2rem)",
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
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
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
                    minHeight: 40,
                    px: 1.75,
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
