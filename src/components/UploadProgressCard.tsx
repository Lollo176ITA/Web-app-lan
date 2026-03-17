import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import PendingRoundedIcon from "@mui/icons-material/PendingRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import {
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { UploadProgress } from "../lib/api";
import { formatBytes } from "../lib/format";

interface UploadProgressCardProps {
  compact?: boolean;
  progress: UploadProgress;
  targetLabel: string;
}

export function UploadProgressCard({
  compact = false,
  progress,
  targetLabel
}: UploadProgressCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const percentageLabel = `${Math.round(progress.percentage)}%`;

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: alpha(theme.palette.secondary.main, isDark ? 0.3 : 0.22),
        bgcolor: alpha(theme.palette.secondary.main, isDark ? 0.12 : 0.06),
        backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, isDark ? 0.2 : 0.11)} 0%, ${alpha(
          theme.palette.primary.main,
          isDark ? 0.08 : 0.05
        )} 100%)`,
        boxShadow: compact ? "0 18px 34px rgba(12, 16, 24, 0.24)" : "none"
      }}
    >
      <CardContent sx={{ p: compact ? 1.75 : 2.25, "&:last-child": { pb: compact ? 1.75 : 2.25 } }}>
        <Stack spacing={compact ? 1.2 : 1.6}>
          <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
              <Box
                sx={{
                  width: compact ? 38 : 44,
                  height: compact ? 38 : 44,
                  borderRadius: 2.5,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: alpha(theme.palette.common.white, isDark ? 0.08 : 0.65),
                  color: "secondary.main",
                  flexShrink: 0
                }}
              >
                <CloudUploadRoundedIcon fontSize={compact ? "small" : "medium"} />
              </Box>
              <Box minWidth={0}>
                <Typography variant={compact ? "subtitle1" : "h6"} noWrap>
                  Caricamento in corso
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  Destinazione: {targetLabel}
                </Typography>
              </Box>
            </Stack>
            <Chip
              label={percentageLabel}
              color="secondary"
              size={compact ? "small" : "medium"}
              sx={{ fontWeight: 700, flexShrink: 0 }}
            />
          </Stack>

          <Box>
            <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mb: 0.75 }}>
              <Typography variant="body2" color="text.secondary">
                {progress.completedFiles}/{progress.totalFiles} file completati
              </Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progress.percentage}
              sx={{
                height: compact ? 8 : 10,
                borderRadius: 999,
                bgcolor: alpha(theme.palette.common.black, isDark ? 0.2 : 0.08),
                "& .MuiLinearProgress-bar": {
                  borderRadius: 999
                }
              }}
            />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
