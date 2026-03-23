import { startTransition, useEffect, useState } from "react";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import PhoneAndroidRoundedIcon from "@mui/icons-material/PhoneAndroidRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  LinearProgress,
  Snackbar,
  Stack,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { ClientProfileResponse, SyncOverviewResponse } from "../../shared/types";
import { PageHeader } from "../components/PageHeader";
import { QrCodeDialog } from "../components/QrCodeDialog";
import {
  createSyncPairingCode,
  fetchLatestAndroidAppRelease,
  fetchClientProfile,
  fetchSession,
  fetchSyncOverview,
  revokeSyncDevice
} from "../lib/api";
import type { AndroidAppReleaseInfo } from "../lib/api";
import { copyTextToClipboard } from "../lib/clipboard";
import { insetCardSx, pageCardSx } from "../lib/surfaces";
import { useQrCodeDataUrl } from "../lib/useQrCodeDataUrl";
import { useLanLiveState } from "../lib/useLanLiveState";

function formatDateTime(value: string | null) {
  if (!value) {
    return "Mai";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function buildSyncPairingQrValue(hostUrl: string | null, pairingCode: string | null) {
  if (!hostUrl || !pairingCode) {
    return null;
  }

  return `routy-sync://pair?${new URLSearchParams({
    host: hostUrl,
    code: pairingCode
  }).toString()}`;
}

export function SyncPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [overview, setOverview] = useState<SyncOverviewResponse | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingPairingCode, setCreatingPairingCode] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [sessionLanUrl, setSessionLanUrl] = useState<string | null>(null);
  const [androidRelease, setAndroidRelease] = useState<AndroidAppReleaseInfo | null>(null);
  const [pairingQrOpen, setPairingQrOpen] = useState(false);
  const [apkQrOpen, setApkQrOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const pairingQrValue = buildSyncPairingQrValue(sessionLanUrl, overview?.activePairingCode?.code ?? null);
  const pairingQrDataUrl = useQrCodeDataUrl(pairingQrValue, { width: 256 });
  const apkQrDataUrl = useQrCodeDataUrl(androidRelease?.downloadUrl ?? null, { width: 256 });

  async function syncData() {
    const profile = await fetchClientProfile();

    if (!profile.isHost) {
      startTransition(() => {
        setClientProfile(profile);
        setOverview(null);
        setSessionLanUrl(null);
        setLoading(false);
      });
      return;
    }

    const [nextOverview, session] = await Promise.all([fetchSyncOverview(), fetchSession()]);

    startTransition(() => {
      setClientProfile(profile);
      setOverview(nextOverview);
      setSessionLanUrl(session.lanUrl);
      setLoading(false);
    });
  }

  const liveState = useLanLiveState(
    {
      handlers: {
        "sync-updated": () => {
          void syncData();
        }
      },
      onFallback: () => {
        const pollingId = window.setInterval(() => {
          void syncData();
        }, 5000);

        return () => {
          window.clearInterval(pollingId);
        };
      },
      onOpen: () => {
        void syncData();
      }
    },
    []
  );

  useEffect(() => {
    void syncData().catch(() => {
      setLoading(false);
      setSnackbar("Area sync non disponibile al momento.");
    });

    let cancelled = false;

    void fetchLatestAndroidAppRelease()
      .then((release) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setAndroidRelease(release);
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setAndroidRelease(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  async function handleCreatePairingCode() {
    setCreatingPairingCode(true);

    try {
      const nextCode = await createSyncPairingCode();
      setOverview((currentOverview) =>
        currentOverview
          ? {
              ...currentOverview,
              activePairingCode: nextCode
            }
          : currentOverview
      );
      setSnackbar("Nuovo pairing code generato.");
    } catch {
      setSnackbar("Generazione pairing code non riuscita.");
    } finally {
      setCreatingPairingCode(false);
    }
  }

  async function handleRevokeDevice(deviceId: string) {
    setRevokingDeviceId(deviceId);

    try {
      await revokeSyncDevice(deviceId);
      await syncData();
      setSnackbar("Device revocato.");
    } catch {
      setSnackbar("Revoca device non riuscita.");
    } finally {
      setRevokingDeviceId(null);
    }
  }

  function renderAndroidDownloadCard() {
    return (
      <Card
        variant="outlined"
        sx={{
          ...pageCardSx,
          background: isDark
            ? `linear-gradient(180deg, ${alpha("#0f9d94", 0.18)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`
            : `linear-gradient(180deg, ${alpha("#0f9d94", 0.08)} 0%, rgba(255,255,255,0.97) 100%)`
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Avatar sx={{ bgcolor: alpha("#0f9d94", 0.12), color: "secondary.main" }}>
                <PhoneAndroidRoundedIcon />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5">APK Android</Typography>
              </Box>
            </Stack>

            {androidRelease ? (
              <Box
                sx={{
                  p: 2,
                  ...insetCardSx,
                  border: `1px solid ${alpha(theme.palette.secondary.main, isDark ? 0.28 : 0.16)}`,
                  bgcolor: alpha(theme.palette.background.paper, isDark ? 0.7 : 0.92)
                }}
              >
                <Typography variant="overline" color="secondary.main">
                  Release corrente
                </Typography>
                <Typography variant="h6" sx={{ wordBreak: "break-word" }}>
                  Routy Sync {androidRelease.version}
                </Typography>
                <Typography color="text.secondary" sx={{ wordBreak: "break-word" }}>
                  {androidRelease.assetName}
                </Typography>
              </Box>
            ) : (
              <Typography color="text.secondary">
                Metadata APK non disponibili al momento. Riprova quando la release Android e raggiungibile.
              </Typography>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              {androidRelease ? (
                <Button
                  variant="contained"
                  startIcon={<DownloadRoundedIcon />}
                  href={androidRelease.downloadUrl}
                  rel="noreferrer"
                  target="_blank"
                  sx={{ alignSelf: "flex-start" }}
                >
                  Scarica APK
                </Button>
              ) : (
                <Button variant="contained" startIcon={<DownloadRoundedIcon />} disabled sx={{ alignSelf: "flex-start" }}>
                  Scarica APK
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<QrCode2RoundedIcon />}
                disabled={!androidRelease}
                onClick={() => {
                  setApkQrOpen(true);
                }}
                sx={{ alignSelf: "flex-start" }}
              >
                Mostra QR APK
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Sync Host" subtitle="Android autosync" networkState={liveState} />

        <Stack spacing={3} sx={{ mt: 3 }}>
          {loading ? <Typography color="text.secondary">Caricamento area sync...</Typography> : null}

          {!loading && !clientProfile?.isHost ? (
            <>
              <Alert severity="info">
                Questa sezione si configura solo dal device host. I client LAN possono usare Routy, ma non generare pairing code
                o revocare device Android.
              </Alert>

              <Card variant="outlined" sx={pageCardSx}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="h5">Come funziona</Typography>
                    <Typography color="text.secondary">
                      L’host genera un pairing code temporaneo. L’app Android puo anche scansionare un QR che compila host e
                      codice in un colpo solo. Dopo il pairing, l’autosync parte quando il telefono torna sulla LAN e l’host
                      risponde.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>

              {renderAndroidDownloadCard()}
            </>
          ) : null}

          {!loading && clientProfile?.isHost && overview ? (
            <>
              {liveState === "fallback" ? (
                <Alert severity="warning">Connessione live non disponibile. Sto aggiornando la sezione Sync con polling.</Alert>
              ) : null}

              <Box
                sx={{
                  display: "grid",
                  gap: 2.5,
                  gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "1.05fr 0.95fr 0.85fr" }
                }}
              >
                <Card
                  variant="outlined"
                  sx={{
                    ...pageCardSx,
                    background: isDark
                      ? `linear-gradient(180deg, ${alpha("#1769aa", 0.22)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`
                      : `linear-gradient(180deg, ${alpha("#1769aa", 0.1)} 0%, rgba(255,255,255,0.96) 100%)`
                  }}
                >
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Avatar sx={{ bgcolor: alpha("#1769aa", 0.12), color: "primary.main" }}>
                          <LinkRoundedIcon />
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h5">Pairing Android</Typography>
                        </Box>
                      </Stack>

                      {overview.activePairingCode ? (
                        <Box
                          sx={{
                            p: 2,
                            ...insetCardSx,
                            border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.3 : 0.14)}`,
                            bgcolor: alpha(theme.palette.background.paper, isDark ? 0.68 : 0.92)
                          }}
                        >
                          <Typography sx={{ fontSize: "2.4rem", fontWeight: 800, letterSpacing: "0.18em" }}>
                            {overview.activePairingCode.code}
                          </Typography>
                          <Typography color="text.secondary">
                            Scade alle {formatDateTime(overview.activePairingCode.expiresAt)}
                          </Typography>
                          {sessionLanUrl ? (
                            <Typography color="text.secondary">Host LAN: {sessionLanUrl}</Typography>
                          ) : null}
                        </Box>
                      ) : (
                        <Typography color="text.secondary">Nessun pairing code attivo al momento.</Typography>
                      )}

                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                        <Button
                          variant="contained"
                          startIcon={<SyncRoundedIcon />}
                          disabled={creatingPairingCode}
                          onClick={() => {
                            void handleCreatePairingCode();
                          }}
                          sx={{ alignSelf: "flex-start" }}
                        >
                          {overview.activePairingCode ? "Rigenera pairing code" : "Genera pairing code"}
                        </Button>
                        {overview.activePairingCode && pairingQrValue ? (
                          <Button
                            variant="outlined"
                            startIcon={<QrCode2RoundedIcon />}
                            onClick={() => {
                              setPairingQrOpen(true);
                            }}
                            sx={{ alignSelf: "flex-start" }}
                          >
                            Mostra QR pairing
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
                {renderAndroidDownloadCard()}
              </Box>

              <Card variant="outlined" sx={pageCardSx}>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar sx={{ bgcolor: alpha("#1769aa", 0.12), color: "primary.main" }}>
                        <PhoneAndroidRoundedIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h5">Device registrati</Typography>
                        <Typography color="text.secondary">Config attiva e mapping delle cartelle.</Typography>
                      </Box>
                    </Stack>

                    {overview.devices.length === 0 ? (
                      <Typography color="text.secondary">Nessun device Android registrato.</Typography>
                    ) : (
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1.5,
                          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }
                        }}
                      >
                        {overview.devices.map((device) => (
                          <Card key={device.id} variant="outlined" sx={insetCardSx}>
                            <CardContent>
                              <Stack spacing={1.5}>
                                <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="flex-start">
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="h6" sx={{ wordBreak: "break-word" }}>
                                      {device.deviceName}
                                    </Typography>
                                    <Typography color="text.secondary">
                                      {device.platform.toUpperCase()} • visto {formatDateTime(device.lastSeenAt)}
                                    </Typography>
                                    <Typography color="text.secondary">
                                      Ultima sync {formatDateTime(device.lastSyncAt)}
                                    </Typography>
                                  </Box>

                                  <Button
                                    color="error"
                                    startIcon={<DeleteOutlineRoundedIcon />}
                                    disabled={revokingDeviceId === device.id}
                                    onClick={() => {
                                      void handleRevokeDevice(device.id);
                                    }}
                                  >
                                    Revoca
                                  </Button>
                                </Stack>

                                <Box>
                                  <Typography variant="overline" color="secondary.main">
                                    Mapping attivi
                                  </Typography>
                                  <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                                    {device.mappings.length > 0 ? (
                                      device.mappings.map((mapping) => (
                                        <Box
                                          key={mapping.id}
                                          sx={{
                                            p: 1.2,
                                            ...insetCardSx,
                                            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.04),
                                            border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)}`
                                          }}
                                        >
                                          <Typography sx={{ fontWeight: 700 }}>{mapping.sourceName}</Typography>
                                          <Typography color="text.secondary">
                                            {mapping.trackedFileCount} file tracciati • ultima sync {formatDateTime(mapping.lastSyncedAt)}
                                          </Typography>
                                        </Box>
                                      ))
                                    ) : (
                                      <Typography color="text.secondary">Nessuna cartella configurata.</Typography>
                                    )}
                                  </Stack>
                                </Box>
                              </Stack>
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={pageCardSx}>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h5">Attivita recente</Typography>

                    {overview.activeUploads.length > 0 ? (
                      <Stack spacing={1.25}>
                        {overview.activeUploads.map((upload) => (
                          <Box
                            key={`${upload.deviceId}-${upload.mappingId}`}
                            sx={{
                              p: 1.5,
                              ...insetCardSx,
                              border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.22 : 0.1)}`,
                              bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.04)
                            }}
                          >
                            <Stack spacing={1}>
                              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between">
                                <Box>
                                  <Typography sx={{ fontWeight: 700 }}>
                                    {upload.deviceName} sta sincronizzando {upload.mappingSourceName}
                                  </Typography>
                                  <Typography color="text.secondary">
                                    {upload.uploadedFiles}/{upload.totalFiles} file • {(upload.uploadedBytes / (1024 * 1024)).toFixed(1)} /{" "}
                                    {(upload.totalBytes / (1024 * 1024)).toFixed(1)} MB
                                  </Typography>
                                </Box>
                                <Typography color="text.secondary">{upload.percentage}%</Typography>
                              </Stack>
                              <LinearProgress
                                variant="determinate"
                                value={upload.percentage}
                                sx={{ height: 10, borderRadius: 999 }}
                              />
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    ) : null}

                    {overview.jobs.length === 0 ? (
                      <Typography color="text.secondary">Nessun job sync registrato.</Typography>
                    ) : (
                      <Stack spacing={1.25}>
                        {overview.jobs.map((job) => (
                          <Box
                            key={job.id}
                            sx={{
                              p: 1.5,
                              ...insetCardSx,
                              border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)}`,
                              bgcolor: alpha(theme.palette.background.paper, isDark ? 0.62 : 0.92)
                            }}
                          >
                            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between">
                              <Box>
                                <Typography sx={{ fontWeight: 700 }}>
                                  {job.deviceName} → {job.mappingSourceName}
                                </Typography>
                                <Typography color="text.secondary">
                                  {formatDateTime(job.startedAt)} → {formatDateTime(job.completedAt)}
                                </Typography>
                              </Box>
                              <Typography color="text.secondary">
                                {job.uploadedCount} caricati • {job.skippedCount} saltati • {job.failedCount} falliti
                              </Typography>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
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

      <QrCodeDialog
        open={pairingQrOpen}
        onClose={() => {
          setPairingQrOpen(false);
        }}
        title="QR pairing Android"
        description="Scansiona questo codice dalla schermata Sync Android per compilare host LAN e pairing code."
        qrCodeAlt="QR pairing Android"
        qrCodeDataUrl={pairingQrDataUrl}
        onCopy={
          pairingQrValue
            ? () => {
                void copyTextToClipboard(pairingQrValue)
                  .then(() => {
                    setSnackbar("Payload QR pairing copiato.");
                  })
                  .catch(() => {
                    setSnackbar("Copia payload pairing non disponibile.");
                  });
              }
            : undefined
        }
        copyLabel="Copia payload QR"
      />

      <QrCodeDialog
        open={apkQrOpen}
        onClose={() => {
          setApkQrOpen(false);
        }}
        title="QR download APK"
        description="Scansiona questo codice da un altro device Android per aprire subito il download diretto dell’APK Routy Sync."
        qrCodeAlt="QR download APK Android"
        qrCodeDataUrl={apkQrDataUrl}
        subject={androidRelease ? `Routy Sync ${androidRelease.version}` : undefined}
        url={androidRelease?.downloadUrl}
        onCopy={
          androidRelease
            ? () => {
                void copyTextToClipboard(androidRelease.downloadUrl)
                  .then(() => {
                    setSnackbar("Link APK copiato.");
                  })
                  .catch(() => {
                    setSnackbar("Copia link APK non disponibile.");
                  });
              }
            : undefined
        }
        copyLabel="Copia link APK"
        actionHref={androidRelease?.downloadUrl}
        actionLabel="Apri download"
        actionIcon={<DownloadRoundedIcon />}
      />
    </Box>
  );
}
