import { startTransition, useEffect, useRef, useState } from "react";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useSearchParams } from "react-router-dom";
import type { ArchiveFormat, LibraryItem, LibraryLayoutMode, SessionInfo } from "../../shared/types";
import { FolderExplorer } from "../components/FolderExplorer";
import { LibraryGrid } from "../components/LibraryGrid";
import { MediaDetail } from "../components/MediaDetail";
import { PageHeader } from "../components/PageHeader";
import { QrCodeDialog } from "../components/QrCodeDialog";
import { UploadSurface } from "../components/UploadSurface";
import { CreateFolderDialog } from "../features/library/CreateFolderDialog";
import { type FilterValue } from "../features/library/constants";
import { HostSessionCard } from "../features/library/HostSessionCard";
import { LibraryFilters } from "../features/library/LibraryFilters";
import { buildFolderPath, sortFolderContents } from "../features/library/utils";
import {
  createArchive,
  createFolder,
  deleteItem,
  fetchSnapshot
} from "../lib/api";
import { copyTextToClipboard } from "../lib/clipboard";
import { buildLibraryPreviewShareUrl, buildVideoPlayerShareUrl } from "../lib/share-links";
import { useLanLiveState } from "../lib/useLanLiveState";
import { useQrDialog } from "../lib/useQrDialog";

interface AppPageProps {
  lastUploadSettledAt: number;
  lastUploadedItemId: string | null;
  onStartUpload: (files: File[], parentId?: string | null, targetLabel?: string) => Promise<void>;
  uploading: boolean;
}

export function AppPage({
  lastUploadSettledAt,
  lastUploadedItemId,
  onStartUpload,
  uploading
}: AppPageProps) {
  const [searchParams] = useSearchParams();
  const initialLinkedItemId = searchParams.get("item");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialLinkedItemId);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [qrItemTarget, setQrItemTarget] = useState<{ item: LibraryItem; url: string } | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const layoutMode: LibraryLayoutMode = isMobile ? "minimal" : "compact";
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const appliedDeepLinkRef = useRef<string | null>(null);
  const handledUploadSettlementRef = useRef(lastUploadSettledAt);
  const hostQrDialog = useQrDialog(session?.lanUrl ?? null, { width: 192 });
  const itemQrUrl = qrItemTarget?.url ?? null;
  const itemQrDialog = useQrDialog(itemQrUrl, { width: 256 });

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

  const liveState = useLanLiveState({
    source: "library",
    onEvent: () => {
      void syncSnapshot();
    },
    onFallback: () => {
      const pollingId = window.setInterval(() => {
        void syncSnapshot();
      }, 15000);

      return () => {
        window.clearInterval(pollingId);
      };
    }
  });

  useEffect(() => {
    void syncSnapshot();
  }, []);

  useEffect(() => {
    if (lastUploadSettledAt === 0 || handledUploadSettlementRef.current === lastUploadSettledAt) {
      return;
    }

    handledUploadSettlementRef.current = lastUploadSettledAt;

    void syncSnapshot().then(() => {
      if (lastUploadedItemId) {
        setSelectedId(lastUploadedItemId);
      }
    });
  }, [lastUploadedItemId, lastUploadSettledAt]);

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

  useEffect(() => {
    if (!isMobile || filter === "all") {
      return;
    }

    setFilter("all");
  }, [filter, isMobile]);

  const currentFolder = currentFolderId
    ? (items.find((item) => item.id === currentFolderId && item.kind === "folder") ?? null)
    : null;
  const folderPath = buildFolderPath(items, currentFolderId);
  const itemQrHref = itemQrUrl ?? undefined;

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
    await onStartUpload(files, currentFolderId, currentFolder?.name ?? "Radice LAN");
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
      await copyTextToClipboard(value);
      setSnackbar(successMessage);
    } catch {
      setSnackbar("Copia non disponibile su questo browser.");
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
          ? buildVideoPlayerShareUrl(session.lanUrl, item.id)
          : buildLibraryPreviewShareUrl(session.lanUrl, item.id)
    });
    itemQrDialog.openDialog();
  }

  function handleCloseItemQrDialog() {
    itemQrDialog.closeDialog();
    setQrItemTarget(null);
  }

  return (
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Routy" subtitle="media relay locale" networkState={liveState} />

        <Stack spacing={3} sx={{ mt: 3 }}>
          <Box
            sx={{
              display: "grid",
              gap: 2.5,
              alignItems: "start",
              gridTemplateColumns: { xs: "1fr", xl: "0.84fr 1.16fr" }
            }}
          >
            <HostSessionCard
              isMobile={isMobile}
              loading={loading}
              onOpenQrCode={hostQrDialog.openDialog}
              qrCodeDataUrl={hostQrDialog.qrCodeDataUrl}
              session={session}
            />

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

                {!isMobile ? (
                  <LibraryFilters value={filter} onChange={setFilter} />
                ) : null}
              </Stack>
            </CardContent>

            <Divider sx={{ mt: 2.5 }} />

            <CardContent>
              <Box
                sx={{
                  display: "grid",
                  gap: 2.5,
                  alignItems: "start",
                  gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 0.92fr) minmax(0, 1.08fr)" },
                  "& > *": {
                    minWidth: 0
                  }
                }}
              >
                {!isMobile ? (
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
                ) : null}
                <Box ref={detailPanelRef}>
                  <MediaDetail item={selectedItem} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      </Container>

      <QrCodeDialog
        {...hostQrDialog.dialogProps}
        title="QR code URL LAN"
        description="Inquadra questo codice dalla stessa LAN per aprire subito Routy sul device."
        qrCodeAlt="QR code URL LAN"
        url={session?.lanUrl}
        copyLabel="Copia URL"
        onCopy={
          session
            ? () => {
                void copyText(session.lanUrl, "URL LAN copiato negli appunti.");
              }
            : undefined
        }
      />

      <QrCodeDialog
        {...itemQrDialog.dialogProps}
        onClose={handleCloseItemQrDialog}
        title={qrItemTarget?.item.kind === "video" ? "QR code player video" : "QR code anteprima"}
        description={
          qrItemTarget?.item.kind === "video"
            ? "Inquadra questo codice dalla stessa LAN per aprire subito il player del video."
            : "Inquadra questo codice dalla stessa LAN per aprire direttamente l'anteprima del file."
        }
        qrCodeAlt={`QR code ${qrItemTarget?.item.name ?? "contenuto condiviso"}`}
        subject={qrItemTarget?.item.name}
        url={itemQrHref}
        onCopy={
          qrItemTarget
            ? () => {
                void copyText(qrItemTarget.url);
              }
            : undefined
        }
        actionHref={itemQrHref}
        actionLabel={
          qrItemTarget ? (qrItemTarget.item.kind === "video" ? "Apri player" : "Apri anteprima") : undefined
        }
        actionIcon={qrItemTarget?.item.kind === "video" ? <QrCode2RoundedIcon /> : <OpenInNewRoundedIcon />}
        onAction={handleCloseItemQrDialog}
      />

      <CreateFolderDialog
        open={folderDialogOpen}
        currentFolderName={currentFolder?.name ?? "Radice LAN"}
        folderName={folderName}
        onClose={() => {
          setFolderDialogOpen(false);
        }}
        onFolderNameChange={setFolderName}
        onSubmit={() => {
          void handleCreateFolder();
        }}
      />

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={2600}
        anchorOrigin={{ vertical: isMobile ? "top" : "bottom", horizontal: "center" }}
        onClose={() => {
          setSnackbar(null);
        }}
        message={snackbar}
      />
    </Box>
  );
}
