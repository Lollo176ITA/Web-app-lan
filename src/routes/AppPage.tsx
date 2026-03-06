import { startTransition, useEffect, useState } from "react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import OfflineBoltRoundedIcon from "@mui/icons-material/OfflineBoltRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import QRCode from "qrcode";
import { Link as RouterLink } from "react-router-dom";
import type { LibraryItem, LibraryKind, SessionInfo } from "../../shared/types";
import { LibraryGrid } from "../components/LibraryGrid";
import { MediaDetail } from "../components/MediaDetail";
import { UploadSurface } from "../components/UploadSurface";
import { fetchSnapshot, openLibraryEvents, uploadFiles } from "../lib/api";
import { formatBytes } from "../lib/format";

type FilterValue = "all" | LibraryKind;
type LiveState = "live" | "fallback" | "connecting";

const filters: Array<{ label: string; value: FilterValue }> = [
  { label: "Tutti", value: "all" },
  { label: "Video", value: "video" },
  { label: "Immagini", value: "image" },
  { label: "Audio", value: "audio" },
  { label: "Documenti", value: "document" },
  { label: "Archivi", value: "archive" },
  { label: "Altro", value: "other" }
];

export function AppPage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [liveState, setLiveState] = useState<LiveState>("connecting");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  async function syncSnapshot() {
    const snapshot = await fetchSnapshot();

    startTransition(() => {
      setSession(snapshot.session);
      setItems(snapshot.items);
      setLoading(false);
    });
  }

  useEffect(() => {
    let active = true;

    void fetchSnapshot().then((snapshot) => {
      if (!active) {
        return;
      }

      startTransition(() => {
        setSession(snapshot.session);
        setItems(snapshot.items);
        setLoading(false);
      });
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session?.lanUrl) {
      return;
    }

    void QRCode.toDataURL(session.lanUrl, {
      margin: 1,
      width: 208,
      color: {
        dark: "#10273a",
        light: "#0000"
      }
    }).then(setQrCodeDataUrl);
  }, [session?.lanUrl]);

  useEffect(() => {
    let pollingId: number | undefined;
    let source: EventSource | undefined;

    const startPolling = () => {
      setLiveState("fallback");
      pollingId = window.setInterval(() => {
        void syncSnapshot();
      }, 15000);
    };

    source = openLibraryEvents(
      () => {
        setLiveState("live");
        void syncSnapshot();
      },
      () => {
        startPolling();
      },
      () => {
        setLiveState("live");
      }
    );

    return () => {
      source?.close();

      if (pollingId) {
        window.clearInterval(pollingId);
      }
    };
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const filteredItems = filter === "all" ? items : items.filter((item) => item.kind === filter);

  useEffect(() => {
    if (filteredItems.length === 0) {
      return;
    }

    if (!selectedId || !filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0].id);
    }
  }, [filteredItems, selectedId]);

  const selectedItem = filteredItems.find((item) => item.id === selectedId) ?? null;

  async function handleUpload(files: File[]) {
    setUploading(true);

    try {
      const response = await uploadFiles(files);
      await syncSnapshot();
      setSelectedId(response.items[0]?.id ?? null);
      setSnackbar(`${files.length} file caricati in LAN.`);
    } finally {
      setUploading(false);
    }
  }

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
    setSnackbar("Link copiato negli appunti.");
  }

  return (
    <Box sx={{ pb: 6 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2.5, md: 4 } }}>
        <Stack spacing={2.5}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 2.5 },
              borderRadius: 6,
              bgcolor: "rgba(255,255,255,0.86)"
            }}
          >
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Button component={RouterLink} to="/" variant="text" startIcon={<ArrowBackRoundedIcon />}>
                  Home
                </Button>
                <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />
                <Stack spacing={0.25}>
                  <Typography variant="h4" sx={{ fontSize: "clamp(1.7rem, 2vw, 2.35rem)" }}>
                    Routeroom LAN
                  </Typography>
                  <Typography color="text.secondary">
                    Hub locale per file, video e media condivisi
                  </Typography>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  icon={liveState === "live" ? <WifiRoundedIcon /> : <AutorenewRoundedIcon />}
                  color={liveState === "live" ? "secondary" : "default"}
                  label={
                    liveState === "live"
                      ? "Aggiornamento live attivo"
                      : liveState === "fallback"
                        ? "Fallback polling"
                        : "Connessione eventi"
                  }
                />
                <Chip icon={<OfflineBoltRoundedIcon />} label="Zero Internet a runtime" />
              </Stack>
            </Stack>
          </Paper>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", xl: "0.78fr 1.22fr" }
            }}
          >
            <Paper sx={{ p: { xs: 2.25, md: 3 }, borderRadius: 6, bgcolor: "rgba(255,255,255,0.86)" }}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 4,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: "secondary.main",
                      color: "common.white"
                    }}
                  >
                    <LanRoundedIcon />
                  </Box>
                  <Box>
                    <Typography variant="h5">Sessione host</Typography>
                    <Typography color="text.secondary">Condividi questo indirizzo nella stessa rete</Typography>
                  </Box>
                </Stack>

                {loading || !session ? (
                  <Typography color="text.secondary">Caricamento informazioni host...</Typography>
                ) : (
                  <Stack spacing={2}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 5,
                        bgcolor: "rgba(23, 105, 170, 0.04)"
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        URL LAN
                      </Typography>
                      <Typography variant="h5" sx={{ mt: 0.5, wordBreak: "break-all" }}>
                        {session.lanUrl}
                      </Typography>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 2 }}>
                        <Button
                          variant="contained"
                          startIcon={<ContentCopyRoundedIcon />}
                          onClick={() => {
                            void copyText(session.lanUrl);
                          }}
                        >
                          Copia URL
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<QrCode2RoundedIcon />}
                          onClick={() => {
                            void copyText(session.hostName);
                          }}
                        >
                          Copia host
                        </Button>
                      </Stack>
                    </Paper>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <Paper sx={{ p: 2, borderRadius: 5, flex: 1 }}>
                        <Typography color="text.secondary" variant="body2">
                          Libreria persistente
                        </Typography>
                        <Typography variant="h4">{session.itemCount}</Typography>
                        <Typography color="text.secondary">elementi disponibili</Typography>
                      </Paper>
                      <Paper sx={{ p: 2, borderRadius: 5, flex: 1 }}>
                        <Typography color="text.secondary" variant="body2">
                          Totale salvato
                        </Typography>
                        <Typography variant="h4">{formatBytes(session.totalBytes)}</Typography>
                        <Typography color="text.secondary">su {session.storagePath}</Typography>
                      </Paper>
                    </Stack>

                    {qrCodeDataUrl ? (
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 5,
                          alignSelf: "flex-start",
                          bgcolor: "rgba(15, 157, 148, 0.05)"
                        }}
                      >
                        <Box component="img" src={qrCodeDataUrl} alt="QR code URL LAN" sx={{ width: 160, height: 160, display: "block" }} />
                      </Paper>
                    ) : null}
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Paper sx={{ p: { xs: 2.25, md: 3 }, borderRadius: 6, bgcolor: "rgba(255,255,255,0.86)" }}>
              <Stack spacing={2.5}>
                <UploadSurface onUpload={handleUpload} uploading={uploading} />
                <Alert severity={liveState === "fallback" ? "warning" : "info"} sx={{ borderRadius: 4 }}>
                  {liveState === "fallback"
                    ? "SSE non disponibile: Routeroom aggiorna la libreria con polling lento."
                    : "Quando un altro device carica un file, la libreria si aggiorna senza refresh."}
                </Alert>
              </Stack>
            </Paper>
          </Box>

          <Paper id="libreria" sx={{ p: { xs: 2.25, md: 3 }, borderRadius: 6, bgcolor: "rgba(255,255,255,0.86)" }}>
            <Stack spacing={2.5}>
              <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={2}>
                <Box>
                  <Typography variant="h3">Libreria locale</Typography>
                  <Typography color="text.secondary">
                    Filtra i contenuti e apri subito il player o il download locale.
                  </Typography>
                </Box>
                <ToggleButtonGroup
                  color="primary"
                  exclusive
                  value={filter}
                  onChange={(_event, nextValue: FilterValue | null) => {
                    if (nextValue) {
                      setFilter(nextValue);
                    }
                  }}
                  sx={{ flexWrap: "wrap", gap: 1, justifyContent: "flex-start" }}
                >
                  {filters.map((entry) => (
                    <ToggleButton
                      key={entry.value}
                      value={entry.value}
                      sx={{
                        borderRadius: "999px !important",
                        border: "1px solid rgba(16, 39, 58, 0.12) !important",
                        px: 2
                      }}
                    >
                      {entry.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  alignItems: "start",
                  gridTemplateColumns: { xs: "1fr", xl: "0.95fr 1.05fr" }
                }}
              >
                <LibraryGrid items={filteredItems} selectedId={selectedId} onSelect={setSelectedId} />
                <MediaDetail item={selectedItem} onCopyLink={copyText} />
              </Box>
            </Stack>
          </Paper>
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
