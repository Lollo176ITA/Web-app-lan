import { startTransition, useEffect, useState } from "react";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import PhoneAndroidRoundedIcon from "@mui/icons-material/PhoneAndroidRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
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
import type { SyncOverviewResponse } from "../../shared/types";
import { PageHeader } from "../components/PageHeader";
import { QrCodeDialog } from "../components/QrCodeDialog";
import {
  createSyncPairingCode,
  fetchClientProfile,
  fetchLatestAndroidAppRelease,
  fetchSession,
  fetchSyncOverview,
  revokeSyncDevice
} from "../lib/api";
import type { AndroidAppReleaseInfo } from "../lib/api";
import { useAppShell } from "../lib/app-shell-context";
import { copyTextToClipboard } from "../lib/clipboard";
import { insetCardSx, pageCardSx } from "../lib/surfaces";
import {
  compareVersions,
  downloadDesktopReleaseAsset,
  fetchLatestDesktopRelease,
  type DesktopReleaseInfo,
  type WindowsDesktopBuildTarget,
  windowsDesktopBuildTargets
} from "../lib/updates";
import { useQrDialog } from "../lib/useQrDialog";
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
  const { clientProfile, session } = useAppShell();
  const [overview, setOverview] = useState<SyncOverviewResponse | null>(null);
  const [resolvedClientProfile, setResolvedClientProfile] = useState(clientProfile);
  const [loading, setLoading] = useState(true);
  const [creatingPairingCode, setCreatingPairingCode] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [resolvedSession, setResolvedSession] = useState(session);
  const [androidRelease, setAndroidRelease] = useState<AndroidAppReleaseInfo | null>(null);
  const [desktopReleases, setDesktopReleases] = useState<Partial<Record<WindowsDesktopBuildTarget, DesktopReleaseInfo>>>({});
  const [downloadingDesktopTarget, setDownloadingDesktopTarget] = useState<WindowsDesktopBuildTarget | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const sessionLanUrl = resolvedSession?.lanUrl ?? null;
  const pairingQrValue = buildSyncPairingQrValue(sessionLanUrl, overview?.activePairingCode?.code ?? null);
  const pairingQrDialog = useQrDialog(pairingQrValue, { width: 256 });
  const apkQrDialog = useQrDialog(androidRelease?.downloadUrl ?? null, { width: 256 });

  async function syncData() {
    const [nextProfile, nextSession] = await Promise.all([
      clientProfile ? Promise.resolve(clientProfile) : fetchClientProfile(),
      session ? Promise.resolve(session) : fetchSession()
    ]);

    if (!nextProfile.isHost) {
      startTransition(() => {
        setResolvedClientProfile(nextProfile);
        setResolvedSession(nextSession);
        setOverview(null);
        setLoading(false);
      });
      return;
    }

    const nextOverview = await fetchSyncOverview();

    startTransition(() => {
      setResolvedClientProfile(nextProfile);
      setResolvedSession(nextSession);
      setOverview(nextOverview);
      setLoading(false);
    });
  }

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

    void Promise.allSettled([
      fetchLatestDesktopRelease("win-x64"),
      fetchLatestDesktopRelease("win-arm64")
    ]).then((results) => {
      if (cancelled) {
        return;
      }

      const nextReleases: Partial<Record<WindowsDesktopBuildTarget, DesktopReleaseInfo>> = {};

      for (const [index, result] of results.entries()) {
        const target = index === 0 ? "win-x64" : "win-arm64";

        if (result.status === "fulfilled") {
          nextReleases[target] = result.value;
        }
      }

      startTransition(() => {
        setDesktopReleases(nextReleases);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [clientProfile?.isHost, session?.lanUrl]);

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

  const publishedDesktopVersion = (Object.values(desktopReleases) as DesktopReleaseInfo[]).reduce<string | null>(
    (currentLatestVersion, release) => {
      if (!currentLatestVersion) {
        return release.version;
      }

      return compareVersions(release.version, currentLatestVersion) > 0 ? release.version : currentLatestVersion;
    },
    null
  );
  const hostVersion = resolvedSession?.appVersion ?? null;
  const webAppNeedsRefresh = hostVersion ? compareVersions(hostVersion, __APP_VERSION__) > 0 : false;
  const hostBehindPublishedVersion =
    hostVersion && publishedDesktopVersion ? compareVersions(publishedDesktopVersion, hostVersion) > 0 : false;

  async function handleDownloadDesktopRelease(target: WindowsDesktopBuildTarget) {
    const release = desktopReleases[target];

    if (!release) {
      return;
    }

    setDownloadingDesktopTarget(target);

    try {
      await downloadDesktopReleaseAsset(release.asset);
      setSnackbar(`Download ${windowsDesktopBuildTargets[target].label} avviato nel browser.`);
    } catch {
      setSnackbar(`Download ${windowsDesktopBuildTargets[target].label} non riuscito.`);
    } finally {
      setDownloadingDesktopTarget(null);
    }
  }

  function renderAndroidDownloadCard() {
    return (
      <Card
        variant="outlined"
        sx={{
          ...pageCardSx,
          bgcolor: alpha(theme.palette.secondary.main, isDark ? 0.1 : 0.04)
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Avatar sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.12), color: "secondary.main" }}>
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
                <Typography variant="h6" sx={{ wordBreak: "break-word" }}>
                  Routy Sync {androidRelease.version}
                </Typography>
                <Typography color="text.secondary" sx={{ wordBreak: "break-word" }}>
                  {androidRelease.assetName}
                </Typography>
              </Box>
            ) : (
              <Typography color="text.secondary">APK non disponibile.</Typography>
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
                onClick={apkQrDialog.openDialog}
                sx={{ alignSelf: "flex-start" }}
              >
                QR APK
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  function renderDesktopDownloadCard() {
    const desktopTargets = ["win-x64", "win-arm64"] as const;

    return (
      <Card
        variant="outlined"
        sx={{
          ...pageCardSx,
          bgcolor: alpha(theme.palette.primary.main, isDark ? 0.1 : 0.04)
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
                <DownloadRoundedIcon />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5">Desktop Windows</Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              {desktopTargets.map((target) => {
                const release = desktopReleases[target] ?? null;
                const isDownloading = downloadingDesktopTarget === target;
                const label = target === "win-x64" ? "Scarica per x64" : "Scarica ARM";

                return (
                  <Button
                    key={target}
                    variant="contained"
                    startIcon={<DownloadRoundedIcon />}
                    disabled={!release || Boolean(downloadingDesktopTarget)}
                    onClick={() => {
                      void handleDownloadDesktopRelease(target);
                    }}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {isDownloading ? `${label}...` : label}
                  </Button>
                );
              })}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  function renderWebUpdateCard() {
    return (
      <Card
        variant="outlined"
        sx={{
          ...pageCardSx,
          bgcolor: alpha(theme.palette.secondary.main, isDark ? 0.08 : 0.035)
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Avatar sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.12), color: "secondary.main" }}>
                <SyncRoundedIcon />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5">Web app</Typography>
              </Box>
            </Stack>

            <Box
              sx={{
                p: 2,
                ...insetCardSx,
                border: `1px solid ${alpha(theme.palette.secondary.main, isDark ? 0.24 : 0.12)}`,
                bgcolor: alpha(theme.palette.background.paper, isDark ? 0.68 : 0.92)
              }}
            >
              <Stack spacing={0.5}>
                <Typography color="text.secondary">Tab: Routy {__APP_VERSION__}</Typography>
                <Typography color="text.secondary">Host: {hostVersion ? `Routy ${hostVersion}` : "n/d"}</Typography>
                <Typography color="text.secondary">Release: {publishedDesktopVersion ? `Routy ${publishedDesktopVersion}` : "n/d"}</Typography>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  function renderReleaseUtilities() {
    return (
      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: { xs: "1fr", xl: "repeat(3, minmax(0, 1fr))" }
        }}
      >
        {renderAndroidDownloadCard()}
        {renderDesktopDownloadCard()}
        {renderWebUpdateCard()}
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Sync Host" subtitle="sync e update" />

        <Stack spacing={3} sx={{ mt: 3 }}>
          {loading ? <Typography color="text.secondary">Caricamento area sync...</Typography> : null}

          {!loading && !resolvedClientProfile?.isHost ? (
            <>
              <Alert severity="info">Solo l'host può creare codici e gestire i device.</Alert>

              {renderReleaseUtilities()}
            </>
          ) : null}

          {!loading && resolvedClientProfile?.isHost && overview ? (
            <>
              {liveState === "fallback" ? (
                <Alert severity="warning">Connessione live non disponibile. Aggiornamento con polling.</Alert>
              ) : null}

              <Box
                sx={{
                  display: "grid",
                  gap: 2.5,
                  gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr)" }
                }}
              >
                <Card
                  variant="outlined"
                  sx={{
                    ...pageCardSx,
                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.05)
                  }}
                >
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
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
                            Scade {formatDateTime(overview.activePairingCode.expiresAt)}
                          </Typography>
                          {sessionLanUrl ? (
                            <Typography color="text.secondary">{sessionLanUrl}</Typography>
                          ) : null}
                        </Box>
                      ) : (
                        <Typography color="text.secondary">Nessun codice attivo.</Typography>
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
                          {overview.activePairingCode ? "Rigenera codice" : "Genera codice"}
                        </Button>
                        {overview.activePairingCode && pairingQrValue ? (
                          <Button
                            variant="outlined"
                            startIcon={<QrCode2RoundedIcon />}
                            onClick={pairingQrDialog.openDialog}
                            sx={{ alignSelf: "flex-start" }}
                          >
                            QR pairing
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Box>

              {renderReleaseUtilities()}

              <Card variant="outlined" sx={pageCardSx}>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
                        <PhoneAndroidRoundedIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h5">Device registrati</Typography>
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
        {...pairingQrDialog.dialogProps}
        title="QR pairing Android"
        description="Scansiona per aprire il pairing."
        qrCodeAlt="QR pairing Android"
        onCopy={
          pairingQrValue
            ? () => {
                void copyTextToClipboard(pairingQrValue)
                  .then(() => {
                    setSnackbar("QR pairing copiato.");
                  })
                  .catch(() => {
                    setSnackbar("Copia non disponibile.");
                  });
              }
            : undefined
        }
        copyLabel="Copia QR"
      />

      <QrCodeDialog
        {...apkQrDialog.dialogProps}
        title="QR download APK"
        description="Scansiona per aprire il download APK."
        qrCodeAlt="QR download APK Android"
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
                    setSnackbar("Copia non disponibile.");
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
