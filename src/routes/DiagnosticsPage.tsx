import { useEffect, useState } from "react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
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
import type { HostDiagnosticStatus, HostDiagnosticsResponse } from "../../shared/types";
import { PageHeader } from "../components/PageHeader";
import { fetchDiagnostics } from "../lib/api";
import { copyTextToClipboard } from "../lib/clipboard";

type DiagnosticsState = "loading" | "ready";

function getSeverity(status: HostDiagnosticStatus) {
  switch (status) {
    case "pass":
      return "success";
    case "warn":
      return "warning";
    case "fail":
      return "error";
    default:
      return "info";
  }
}

export function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<HostDiagnosticsResponse | null>(null);
  const [state, setState] = useState<DiagnosticsState>("loading");
  const [snackbar, setSnackbar] = useState<string | null>(null);

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
      <Container maxWidth="lg" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Diagnostica LAN" subtitle="Host self-test" />

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
              <Stack spacing={1.25}>
                {diagnostics.checks.map((check) => (
                  <Alert key={check.id} severity={getSeverity(check.status)} variant="outlined">
                    <strong>{check.label}:</strong> {check.message}
                  </Alert>
                ))}
              </Stack>

              <Card sx={{ borderRadius: 2.5 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h6">Dettagli host</Typography>
                      <Typography color="text.secondary" variant="body2">
                        Informazioni usate per i test automatici.
                      </Typography>
                    </Box>

                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        URL LAN
                      </Typography>
                      <Typography sx={{ wordBreak: "break-word" }}>{diagnostics.lanUrl}</Typography>
                    </Stack>

                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Bind server
                      </Typography>
                      <Typography>{diagnostics.listenHost}:{diagnostics.port}</Typography>
                    </Stack>

                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Piattaforma
                      </Typography>
                      <Typography>{diagnostics.platform}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 2.5 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h6">Comandi suggeriti</Typography>
                      <Typography color="text.secondary" variant="body2">
                        Usa questi comandi solo se il relativo controllo segnala un problema.
                      </Typography>
                    </Box>

                    {diagnostics.commands.length === 0 ? (
                      <Alert severity="success" variant="outlined">
                        Nessun comando consigliato: non ho rilevato azioni correttive automatiche necessarie.
                      </Alert>
                    ) : (
                      diagnostics.commands.map((command) => (
                        <Box
                          key={command.id}
                          sx={{
                            p: 1.5,
                            borderRadius: 2.5,
                            border: `1px solid ${alpha("#1769aa", 0.1)}`,
                            bgcolor: alpha("#1769aa", 0.04)
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
                                bgcolor: "background.paper",
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
                      ))
                    )}
                  </Stack>
                </CardContent>
              </Card>
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
