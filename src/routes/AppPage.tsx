import { startTransition, useEffect, useState } from "react";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import ViewCompactRoundedIcon from "@mui/icons-material/ViewCompactRounded";
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import QRCode from "qrcode";
import { Link as RouterLink } from "react-router-dom";
import type {
  LibraryItem,
  LibraryKind,
  LibraryLayoutMode,
  SessionInfo
} from "../../shared/types";
import { FolderExplorer } from "../components/FolderExplorer";
import { LibraryGrid } from "../components/LibraryGrid";
import { MediaDetail } from "../components/MediaDetail";
import { UploadSurface } from "../components/UploadSurface";
import {
  createFolder,
  deleteItem,
  fetchSnapshot,
  openLibraryEvents,
  uploadFiles
} from "../lib/api";
import { formatBytes } from "../lib/format";

type FilterValue = "all" | Exclude<LibraryKind, "folder">;
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

function sortFolderContents(items: LibraryItem[]) {
  return [...items].sort((left, right) => {
    if (left.kind === "folder" && right.kind !== "folder") {
      return -1;
    }

    if (left.kind !== "folder" && right.kind === "folder") {
      return 1;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

export function AppPage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [layoutMode, setLayoutMode] = useState<LibraryLayoutMode>("intermediate");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
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
    if (!currentFolderId) {
      return;
    }

    const folderStillExists = items.some((item) => item.id === currentFolderId && item.kind === "folder");

    if (!folderStillExists) {
      setCurrentFolderId(null);
    }
  }, [items, currentFolderId]);

  const currentFolder = currentFolderId
    ? (items.find((item) => item.id === currentFolderId && item.kind === "folder") ?? null)
    : null;

  const currentFolderItems = sortFolderContents(
    items.filter((item) => item.parentId === currentFolderId)
  );

  const filteredItems = currentFolderItems.filter(
    (item) => item.kind === "folder" || filter === "all" || item.kind === filter
  );

  useEffect(() => {
    const selectableItems = filteredItems.filter((item) => item.kind !== "folder");

    if (selectableItems.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !selectableItems.some((item) => item.id === selectedId)) {
      setSelectedId(selectableItems[0].id);
    }
  }, [filteredItems, selectedId]);

  const selectedItem =
    items.find((item) => item.id === selectedId) ?? currentFolder ?? null;

  async function handleUpload(files: File[]) {
    setUploading(true);

    try {
      const response = await uploadFiles(files, currentFolderId);
      await syncSnapshot();
      setSelectedId(response.items.find((item) => item.kind !== "folder")?.id ?? null);
      setSnackbar(`${files.length} file caricati in ${currentFolder?.name ?? "radice LAN"}.`);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateFolder() {
    const trimmedName = folderName.trim();

    if (!trimmedName) {
      return;
    }

    const response = await createFolder(trimmedName, currentFolderId);
    await syncSnapshot();
    setFolderDialogOpen(false);
    setFolderName("");
    setCurrentFolderId(response.item.id);
    setSelectedId(null);
    setSnackbar(`Cartella creata: ${response.item.name}.`);
  }

  async function handleDelete(item: LibraryItem) {
    const fallbackFolderId = item.parentId ?? null;
    const response = await deleteItem(item.id);

    if (currentFolderId && response.deletedIds.includes(currentFolderId)) {
      setCurrentFolderId(fallbackFolderId);
    }

    if (selectedId && response.deletedIds.includes(selectedId)) {
      setSelectedId(null);
    }

    await syncSnapshot();
    setSnackbar(`${item.name} eliminato dalla libreria.`);
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
                <Typography color="text.secondary">
                  Hub locale con cartelle, preview documenti e media condivisi
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
                        p: { xs: 2, md: 2.25 },
                        display: "grid",
                        gap: 2,
                        alignItems: "center",
                        gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) auto" },
                        borderRadius: "24px",
                        bgcolor: alpha("#1769aa", 0.05),
                        border: `1px solid ${alpha("#1769aa", 0.08)}`
                      }}
                    >
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            URL LAN
                          </Typography>
                          <Typography variant="h5" sx={{ mt: 0.75, wordBreak: "break-word" }}>
                            {session.lanUrl}
                          </Typography>
                        </Box>

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
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
                            startIcon={<LanRoundedIcon />}
                            onClick={() => {
                              void copyText(session.hostName);
                            }}
                          >
                            Copia host
                          </Button>
                        </Stack>
                      </Stack>

                      {qrCodeDataUrl ? (
                        <Box
                          sx={{
                            p: 1.25,
                            justifySelf: { xs: "flex-start", sm: "end" },
                            borderRadius: "20px",
                            bgcolor: "background.paper",
                            border: `1px solid ${alpha("#1769aa", 0.1)}`
                          }}
                        >
                          <Box
                            component="img"
                            src={qrCodeDataUrl}
                            alt="QR code URL LAN"
                            sx={{ width: { xs: 132, sm: 148 }, height: { xs: 132, sm: 148 }, display: "block" }}
                          />
                        </Box>
                      ) : null}
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
                              <Typography color="text.secondary">elementi e cartelle</Typography>
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
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Stack spacing={2.5}>
              <UploadSurface
                onUpload={handleUpload}
                targetLabel={currentFolder?.name ?? "Radice LAN"}
                uploading={uploading}
              />
              <Alert severity={liveState === "fallback" ? "warning" : "info"} sx={{ borderRadius: 4 }}>
                {liveState === "fallback"
                  ? "SSE non disponibile: Routeroom aggiorna la libreria con polling lento."
                  : "Nuove cartelle, upload ed eliminazioni si propagano in LAN senza refresh."}
              </Alert>
            </Stack>
          </Box>

          <Card id="libreria">
            <CardContent sx={{ pb: 0 }}>
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: "column", lg: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "flex-start", lg: "center" }}
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="h5">Libreria locale</Typography>
                    <Typography color="text.secondary">
                      Esplora le cartelle come in una vista a colonne, scegli il layout delle card e apri subito le preview di testo, PDF e Word.
                    </Typography>
                  </Box>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} flexWrap="wrap" useFlexGap>
                    <Button
                      variant="outlined"
                      startIcon={<CreateNewFolderRoundedIcon />}
                      onClick={() => {
                        setFolderDialogOpen(true);
                      }}
                    >
                      Nuova cartella
                    </Button>
                  </Stack>
                </Stack>

                <FolderExplorer
                  currentFolderId={currentFolderId}
                  items={items}
                  selectedId={selectedId}
                  onOpenFolder={setCurrentFolderId}
                  onSelectItem={setSelectedId}
                />

                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) auto" },
                    alignItems: "center"
                  }}
                >
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

                  <ToggleButtonGroup
                    exclusive
                    color="primary"
                    size="small"
                    value={layoutMode}
                    onChange={(_event, value: LibraryLayoutMode | null) => {
                      if (value) {
                        setLayoutMode(value);
                      }
                    }}
                  >
                    <ToggleButton value="compact">
                      <ViewCompactRoundedIcon sx={{ mr: 0.75 }} />
                      Compatto
                    </ToggleButton>
                    <ToggleButton value="intermediate">
                      <GridViewRoundedIcon sx={{ mr: 0.75 }} />
                      Intermedio
                    </ToggleButton>
                    <ToggleButton value="descriptive">
                      <ArticleRoundedIcon sx={{ mr: 0.75 }} />
                      Descrittivo
                    </ToggleButton>
                  </ToggleButtonGroup>
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
                <LibraryGrid
                  items={filteredItems}
                  layoutMode={layoutMode}
                  selectedId={selectedId}
                  onDelete={(item) => {
                    void handleDelete(item);
                  }}
                  onOpenFolder={setCurrentFolderId}
                  onSelect={setSelectedId}
                />
                <MediaDetail item={selectedItem} onCopyLink={copyText} />
              </Box>
            </CardContent>
          </Card>
        </Stack>
      </Container>

      <Dialog
        open={folderDialogOpen}
        onClose={() => {
          setFolderDialogOpen(false);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Nuova cartella</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary" variant="body2">
              La cartella verra creata in {currentFolder?.name ?? "Radice LAN"}.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              label="Nome cartella"
              value={folderName}
              onChange={(event) => {
                setFolderName(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreateFolder();
                }
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setFolderDialogOpen(false);
            }}
          >
            Annulla
          </Button>
          <Button variant="contained" onClick={() => void handleCreateFolder()}>
            Crea
          </Button>
        </DialogActions>
      </Dialog>

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
