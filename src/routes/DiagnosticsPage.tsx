import { useEffect, useState } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Snackbar,
  Stack,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type {
  HostDiagnosticCheck,
  HostDiagnosticCommand,
  HostDiagnosticsResponse,
  HostRuntimeStatsResponse
} from "../../shared/types";
import { DiagnosticsRealtimePanel } from "../components/DiagnosticsRealtimePanel";
import { PageHeader } from "../components/PageHeader";
import { fetchClientProfile, fetchDiagnostics, fetchDiagnosticsRuntimeStats } from "../lib/api";
import { copyTextToClipboard } from "../lib/clipboard";
import { cardRadii, pageCardSx } from "../lib/surfaces";
import { useLanLiveState } from "../lib/useLanLiveState";

type RuntimeState = "idle" | "loading" | "ready" | "error";

function getCommandsForCheck(checkId: string, commands: HostDiagnosticCommand[]) {
  switch (checkId) {
    case "lan-health":
      return commands.filter((command) => command.id === "test-health-url");
    case "windows-profile":
      return commands.filter((command) => command.id === "set-network-private");
    case "windows-firewall":
      return commands.filter((command) => command.id === "add-firewall-rule");
    default:
      return [];
  }
}

function getCheckTone(check: HostDiagnosticCheck, isDark: boolean) {
  if (check.status === "pass") {
    return {
      accent: "#2e7d32",
      soft: alpha("#2e7d32", isDark ? 0.16 : 0.08),
      border: alpha("#2e7d32", isDark ? 0.26 : 0.18),
      label: "OK"
    };
  }

  return {
    accent: "#c62828",
    soft: alpha("#c62828", isDark ? 0.16 : 0.08),
    border: alpha("#c62828", isDark ? 0.26 : 0.18),
    label: check.status === "warn" ? "Da verificare" : "Errore"
  };
}

export function DiagnosticsPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [diagnostics, setDiagnostics] = useState<HostDiagnosticsResponse | null>(null);
  const [runtimeStats, setRuntimeStats] = useState<HostRuntimeStatsResponse | null>(null);
  const [isHostClient, setIsHostClient] = useState<boolean | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>("idle");
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const liveState = useLanLiveState();

  useEffect(() => {
    void fetchDiagnostics()
      .then((payload) => {
        setDiagnostics(payload);
      })
      .catch(() => {
        setDiagnostics(null);
        setSnackbar("Diagnostica non disponibile al momento.");
      });
    void fetchClientProfile()
      .then((profile) => {
        setIsHostClient(profile.isHost);
      })
      .catch(() => {
        setIsHostClient(false);
      });
  }, []);

  useEffect(() => {
    if (!isHostClient) {
      setRuntimeStats(null);
      setRuntimeState("idle");
      return;
    }

    let active = true;
    let pending = false;

    const pollRuntimeStats = async () => {
      if (pending) {
        return;
      }

      pending = true;

      try {
        const payload = await fetchDiagnosticsRuntimeStats();

        if (!active) {
          return;
        }

        setRuntimeStats(payload);
        setRuntimeState("ready");
      } catch {
        if (!active) {
          return;
        }

        setRuntimeState("error");
      } finally {
        pending = false;
      }
    };

    setRuntimeState("loading");
    void pollRuntimeStats();

    const interval = window.setInterval(() => {
      void pollRuntimeStats();
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isHostClient]);

  return (
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Diagnostica LAN" subtitle="Host self-test" networkState={liveState} />

        <Stack spacing={3} sx={{ mt: 3 }}>
          {isHostClient ? (
            <DiagnosticsRealtimePanel
              loading={runtimeState === "loading" && !runtimeStats}
              stats={runtimeStats}
              unavailable={runtimeState === "error"}
            />
          ) : null}

          {diagnostics ? (
            <>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }
                }}
              >
                {diagnostics.checks.map((check) => {
                  const tone = getCheckTone(check, isDark);
                  const suggestedCommands = check.status === "pass" ? [] : getCommandsForCheck(check.id, diagnostics.commands);

                  return (
                    <Card
                      key={check.id}
                      sx={{
                        ...pageCardSx,
                        border: `1px solid ${tone.border}`,
                        bgcolor: tone.soft
                      }}
                    >
                      <CardContent>
                        <Stack spacing={2}>
                          <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            <Avatar
                              sx={{
                                width: 42,
                                height: 42,
                                bgcolor: alpha(tone.accent, 0.12),
                                color: tone.accent
                              }}
                            >
                              {check.status === "pass" ? <CheckCircleRoundedIcon /> : <CloseRoundedIcon />}
                            </Avatar>

                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6">{check.label}</Typography>
                              <Typography variant="body2" sx={{ color: tone.accent, fontWeight: 700 }}>
                                {tone.label}
                              </Typography>
                            </Box>
                          </Stack>

                          <Box>
                            <Typography variant="overline" color="secondary.main">
                              Cosa significa
                            </Typography>
                            <Typography color="text.secondary">{check.message}</Typography>
                          </Box>

                          {suggestedCommands.length > 0 ? (
                            <Stack spacing={1.5}>
                              <Typography variant="overline" color="secondary.main">
                                Comando suggerito
                              </Typography>

                              {suggestedCommands.map((command) => (
                                <Box
                                  key={command.id}
                                  sx={{
                                    p: 1.5,
                                    borderRadius: cardRadii.inset,
                                    bgcolor: "background.paper",
                                    border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)}`
                                  }}
                                >
                                  <Stack spacing={1.25}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Avatar
                                        sx={{
                                          width: 34,
                                          height: 34,
                                          bgcolor: alpha(theme.palette.primary.main, 0.12),
                                          color: "primary.main"
                                        }}
                                      >
                                        <TerminalRoundedIcon sx={{ fontSize: 18 }} />
                                      </Avatar>
                                      <Box>
                                        <Typography variant="subtitle1">{command.label}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          {command.reason}
                                        </Typography>
                                      </Box>
                                    </Stack>

                                    <Typography
                                      component="code"
                                      sx={{
                                        display: "block",
                                        p: 1.25,
                                        borderRadius: cardRadii.panel,
                                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.03),
                                        border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)}`,
                                        fontSize: "0.85rem",
                                        wordBreak: "break-word"
                                      }}
                                    >
                                      {command.command}
                                    </Typography>

                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                                      <Typography variant="body2" color="text.secondary">
                                        Shell: {command.shell}
                                      </Typography>
                                      <Button
                                        size="small"
                                        startIcon={<ContentCopyRoundedIcon />}
                                        onClick={() => {
                                          void copyTextToClipboard(command.command)
                                            .then(() => {
                                              setSnackbar("Comando copiato negli appunti.");
                                            })
                                            .catch(() => {
                                              setSnackbar("Copia del comando non riuscita.");
                                            });
                                        }}
                                      >
                                        Copia comando
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </Box>
                              ))}
                            </Stack>
                          ) : null}
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </>
          ) : (
            <Alert severity="warning" variant="outlined">
              Non sono riuscito a caricare la diagnostica host.
            </Alert>
          )}
        </Stack>
      </Container>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={2800}
        onClose={() => {
          setSnackbar(null);
        }}
        message={snackbar}
      />
    </Box>
  );
}
