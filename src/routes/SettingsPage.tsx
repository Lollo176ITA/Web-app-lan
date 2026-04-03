import { startTransition, useEffect, useState } from "react";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  FormControlLabel,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { alpha, useTheme } from "@mui/material/styles";
import type {
  FeatureFlags,
  HostDiagnosticCheck,
  HostDiagnosticCommand,
  HostDiagnosticsResponse,
  HostRuntimeStatsResponse
} from "../../shared/types";
import { DiagnosticsRealtimePanel } from "../components/DiagnosticsRealtimePanel";
import { PageHeader } from "../components/PageHeader";
import { copyTextToClipboard } from "../lib/clipboard";
import { useAppShell } from "../lib/app-shell-context";
import { normalizeNickname } from "../lib/identity";
import { useIdentity } from "../lib/identity-context";
import {
  fetchClientProfile,
  fetchDiagnostics,
  fetchDiagnosticsRuntimeStats,
  fetchSession,
  updateFeatureFlags
} from "../lib/api";
import { cardRadii, pageCardSx } from "../lib/surfaces";

type RuntimeState = "idle" | "loading" | "ready" | "error";
type FeatureFlagKey = keyof FeatureFlags;

const featureFlagLabels: Record<FeatureFlagKey, { title: string; body: string }> = {
  homepage: {
    title: "Homepage",
    body: "Controlla la landing `/`. Quando e spenta la root reindirizza direttamente alla libreria."
  },
  chat: {
    title: "Chat",
    body: "Abilita chat globale e conversazioni private nella LAN."
  },
  streaming: {
    title: "Streaming",
    body: "Abilita stanze watch party e sincronizzazione playback tra i client."
  },
  sync: {
    title: "Sync",
    body: "Abilita pairing Android, overview sync e gestione dei device."
  }
};

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

function getCheckTone(check: HostDiagnosticCheck, theme: Theme) {
  const isDark = theme.palette.mode === "dark";

  if (check.status === "pass") {
    const accent = theme.palette.success.main;
    return {
      accent,
      soft: alpha(accent, isDark ? 0.16 : 0.08),
      border: alpha(accent, isDark ? 0.26 : 0.18),
      label: "OK"
    };
  }

  const accent = check.status === "warn" ? theme.palette.warning.main : theme.palette.error.main;
  return {
    accent,
    soft: alpha(accent, isDark ? 0.16 : 0.08),
    border: alpha(accent, isDark ? 0.26 : 0.18),
    label: check.status === "warn" ? "Da verificare" : "Errore"
  };
}

export function SettingsPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { identity, setIdentity } = useIdentity();
  const { clientProfile, refresh, session } = useAppShell();
  const [resolvedClientProfile, setResolvedClientProfile] = useState(clientProfile);
  const [resolvedSession, setResolvedSession] = useState(session);
  const [nicknameDraft, setNicknameDraft] = useState(identity?.nickname ?? "");
  const [diagnostics, setDiagnostics] = useState<HostDiagnosticsResponse | null>(null);
  const [runtimeStats, setRuntimeStats] = useState<HostRuntimeStatsResponse | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>("idle");
  const [updatingFeature, setUpdatingFeature] = useState<FeatureFlagKey | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const isHostClient = resolvedClientProfile?.isHost === true;

  useEffect(() => {
    if (clientProfile) {
      setResolvedClientProfile(clientProfile);
    }
  }, [clientProfile]);

  useEffect(() => {
    if (session) {
      setResolvedSession(session);
    }
  }, [session]);

  useEffect(() => {
    let active = true;

    void Promise.all([
      resolvedClientProfile ? Promise.resolve(resolvedClientProfile) : fetchClientProfile(),
      resolvedSession ? Promise.resolve(resolvedSession) : fetchSession()
    ])
      .then(([nextClientProfile, nextSession]) => {
        if (!active) {
          return;
        }

        setResolvedClientProfile(nextClientProfile);
        setResolvedSession(nextSession);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [resolvedClientProfile, resolvedSession]);

  useEffect(() => {
    setNicknameDraft(identity?.nickname ?? "");
  }, [identity?.nickname]);

  useEffect(() => {
    if (!isHostClient) {
      setDiagnostics(null);
      return;
    }

    let active = true;

    void fetchDiagnostics()
      .then((payload) => {
        if (active) {
          setDiagnostics(payload);
        }
      })
      .catch(() => {
        if (active) {
          setDiagnostics(null);
          setSnackbar("Diagnostica non disponibile al momento.");
        }
      });

    return () => {
      active = false;
    };
  }, [isHostClient]);

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

  if (!identity) {
    return null;
  }

  const normalizedNickname = normalizeNickname(nicknameDraft);
  const hasNicknameChanges = normalizedNickname.length > 0 && normalizedNickname !== identity.nickname;
  const featureFlags = resolvedSession?.featureFlags;

  async function handleFeatureFlagChange(feature: FeatureFlagKey, enabled: boolean) {
    setUpdatingFeature(feature);

    try {
      const response = await updateFeatureFlags({ [feature]: enabled });
      setResolvedSession((currentSession) =>
        currentSession
          ? {
              ...currentSession,
              featureFlags: response.featureFlags
            }
          : currentSession
      );
      await refresh();
      setSnackbar(`Impostazione aggiornata: ${featureFlagLabels[feature].title}.`);
    } catch {
      setSnackbar("Aggiornamento impostazioni non riuscito.");
    } finally {
      setUpdatingFeature(null);
    }
  }

  return (
    <Box sx={{ pb: 8 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Impostazioni" subtitle="Profilo locale e controllo host" />

        <Stack spacing={3} sx={{ mt: 3 }}>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5}>
            <Card sx={{ flex: 1, ...pageCardSx }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
                      <ManageAccountsRoundedIcon />
                    </Avatar>
                    <Typography variant="h5">Profilo locale</Typography>
                  </Stack>

                  <TextField
                    fullWidth
                    label="Nickname"
                    value={nicknameDraft}
                    onChange={(event) => {
                      setNicknameDraft(event.target.value);
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: cardRadii.panel
                      }
                    }}
                  />

                  <Button
                    variant="contained"
                    startIcon={<SaveRoundedIcon />}
                    disabled={!hasNicknameChanges}
                    onClick={() => {
                      if (!normalizedNickname) {
                        return;
                      }

                      setIdentity({
                        ...identity,
                        nickname: normalizedNickname
                      });
                      setSnackbar("Profilo aggiornato.");
                    }}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Salva modifiche
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ flex: 1, ...pageCardSx }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Avatar sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.12), color: "secondary.main" }}>
                      <BadgeRoundedIcon />
                    </Avatar>
                    <Typography variant="h5">Identita</Typography>
                  </Stack>

                  <Box>
                    <Typography variant="overline" color="secondary.main">
                      ID utente
                    </Typography>
                    <Typography sx={{ wordBreak: "break-all" }}>{identity.id}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="overline" color="secondary.main">
                      Ruolo corrente
                    </Typography>
                    <Typography>{isHostClient ? "Host Routy" : "Client LAN"}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          <Card sx={pageCardSx}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
                    <LanRoundedIcon />
                  </Avatar>
                  <Typography variant="h5">Rete</Typography>
                </Stack>
                <Box>
                  <Typography variant="overline" color="secondary.main">
                    IP client
                  </Typography>
                  <Typography>{clientProfile?.clientIp ?? "Non disponibile"}</Typography>
                </Box>

                <Box>
                  <Typography variant="overline" color="secondary.main">
                    User agent
                  </Typography>
                  <Typography sx={{ wordBreak: "break-word" }}>{clientProfile?.userAgent ?? "Non disponibile"}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {isHostClient ? (
            <>
              <Card sx={pageCardSx}>
                <CardContent>
                  <Stack spacing={2.5}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12), color: "warning.main" }}>
                        <SettingsRoundedIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h5">Feature flags host</Typography>
                        <Typography color="text.secondary">
                          Da qui l'host decide quali aree della web app restano accessibili nella LAN.
                        </Typography>
                      </Box>
                    </Stack>

                    {!featureFlags ? (
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <CircularProgress size={20} />
                        <Typography color="text.secondary">Caricamento impostazioni host...</Typography>
                      </Stack>
                    ) : (
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1.5,
                          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }
                        }}
                      >
                        {(Object.keys(featureFlagLabels) as FeatureFlagKey[]).map((featureKey) => {
                          const feature = featureFlagLabels[featureKey];
                          const checked = featureFlags[featureKey];
                          const busy = updatingFeature === featureKey;

                          return (
                            <Card
                              key={featureKey}
                              variant="outlined"
                              sx={{
                                borderRadius: cardRadii.panel,
                                borderColor: alpha(theme.palette.primary.main, isDark ? 0.24 : 0.12)
                              }}
                            >
                              <CardContent>
                                <Stack spacing={1.25}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                                    <Box sx={{ flex: 1 }}>
                                      <Typography variant="h6">{feature.title}</Typography>
                                      <Typography color="text.secondary">{feature.body}</Typography>
                                    </Box>

                                    {busy ? <CircularProgress size={20} /> : null}
                                  </Stack>

                                  <FormControlLabel
                                    control={
                                      <Switch
                                        data-testid={`feature-toggle-${featureKey}`}
                                        checked={checked}
                                        disabled={busy}
                                        inputProps={{
                                          "aria-label": `Toggle ${feature.title}`
                                        }}
                                        onChange={(_event, nextChecked) => {
                                          void handleFeatureFlagChange(featureKey, nextChecked);
                                        }}
                                      />
                                    }
                                    label={checked ? "Attiva" : "Disattiva"}
                                    sx={{ m: 0 }}
                                  />
                                </Stack>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              <DiagnosticsRealtimePanel
                loading={runtimeState === "loading" && !runtimeStats}
                stats={runtimeStats}
                unavailable={runtimeState === "error"}
              />

              {diagnostics ? (
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }
                  }}
                >
                  {diagnostics.checks.map((check) => {
                    const tone = getCheckTone(check, theme);
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

                                      <Button
                                        startIcon={<ContentCopyRoundedIcon />}
                                        variant="outlined"
                                        onClick={() => {
                                          void copyTextToClipboard(command.command)
                                            .then(() => {
                                              setSnackbar("Comando copiato negli appunti.");
                                            })
                                            .catch(() => {
                                              setSnackbar("Copia del comando non riuscita.");
                                            });
                                        }}
                                        sx={{ alignSelf: "flex-start" }}
                                      >
                                        Copia comando
                                      </Button>
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
              ) : (
                <Alert severity="info">Diagnostica host non disponibile al momento.</Alert>
              )}
            </>
          ) : null}
        </Stack>
      </Container>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={2600}
        onClose={() => {
          setSnackbar(null);
        }}
        message={snackbar}
      />
    </Box>
  );
}
