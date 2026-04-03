import type { ReactNode } from "react";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import NetworkPingRoundedIcon from "@mui/icons-material/NetworkPingRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import { LineChart } from "@mui/x-charts/LineChart";
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { HostRuntimeStatsResponse } from "../../shared/types";
import { formatBytes } from "../lib/format";
import { cardRadii, pageCardSx } from "../lib/surfaces";

interface DiagnosticsRealtimePanelProps {
  loading: boolean;
  stats: HostRuntimeStatsResponse | null;
  unavailable: boolean;
}

interface ComparisonSeries {
  id: string;
  label: string;
  color: string;
  values: number[];
}

interface ComparisonMetricCardProps {
  title: string;
  accent: string;
  icon: ReactNode;
  chartMax: number;
  axisFormatter: (value: number) => string;
  seriesFormatter: (value: number) => string;
  series: [ComparisonSeries, ComparisonSeries];
  historyDates: Date[];
}

function formatPercent(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatThroughput(value: number) {
  return `${formatBytes(Math.max(value, 0))}/s`;
}

const chartTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

function SeriesLegend({ series }: { series: [ComparisonSeries, ComparisonSeries] }) {
  return (
    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
      {series.map((entry) => (
        <Stack key={entry.id} direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 24,
              borderTopWidth: 3,
              borderTopStyle: "solid",
              borderTopColor: entry.color,
              borderRadius: 999
            }}
          />
          <Typography variant="body2" sx={{ color: entry.color, fontWeight: 600 }}>
            {entry.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function ComparisonMetricCard({
  title,
  accent,
  icon,
  chartMax,
  axisFormatter,
  seriesFormatter,
  series,
  historyDates
}: ComparisonMetricCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const tickColor = alpha(theme.palette.text.primary, isDark ? 0.72 : 0.62);
  const gridColor = alpha(theme.palette.text.primary, isDark ? 0.08 : 0.1);

  return (
    <Card
      sx={{
        height: "100%",
        ...pageCardSx,
        border: `1px solid ${alpha(accent, isDark ? 0.28 : 0.16)}`,
        bgcolor: isDark ? alpha(accent, 0.1) : alpha(accent, 0.05)
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              sx={{
                width: 42,
                height: 42,
                bgcolor: alpha(accent, 0.14),
                color: accent
              }}
            >
              {icon}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6">{title}</Typography>
            </Box>
          </Stack>

          <SeriesLegend series={series} />

          <Box
            sx={{
              borderRadius: cardRadii.inset,
              overflow: "hidden",
              border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1)}`,
              bgcolor: alpha(theme.palette.background.paper, isDark ? 0.42 : 0.78),
              px: 0.5,
              pt: 1
            }}
          >
            <LineChart
              height={248}
              skipAnimation
              hideLegend
              disableLineItemHighlight
              grid={{ horizontal: true, vertical: false }}
              margin={{ top: 12, right: 24, bottom: 24, left: 8 }}
              xAxis={[
                {
                  data: historyDates,
                  scaleType: "point",
                  valueFormatter: (value: Date) => chartTimeFormatter.format(value),
                  tickLabelStyle: {
                    fontSize: 11,
                    fill: tickColor
                  }
                }
              ]}
              yAxis={[
                {
                  min: 0,
                  max: chartMax,
                  tickNumber: 4,
                  width: 50,
                  disableLine: true,
                  disableTicks: true,
                  valueFormatter: (value: number | null) => axisFormatter(Number(value ?? 0)),
                  tickLabelStyle: {
                    fontSize: 11,
                    fill: tickColor
                  }
                }
              ]}
              series={series.map((entry) => ({
                id: entry.id,
                label: entry.label,
                data: entry.values,
                color: entry.color,
                curve: "monotoneX",
                showMark: false,
                valueFormatter: (value) => (typeof value === "number" ? seriesFormatter(value) : "")
              }))}
              sx={{
                "& .MuiChartsAxis-line": {
                  stroke: "transparent"
                },
                "& .MuiChartsXAxis-tickContainer .MuiChartsText-root": {
                  fill: tickColor
                },
                "& .MuiChartsGrid-line": {
                  stroke: gridColor,
                  strokeDasharray: "4 6"
                },
                "& .MuiLineElement-root": {
                  strokeWidth: 2.8
                }
              }}
            />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function RealtimeSkeleton() {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }
      }}
    >
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index} sx={pageCardSx}>
          <CardContent>
            <Stack spacing={2}>
              <Skeleton variant="rounded" width={180} height={28} />
              <Skeleton variant="rounded" width="52%" height={18} />
              <Skeleton variant="rounded" width="100%" height={84} />
              <Skeleton variant="rounded" width="100%" height={226} />
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

function getHostMemoryPercent(usedBytes: number, totalBytes: number) {
  return totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
}

export function DiagnosticsRealtimePanel({ loading, stats, unavailable }: DiagnosticsRealtimePanelProps) {
  const theme = useTheme();

  if (!stats && loading) {
    return <RealtimeSkeleton />;
  }

  if (!stats && unavailable) {
    return (
      <Alert severity="warning" variant="outlined">
        Le metriche live dell&apos;host non sono disponibili in questo momento.
      </Alert>
    );
  }

  if (!stats) {
    return null;
  }

  const cpuAccent = theme.palette.info.main;
  const cpuProcessColor = theme.palette.primary.main;
  const ramAccent = theme.palette.success.main;
  const ramProcessColor = theme.palette.secondary.main;
  const bandwidthAccent = theme.palette.warning.main;
  const bandwidthProcessColor = theme.palette.error.main;

  const cpuSeries: [ComparisonSeries, ComparisonSeries] = [
    {
      id: "host-cpu",
      label: "Host",
      color: cpuAccent,
      values: stats.history.map((sample) => sample.hostCpuUsagePercent)
    },
    {
      id: "routy-cpu",
      label: "Routy",
      color: cpuProcessColor,
      values: stats.history.map((sample) => sample.processCpuUsagePercent)
    }
  ];
  const ramSeries: [ComparisonSeries, ComparisonSeries] = [
    {
      id: "host-ram",
      label: "Host",
      color: ramAccent,
      values: stats.history.map((sample) => getHostMemoryPercent(sample.hostMemoryUsedBytes, sample.memoryTotalBytes))
    },
    {
      id: "routy-ram",
      label: "Routy",
      color: ramProcessColor,
      values: stats.history.map((sample) => getHostMemoryPercent(sample.processMemoryBytes, sample.memoryTotalBytes))
    }
  ];
  const bandwidthSeries: [ComparisonSeries, ComparisonSeries] = [
    {
      id: "host-bandwidth",
      label: "Host",
      color: bandwidthAccent,
      values: stats.history.map((sample) => sample.hostTotalBytesPerSecond)
    },
    {
      id: "routy-bandwidth",
      label: "Routy",
      color: bandwidthProcessColor,
      values: stats.history.map((sample) => sample.processTotalBytesPerSecond)
    }
  ];
  const historyDates = stats.history.map((sample) => new Date(sample.recordedAt));

  return (
    <Stack spacing={2.5}>
      {unavailable ? (
        <Alert severity="warning" variant="outlined">
          Ultimo snapshot disponibile mostrato. Aggiornamento live momentaneamente non riuscito.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }
        }}
      >
        <ComparisonMetricCard
          title="CPU"
          accent={cpuAccent}
          icon={<SpeedRoundedIcon />}
          chartMax={100}
          axisFormatter={(value) => formatPercent(value)}
          seriesFormatter={(value) => formatPercent(value)}
          series={cpuSeries}
          historyDates={historyDates}
        />

        <ComparisonMetricCard
          title="RAM"
          accent={ramAccent}
          icon={<MemoryRoundedIcon />}
          chartMax={100}
          axisFormatter={(value) => formatPercent(value)}
          seriesFormatter={(value) => formatPercent(value)}
          series={ramSeries}
          historyDates={historyDates}
        />

        <ComparisonMetricCard
          title="Banda"
          accent={bandwidthAccent}
          icon={<NetworkPingRoundedIcon />}
          chartMax={Math.max(stats.peaks.hostTotalBytesPerSecond, stats.peaks.processTotalBytesPerSecond, 1)}
          axisFormatter={(value) => formatThroughput(value)}
          seriesFormatter={(value) => formatThroughput(value)}
          series={bandwidthSeries}
          historyDates={historyDates}
        />
      </Box>
    </Stack>
  );
}
