import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

interface SectionHeaderProps {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  title: string;
}

export function SectionHeader({ actions, description, eyebrow, title }: SectionHeaderProps) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1.5}
      alignItems={{ xs: "flex-start", md: "center" }}
      justifyContent="space-between"
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow ? (
          <Typography variant="overline" color="secondary.main">
            {eyebrow}
          </Typography>
        ) : null}
        <Typography variant="h5">{title}</Typography>
        {description ? (
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {actions ? <Box sx={{ flexShrink: 0, width: { xs: "100%", md: "auto" } }}>{actions}</Box> : null}
    </Stack>
  );
}
