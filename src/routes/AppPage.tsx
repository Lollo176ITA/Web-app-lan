import { startTransition, useEffect, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import OfflineBoltRoundedIcon from "@mui/icons-material/OfflineBoltRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Container,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
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
      width: 192,
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
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <AppBar
          position="static"
          color="transparent"
          sx={{
            borderRadius: { xs: 3, md: 4 },
            px: { xs: 0.5, md: 1.5 }
          }}
        >
          <Toolbar
            sx={{
              gap: 2,
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", md: "center" },
              flexDirection: { xs: "column", md: "row" },
              minHeight: { xs: 76, md: 88 },
              py: { xs: 1.5, md: 0 }
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button component={RouterLink} to="/" variant="text" startIcon={<ArrowBackRoundedIcon />}>
                Home
              </Button>
              <Stack spacing={0.25}>
                <Typography variant="h4" sx={{ fontSize: "clamp(1.65rem, 2vw, 2.35rem)" }}>
                  Routeroom LAN
                </Typography>
                <Typography color="text.secondary">Hub locale per file, video e media condivisi</Typography>
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
            </Stack>
          </Toolbar>
        </AppBar>

        <Stack spacing={3} sx={{ mt: 3 }}>
          <Box
            sx={{
              display: "grid",
              gap: 2.5,
              alignItems: "start",
              gridTemplateColumns: { xs: "1fr", xl: "0.84fr 1.16fr" }
            }}
          >
            <Card>
              <CardHeader
                avatar={
                  <Avatar sx={{ bgcolor: "secondary.main" }}>
                    <LanRoundedIcon />
                  </Avatar>
                }
                title="Sessione host"
                subheader="Condividi questo indirizzo nella stessa rete"
              />
              <CardContent sx={{ pt: 0 }}>
                {loading || !session ? (
                  <Typography color="text.secondary">Caricamento informazioni host...</Typography>
                ) : (
                  <Stack spacing={2.25}>
                    <Box
                      sx={{
                        p: 2.25,
                        borderRadius: 4,
                        bgcolor: alpha("#1769aa", 0.05)
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        URL LAN
                      </Typography>
                      <Typography variant="h5" sx={{ mt: 0.75, wordBreak: "break-word" }}>
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
                    </Box>

                    <Box
                      sx={{
                        display: "grid",
                        gap: 1.5,
                        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }
                      }}
                    >
                      <Card variant="outlined">
                        <CardContent>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar sx={{ bgcolor: alpha("#1769aa", 0.14), color: "primary.main" }}>
                              <StorageRoundedIcon />
                            </Avatar>
                            <Box>
                              <Typography color="text.secondary" variant="body2">
                                Libreria persistente
                              </Typography>
                              <Typography variant="h4">{session.itemCount}</Typography>
                              <Typography color="text.secondary">elementi disponibili</Typography>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography color="text.secondary" variant="body2">
                            Totale salvato
                          </Typography>
                          <Typography variant="h4">{formatBytes(session.totalBytes)}</Typography>
                          <Typography color="text.secondary" sx={{ wordBreak: "break-word" }}>
                            {session.storagePath}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Box>

                    {qrCodeDataUrl ? (
                      <Card variant="outlined" sx={{ alignSelf: "flex-start" }}>
                        <CardContent sx={{ p: 2 }}>
                          <Box component="img" src={qrCodeDataUrl} alt="QR code URL LAN" sx={{ width: 164, height: 164, display: "block" }} />
                        </CardContent>
                      </Card>
                    ) : null}
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Stack spacing={2.5}>
              <UploadSurface onUpload={handleUpload} uploading={uploading} />
              <Alert severity={liveState === "fallback" ? "warning" : "info"} sx={{ borderRadius: 4 }}>
                {liveState === "fallback"
                  ? "SSE non disponibile: Routeroom aggiorna la libreria con polling lento."
                  : "Quando un altro device carica un file, la libreria si aggiorna senza refresh."}
              </Alert>
            </Stack>
          </Box>

          <Card id="libreria">
            <CardContent sx={{ pb: 0 }}>
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "flex-start", md: "center" }}
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="h5">Libreria locale</Typography>
                    <Typography color="text.secondary">
                      Filtra i contenuti e apri subito il player o il download locale.
                    </Typography>
                  </Box>
                  <Chip
                    color="primary"
                    label={filteredItems.length === 1 ? "1 elemento visibile" : `${filteredItems.length} elementi visibili`}
                    sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
                  />
                </Stack>

                <Box
                  sx={{
                    p: 0.75,
                    borderRadius: 4,
                    bgcolor: alpha("#1769aa", 0.05),
                    border: `1px solid ${alpha("#1769aa", 0.08)}`
                  }}
                >
                  <FormControl fullWidth size="small" sx={{ display: { xs: "flex", sm: "none" } }}>
                    <InputLabel id="library-filter-label">Filtro libreria</InputLabel>
                    <Select
                      labelId="library-filter-label"
                      value={filter}
                      label="Filtro libreria"
                      onChange={(event) => {
                        setFilter(event.target.value as FilterValue);
                      }}
                    >
                      {filters.map((entry) => (
                        <MenuItem key={entry.value} value={entry.value}>
                          {entry.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Box sx={{ display: { xs: "none", sm: "block" } }}>
                    <Tabs
                      value={filter}
                      onChange={(_event, nextValue: FilterValue) => {
                        setFilter(nextValue);
                      }}
                      variant="scrollable"
                      scrollButtons={false}
                      sx={{
                        minHeight: 0,
                        "& .MuiTabs-flexContainer": {
                          gap: 0.5
                        },
                        "& .MuiTab-root": {
                          color: "text.secondary"
                        },
                        "& .MuiTab-root.Mui-selected": {
                          bgcolor: "background.paper",
                          color: "primary.main",
                          boxShadow: "0 8px 18px rgba(16, 39, 58, 0.08)"
                        }
                      }}
                    >
                      {filters.map((entry) => (
                        <Tab key={entry.value} label={entry.label} value={entry.value} />
                      ))}
                    </Tabs>
                  </Box>
                </Box>
              </Stack>
            </CardContent>

            <Divider sx={{ mt: 2.5 }} />

            <CardContent>
              <Box
                sx={{
                  display: "grid",
                  gap: 2.5,
                  alignItems: "start",
                  gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 0.92fr) minmax(0, 1.08fr)" }
                }}
              >
                <LibraryGrid items={filteredItems} selectedId={selectedId} onSelect={setSelectedId} />
                <MediaDetail item={selectedItem} onCopyLink={copyText} />
              </Box>
            </CardContent>
          </Card>
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
