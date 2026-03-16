import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

interface EmptyStateProps {
  action?: ReactNode;
  description: string;
  icon?: ReactNode;
  title: string;
}

export function EmptyState({ action, description, icon, title }: EmptyStateProps) {
  return (
    <Box
      sx={{
        minHeight: 220,
        px: 3,
        py: 5,
        display: "grid",
        placeItems: "center",
        textAlign: "center"
      }}
    >
      <Box sx={{ maxWidth: 420 }}>
        {icon ? <Box sx={{ mb: 1.5, color: "primary.main" }}>{icon}</Box> : null}
        <Typography variant="h5" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography color="text.secondary">{description}</Typography>
        {action ? <Box sx={{ mt: 2.5 }}>{action}</Box> : null}
      </Box>
    </Box>
  );
}
