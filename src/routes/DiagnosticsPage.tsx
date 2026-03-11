import { useEffect, useState } from "react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
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
import { alpha } from "@mui/material/styles";
import type { HostDiagnosticCheck, HostDiagnosticCommand, HostDiagnosticsResponse } from "../../shared/types";
import { PageHeader } from "../components/PageHeader";
import { fetchDiagnostics } from "../lib/api";
import { copyTextToClipboard } from "../lib/clipboard";
import { useLanLiveState } from "../lib/useLanLiveState";

type DiagnosticsState = "loading" | "ready";

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

function getCheckTone(check: HostDiagnosticCheck) {
  if (check.status === "pass") {
    return {
      accent: "#2e7d32",
      soft: alpha("#2e7d32", 0.08),
      border: alpha("#2e7d32", 0.18),
      label: "OK"
    };
  }

  return {
    accent: "#c62828",
    soft: alpha("#c62828", 0.08),
    border: alpha("#c62828", 0.18),
    label: check.status === "warn" ? "Da verificare" : "Errore"
  };
}

export function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<HostDiagnosticsResponse | null>(null);
  const [state, setState] = useState<DiagnosticsState>("loading");
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const liveState = useLanLiveState();

  async function refreshDiagnostics() {
    setState("loading");

    try {
      const payload = await fetchDiagnostics();
      setDiagnostics(payload);
    } catch {
      setDiagnostics(null);
      setSnackbar("Diagnostica non disponibile al momento.");
    } finally {
      setState("ready");
    }
  }

  useEffect(() => {
    void refreshDiagnostics();
  }, []);

  return (
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Diagnostica LAN" subtitle="Host self-test" networkState={liveState} />

        <Stack spacing={3} sx={{ mt: 3 }}>
          <Card sx={{ borderRadius: 2.5 }}>
            <CardContent>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ bgcolor: alpha("#1769aa", 0.12), color: "primary.main" }}>
                    <WifiRoundedIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h5">Controlli host</Typography>
                    <Typography color="text.secondary" variant="body2">
                      Verifica bind, raggiungibilita LAN, profilo rete e firewall.
                    </Typography>
                  </Box>
                </Stack>

                <Button
                  variant="outlined"
                  startIcon={<AutorenewRoundedIcon />}
                  onClick={() => {
                    void refreshDiagnostics();
                  }}
                  disabled={state === "loading"}
                >
                  {state === "loading" ? "Controllo..." : "Aggiorna"}
                </Button>
              </Stack>
            </CardContent>
          </Card>

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
                  const tone = getCheckTone(check);
                  const suggestedCommands = check.status === "pass" ? [] : getCommandsForCheck(check.id, diagnostics.commands);

                  return (
                    <Card
                      key={check.id}
                      sx={{
                        borderRadius: 2.5,
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
                                    borderRadius: 2,
                                    bgcolor: "background.paper",
                                    border: `1px solid ${alpha("#1769aa", 0.08)}`
                                  }}
                                >
                                  <Stack spacing={1.25}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Avatar
                                        sx={{
                                          width: 34,
                                          height: 34,
                                          bgcolor: alpha("#1769aa", 0.12),
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
                                        borderRadius: 2,
                                        bgcolor: alpha("#1769aa", 0.03),
                                        border: `1px solid ${alpha("#1769aa", 0.08)}`,
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
