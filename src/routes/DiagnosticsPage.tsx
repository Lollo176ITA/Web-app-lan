import { useEffect, useMemo, useState } from "react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Container,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import type { HostDiagnosticCheck, HostDiagnosticCommand, HostDiagnosticsResponse } from "../../shared/types";
import { PageHeader } from "../components/PageHeader";
import { SectionHeader } from "../components/ui/SectionHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { SurfaceCard } from "../components/ui/SurfaceCard";
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

function getStatusTone(status: HostDiagnosticCheck["status"]) {
  switch (status) {
    case "pass":
      return "pass";
    case "warn":
      return "warn";
    case "fail":
      return "fail";
    default:
      return "info";
  }
}

interface DiagnosticRow {
  check: HostDiagnosticCheck;
  command: HostDiagnosticCommand | null;
  id: string;
}

export function DiagnosticsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
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

  const diagnosticRows = useMemo<DiagnosticRow[]>(
    () =>
      diagnostics?.checks.map((check) => ({
        id: check.id,
        check,
        command: getCommandsForCheck(check.id, diagnostics.commands)[0] ?? null
      })) ?? [],
    [diagnostics]
  );

  const columns: GridColDef<DiagnosticRow>[] = [
    {
      field: "label",
      headerName: "Controllo",
      minWidth: 240,
      flex: 0.8,
      sortable: false,
      renderCell: (params: GridRenderCellParams<DiagnosticRow>) => (
        <Stack spacing={0.25} justifyContent="center" sx={{ minWidth: 0 }}>
          <Typography fontWeight={700} noWrap>
            {params.row.check.label}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {params.row.command ? params.row.command.label : "Nessun comando richiesto"}
          </Typography>
        </Stack>
      )
    },
    {
      field: "status",
      headerName: "Stato",
      width: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams<DiagnosticRow>) => (
        <StatusBadge
          status={getStatusTone(params.row.check.status)}
          label={theme.app.status[getStatusTone(params.row.check.status)].label}
          icon={params.row.check.status === "pass" ? <CheckCircleRoundedIcon /> : <ErrorOutlineRoundedIcon />}
        />
      )
    },
    {
      field: "message",
      headerName: "Dettaglio",
      minWidth: 360,
      flex: 1.3,
      sortable: false,
      renderCell: (params: GridRenderCellParams<DiagnosticRow>) => (
        <Typography variant="body2" color="text.secondary">
          {params.row.check.message}
        </Typography>
      )
    },
    {
      field: "command",
      headerName: "Comando",
      minWidth: 220,
      flex: 1.1,
      sortable: false,
      renderCell: (params: GridRenderCellParams<DiagnosticRow>) => (
        <Typography
          component="code"
          sx={{
            fontFamily: '"Roboto Mono", "SFMono-Regular", monospace',
            fontSize: "0.78rem",
            color: "text.secondary",
            whiteSpace: "normal"
          }}
        >
          {params.row.command?.command ?? "Nessuna azione necessaria"}
        </Typography>
      )
    },
    {
      field: "copy",
      headerName: "",
      width: 120,
      sortable: false,
      disableColumnMenu: true,
      align: "right",
      renderCell: (params: GridRenderCellParams<DiagnosticRow>) =>
        params.row.command ? (
          <Button
            size="small"
            startIcon={<ContentCopyRoundedIcon />}
            onClick={() => {
              void copyTextToClipboard(params.row.command!.command)
                .then(() => {
                  setSnackbar("Comando copiato negli appunti.");
                })
                .catch(() => {
                  setSnackbar("Copia del comando non riuscita.");
                });
            }}
          >
            Copia
          </Button>
        ) : null
    }
  ];

  return (
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Diagnostica LAN" subtitle="Host self-test" networkState={liveState} />

        <Stack spacing={3} sx={{ mt: 3 }}>
          <SurfaceCard>
            <Box sx={{ p: { xs: 2.25, md: 3 } }}>
              <SectionHeader
                eyebrow="Operazioni host"
                title="Controlli host"
                description="Verifica bind, raggiungibilità LAN, profilo rete e firewall."
                actions={
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
                }
              />
            </Box>
          </SurfaceCard>

          {diagnostics ? (
            isMobile ? (
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr" }
                }}
              >
                {diagnosticRows.map(({ check, command }) => {
                  const statusTone = getStatusTone(check.status);

                  return (
                    <SurfaceCard
                      key={check.id}
                      tone="sunken"
                      sx={{
                        borderColor: theme.app.status[statusTone].border,
                        bgcolor: theme.app.status[statusTone].soft
                      }}
                    >
                      <Box sx={{ p: 2.25 }}>
                        <Stack spacing={2}>
                          <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            <Avatar
                              sx={{
                                width: 42,
                                height: 42,
                                bgcolor: alpha(theme.app.status[statusTone].main, 0.12),
                                color: theme.app.status[statusTone].main
                              }}
                            >
                              {statusTone === "pass" ? <CheckCircleRoundedIcon /> : <ErrorOutlineRoundedIcon />}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6">{check.label}</Typography>
                              <Box sx={{ mt: 0.5 }}>
                                <StatusBadge
                                  status={statusTone}
                                  label={theme.app.status[statusTone].label}
                                  icon={statusTone === "pass" ? <CheckCircleRoundedIcon /> : <ErrorOutlineRoundedIcon />}
                                />
                              </Box>
                            </Box>
                          </Stack>

                          <Typography color="text.secondary">{check.message}</Typography>

                          {command ? (
                            <SurfaceCard tone="overlay">
                              <Box sx={{ p: 1.75 }}>
                                <Stack spacing={1.25}>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
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
                                      fontSize: "0.85rem",
                                      wordBreak: "break-word"
                                    }}
                                  >
                                    {command.command}
                                  </Typography>
                                  <Button
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
                              </Box>
                            </SurfaceCard>
                          ) : null}
                        </Stack>
                      </Box>
                    </SurfaceCard>
                  );
                })}
              </Box>
            ) : (
              <SurfaceCard tone="sunken">
                <Box sx={{ height: 440 }}>
                  <DataGrid
                    aria-label="Tabella diagnostica host"
                    rows={diagnosticRows}
                    columns={columns}
                    getRowHeight={() => 88}
                    hideFooter
                    disableColumnMenu
                    disableRowSelectionOnClick
                    rowSelection={false}
                    sx={{ border: "none" }}
                  />
                </Box>
              </SurfaceCard>
            )
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
