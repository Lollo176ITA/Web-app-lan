import type { ReactNode } from "react";
import { Chip } from "@mui/material";

type StatusTone = "pass" | "warn" | "fail" | "info";

interface StatusBadgeProps {
  icon?: ReactNode;
  label?: string;
  status: StatusTone;
}

export function StatusBadge({ icon, label, status }: StatusBadgeProps) {
  return (
    <Chip
      icon={icon}
      label={label}
      size="small"
      sx={(theme) => ({
        fontWeight: 700,
        color: theme.app.status[status].main,
        bgcolor: theme.app.status[status].soft,
        border: `1px solid ${theme.app.status[status].border}`
      })}
    />
  );
}
