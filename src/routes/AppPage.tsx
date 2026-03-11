import { startTransition, useEffect, useRef, useState } from "react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  CardHeader,
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
  Typography,
  useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import QRCode from "qrcode";
import { useSearchParams } from "react-router-dom";
import type {
  ArchiveFormat,
  LibraryItem,
  LibraryKind,
  LibraryLayoutMode,
  SessionInfo
} from "../../shared/types";
import { FolderExplorer } from "../components/FolderExplorer";
import { LibraryGrid } from "../components/LibraryGrid";
import { MediaDetail } from "../components/MediaDetail";
import { PageHeader } from "../components/PageHeader";
import { UploadSurface } from "../components/UploadSurface";
import {
  createArchive,
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

function buildFolderPath(items: LibraryItem[], currentFolderId: string | null) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const path: LibraryItem[] = [];
  let cursor = currentFolderId ? byId.get(currentFolderId) : undefined;

  while (cursor && cursor.kind === "folder") {
    path.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  return path;
}

function buildPreviewShareUrl(lanUrl: string, itemId: string) {
  const browserUrl = new URL(window.location.href);
  const sessionUrl = new URL(lanUrl);
  const shareUrl = new URL(browserUrl.href);

  if (browserUrl.hostname === "localhost" || browserUrl.hostname === "127.0.0.1") {
    shareUrl.protocol = sessionUrl.protocol;
    shareUrl.hostname = sessionUrl.hostname;
  }

  shareUrl.pathname = "/app";
  shareUrl.search = "";
  shareUrl.searchParams.set("item", itemId);
  shareUrl.hash = "";

  return shareUrl.toString();
}

function buildVideoPlayerUrl(lanUrl: string, itemId: string) {
  const browserUrl = new URL(window.location.href);
  const sessionUrl = new URL(lanUrl);
  const shareUrl = new URL(browserUrl.href);

  if (browserUrl.hostname === "localhost" || browserUrl.hostname === "127.0.0.1") {
    shareUrl.protocol = sessionUrl.protocol;
    shareUrl.hostname = sessionUrl.hostname;
  }

  shareUrl.pathname = `/player/${itemId}`;
  shareUrl.search = "";
  shareUrl.hash = "";

  return shareUrl.toString();
}

function formatLibraryCount(count: number) {
  return `${count} ${count === 1 ? "elemento" : "elementi"}`;
}

function fallbackCopyText(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = typeof document.execCommand === "function" && document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("Clipboard fallback unavailable");
  }
}

function splitLanUrl(value: string) {
  try {
    const parsed = new URL(value);
    return {
      protocol: `${parsed.protocol}//`,
      remainder: `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`
    };
  } catch {
    return {
      protocol: "",
      remainder: value
    };
  }
}

export function AppPage() {
  const [searchParams] = useSearchParams();
  const initialLinkedItemId = searchParams.get("item");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialLinkedItemId);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [liveState, setLiveState] = useState<LiveState>("connecting");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [qrItemTarget, setQrItemTarget] = useState<{ item: LibraryItem; url: string } | null>(null);
  const [qrItemDataUrl, setQrItemDataUrl] = useState("");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const layoutMode: LibraryLayoutMode = isMobile ? "minimal" : "compact";
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const appliedDeepLinkRef = useRef<string | null>(null);
  const lanUrlParts = session ? splitLanUrl(session.lanUrl) : null;

  function applyLinkedSelection(nextItems: LibraryItem[]) {
    const linkedItemId = searchParams.get("item");

    if (!linkedItemId) {
      appliedDeepLinkRef.current = null;
      return;
    }

    const linkedItem = nextItems.find((item) => item.id === linkedItemId && item.kind !== "folder");

    if (!linkedItem) {
      return;
    }

    setFilter("all");
    setCurrentFolderId(linkedItem.parentId ?? null);
    setSelectedId(linkedItem.id);

    if (appliedDeepLinkRef.current === linkedItemId) {
      return;
    }

    appliedDeepLinkRef.current = linkedItemId;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  async function syncSnapshot() {
    const snapshot = await fetchSnapshot();

    startTransition(() => {
      setSession(snapshot.session);
      setItems(snapshot.items);
      setLoading(false);
      applyLinkedSelection(snapshot.items);
    });
  }

  useEffect(() => {
    void syncSnapshot();
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
    if (!qrItemTarget) {
      setQrItemDataUrl("");
      return;
    }

    void QRCode.toDataURL(qrItemTarget.url, {
      margin: 1,
      width: 256,
      color: {
        dark: "#10273a",
        light: "#0000"
      }
    }).then(setQrItemDataUrl);
  }, [qrItemTarget]);

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

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    applyLinkedSelection(items);
  }, [items, searchParams]);

  const currentFolder = currentFolderId
    ? (items.find((item) => item.id === currentFolderId && item.kind === "folder") ?? null)
    : null;
  const folderPath = buildFolderPath(items, currentFolderId);

  const currentFolderItems = sortFolderContents(
    items.filter((item) => item.parentId === currentFolderId)
  );
  const availableArchiveFormats = session?.availableArchiveFormats ?? [];
  const explorerVisibleItems = sortFolderContents([
    ...items.filter((item) => item.parentId === null),
    ...folderPath.flatMap((folder) => items.filter((item) => item.parentId === folder.id))
  ]);

  const filteredItems = currentFolderItems.filter(
    (item) => filter === "all" || item.kind === filter
  );

  useEffect(() => {
    const selectableItems = explorerVisibleItems.filter((item) => item.kind !== "folder");

    if (selectableItems.length === 0) {
      setSelectedId(null);
      return;
    }

    if (selectedId && selectableItems.some((item) => item.id === selectedId)) {
      return;
    }

    const preferredCurrentItem = filteredItems.find((item) => item.kind !== "folder");
    setSelectedId(preferredCurrentItem?.id ?? selectableItems[0].id);
  }, [explorerVisibleItems, filteredItems, selectedId]);

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

  async function handleCreateArchive(item: LibraryItem, format: ArchiveFormat) {
    if (item.kind !== "folder") {
      return;
    }

    const response = await createArchive(item.id, format);
    await syncSnapshot();
    setSelectedId(response.item.id);
    setSnackbar(`Archivio creato: ${response.item.name}.`);
  }

  function handleDownload(item: LibraryItem, format?: ArchiveFormat) {
    const downloadUrl =
      item.kind === "folder"
        ? format
          ? `/api/items/${item.id}/download?format=${encodeURIComponent(format)}`
          : null
        : item.downloadUrl ?? null;

    if (!downloadUrl) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.rel = "noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setSnackbar(
      item.kind === "folder"
        ? `Scaricamento cartella avviato: ${item.name}.`
        : `Scaricamento file avviato: ${item.name}.`
    );
  }

  async function copyText(value: string, successMessage = "Link copiato negli appunti.") {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        fallbackCopyText(value);
      }

      setSnackbar(successMessage);
    } catch {
      try {
        fallbackCopyText(value);
        setSnackbar(successMessage);
      } catch {
        setSnackbar("Copia non disponibile su questo browser.");
      }
    }
  }

  function handleShowQrCode(item: LibraryItem) {
    if (!session?.lanUrl) {
      setSnackbar("URL LAN non ancora disponibile.");
      return;
    }

    setQrItemTarget({
      item,
      url:
        item.kind === "video"
          ? buildVideoPlayerUrl(session.lanUrl, item.id)
          : buildPreviewShareUrl(session.lanUrl, item.id)
    });
  }

  return (
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader
          title="Routeroom"
          subtitle="LAN media relay"
          trailingLinkTo="/diagnostics"
          trailing={
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor:
                  liveState === "live" ? alpha(theme.palette.secondary.main, 0.18) : alpha("#10273a", 0.08),
                color: liveState === "live" ? "secondary.main" : "text.secondary"
              }}
            >
              {liveState === "live" ? <WifiRoundedIcon /> : <AutorenewRoundedIcon />}
            </Avatar>
          }
        />

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
                          <Typography variant="h6" sx={{ mt: 0.75, wordBreak: "break-word" }}>
                            {session.lanUrl}
                          </Typography>
                        </Box>
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
                        gap: 1.5
                      }}
                    >
                      <Card variant="outlined">
                        <CardContent sx={{ p: 2.25 }}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={2}
                            alignItems={{ xs: "flex-start", sm: "center" }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="h6"
                                sx={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  alignItems: "baseline",
                                  gap: 1
                                }}
                              >
                                <Box component="span">{formatBytes(session.totalBytes)} in {formatLibraryCount(session.itemCount)}</Box>
                              </Typography>
                              <Typography
                                color="text.secondary"
                                variant="body2"
                                sx={{ mt: 1, wordBreak: "break-word" }}
                              >
                                {session.storagePath}
                              </Typography>
                            </Box>
                          </Stack>
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
                  availableArchiveFormats={availableArchiveFormats}
                  currentFolderId={currentFolderId}
                  items={items}
                  selectedId={selectedId}
                  onCreateArchive={(item, format) => {
                    void handleCreateArchive(item, format);
                  }}
                  onDeleteItem={(item) => {
                    void handleDelete(item);
                  }}
                  onDownloadItem={handleDownload}
                  onOpenFolder={setCurrentFolderId}
                  onSelectItem={setSelectedId}
                  onShowQrCode={handleShowQrCode}
                />

                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: "1fr",
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
                  availableArchiveFormats={availableArchiveFormats}
                  items={filteredItems}
                  layoutMode={layoutMode}
                  selectedId={selectedId}
                  onCreateArchive={(item, format) => {
                    void handleCreateArchive(item, format);
                  }}
                  onDelete={(item) => {
                    void handleDelete(item);
                  }}
                  onDownload={handleDownload}
                  onOpenFolder={setCurrentFolderId}
                  onSelect={setSelectedId}
                  onShowQrCode={handleShowQrCode}
                />
                <Box ref={detailPanelRef}>
                  <MediaDetail item={selectedItem} onCopyLink={copyText} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      </Container>

      <Dialog
        open={Boolean(qrItemTarget)}
        onClose={() => {
          setQrItemTarget(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {qrItemTarget?.item.kind === "video" ? "QR code player video" : "QR code anteprima"}
        </DialogTitle>
        <DialogContent>
          {qrItemTarget ? (
            <Stack spacing={2} sx={{ pt: 1, alignItems: "center" }}>
              <Typography color="text.secondary" variant="body2" sx={{ alignSelf: "stretch" }}>
                {qrItemTarget.item.kind === "video"
                  ? "Inquadra questo codice dalla stessa LAN per aprire subito il player del video."
                  : "Inquadra questo codice dalla stessa LAN per aprire direttamente l’anteprima del file."}
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  border: `1px solid ${alpha("#1769aa", 0.1)}`
                }}
              >
                {qrItemDataUrl ? (
                  <Box
                    component="img"
                    src={qrItemDataUrl}
                    alt={`QR code ${qrItemTarget.item.name}`}
                    sx={{ width: 224, height: 224, display: "block" }}
                  />
                ) : null}
              </Box>
              <Typography variant="subtitle1" sx={{ alignSelf: "stretch", wordBreak: "break-word" }}>
                {qrItemTarget.item.name}
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ alignSelf: "stretch", wordBreak: "break-word" }}>
                {qrItemTarget.url}
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setQrItemTarget(null);
            }}
          >
            Chiudi
          </Button>
          <Button
            startIcon={<ContentCopyRoundedIcon />}
            onClick={() => {
              if (qrItemTarget) {
                void copyText(qrItemTarget.url);
              }
            }}
          >
            Copia link
          </Button>
          {qrItemTarget ? (
            <Button
              component="a"
              href={qrItemTarget.url}
              variant="contained"
              startIcon={qrItemTarget.item.kind === "video" ? <QrCode2RoundedIcon /> : <OpenInNewRoundedIcon />}
              onClick={() => {
                setQrItemTarget(null);
              }}
            >
              {qrItemTarget.item.kind === "video" ? "Apri player" : "Apri anteprima"}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

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
