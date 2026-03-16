import { startTransition, useEffect, useRef, useState } from "react";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import {
  Box,
  Button,
  Container,
  Snackbar,
  Stack,
  useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useSearchParams } from "react-router-dom";
import type { ArchiveFormat, LibraryItem, LibraryLayoutMode, SessionInfo } from "../../shared/types";
import { FolderExplorer } from "../components/FolderExplorer";
import { LibraryItemsDataGrid } from "../components/LibraryItemsDataGrid";
import { LibraryGrid } from "../components/LibraryGrid";
import { LibraryTreePanel } from "../components/LibraryTreePanel";
import { MediaDetail } from "../components/MediaDetail";
import { PageHeader } from "../components/PageHeader";
import { QrCodeDialog } from "../components/QrCodeDialog";
import { UploadSurface } from "../components/UploadSurface";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionHeader } from "../components/ui/SectionHeader";
import { SurfaceCard } from "../components/ui/SurfaceCard";
import { CreateFolderDialog } from "../features/library/CreateFolderDialog";
import { type FilterValue } from "../features/library/constants";
import { HostSessionCard } from "../features/library/HostSessionCard";
import { LibraryFilters } from "../features/library/LibraryFilters";
import { buildFolderPath, sortFolderContents } from "../features/library/utils";
import {
  createArchive,
  createFolder,
  deleteItem,
  fetchSnapshot,
  uploadFiles
} from "../lib/api";
import { copyTextToClipboard } from "../lib/clipboard";
import { buildLibraryPreviewShareUrl, buildVideoPlayerShareUrl } from "../lib/share-links";
import { useLanLiveState } from "../lib/useLanLiveState";
import { useQrCodeDataUrl } from "../lib/useQrCodeDataUrl";

export function AppPage() {
  const [searchParams] = useSearchParams();
  const initialLinkedItemId = searchParams.get("item");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialLinkedItemId);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [hostQrDialogOpen, setHostQrDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [qrItemTarget, setQrItemTarget] = useState<{ item: LibraryItem; url: string } | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const layoutMode: LibraryLayoutMode = isMobile ? "minimal" : "compact";
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const appliedDeepLinkRef = useRef<string | null>(null);
  const hostQrCodeDataUrl = useQrCodeDataUrl(session?.lanUrl ?? null, { width: 192 });
  const qrItemDataUrl = useQrCodeDataUrl(qrItemTarget?.url ?? null, { width: 256 });

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
              onOpenQrCode={() => {
                setHostQrDialogOpen(true);
              }}
              qrCodeDataUrl={hostQrCodeDataUrl}
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

          <SurfaceCard id="libreria">
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={2.5}>
                <SectionHeader
                  eyebrow="Library"
                  title="Libreria locale"
                  description="Esplora la gerarchia cartelle, filtra i contenuti e apri subito il pannello di dettaglio."
                  actions={
                    <Button
                      fullWidth={isMobile}
                      variant="outlined"
                      startIcon={<CreateNewFolderRoundedIcon />}
                      onClick={() => {
                        setFolderDialogOpen(true);
                      }}
                    >
                      Nuova cartella
                    </Button>
                  }
                />

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant={currentFolderId === null ? "contained" : folderPath.length > 0 ? "outlined" : "text"}
                    onClick={() => {
                      setCurrentFolderId(null);
                    }}
                  >
                    Radice
                  </Button>
                  {folderPath.map((folder) => (
                    <Button
                      key={folder.id}
                      variant={folder.id === currentFolderId ? "contained" : "outlined"}
                      onClick={() => {
                        setCurrentFolderId(folder.id);
                      }}
                    >
                      {folder.name}
                    </Button>
                  ))}
                </Stack>

                {isMobile ? (
                  <>
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

                    <LibraryFilters value={filter} onChange={setFilter} />

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
                  </>
                ) : (
                  <>
                    <LibraryFilters value={filter} onChange={setFilter} />

                    <Box
                      sx={{
                        display: "grid",
                        gap: 2.5,
                        alignItems: "start",
                        gridTemplateColumns: {
                          md: "minmax(250px, 0.3fr) minmax(0, 0.7fr)",
                          xl: "280px minmax(0, 0.78fr) minmax(380px, 0.52fr)"
                        },
                        "& > *": {
                          minWidth: 0
                        }
                      }}
                    >
                      <LibraryTreePanel
                        currentFolderId={currentFolderId}
                        items={items}
                        onOpenFolder={setCurrentFolderId}
                      />

                      <LibraryItemsDataGrid
                        availableArchiveFormats={availableArchiveFormats}
                        items={filteredItems}
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

                      <Box
                        ref={detailPanelRef}
                        sx={{
                          display: { md: "none", xl: "block" }
                        }}
                      >
                        <MediaDetail item={selectedItem} onCopyLink={copyText} />
                      </Box>
                    </Box>

                    <Box sx={{ display: { md: "block", xl: "none" } }} ref={detailPanelRef}>
                      {selectedItem ? (
                        <MediaDetail item={selectedItem} onCopyLink={copyText} />
                      ) : (
                        <SurfaceCard tone="sunken">
                          <EmptyState
                            title="Seleziona un contenuto"
                            description="Il pannello dettaglio compare qui sotto la griglia quando scegli un file o una cartella."
                          />
                        </SurfaceCard>
                      )}
                    </Box>
                  </>
                )}
              </Stack>
            </Box>
          </SurfaceCard>
        </Stack>
      </Container>

      <QrCodeDialog
        open={hostQrDialogOpen}
        onClose={() => {
          setHostQrDialogOpen(false);
        }}
        title="QR code URL LAN"
        description="Inquadra questo codice dalla stessa LAN per aprire subito Routy sul device."
        qrCodeAlt="QR code URL LAN"
        qrCodeDataUrl={hostQrCodeDataUrl}
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
        open={Boolean(qrItemTarget)}
        onClose={() => {
          setQrItemTarget(null);
        }}
        title={qrItemTarget?.item.kind === "video" ? "QR code player video" : "QR code anteprima"}
        description={
          qrItemTarget?.item.kind === "video"
            ? "Inquadra questo codice dalla stessa LAN per aprire subito il player del video."
            : "Inquadra questo codice dalla stessa LAN per aprire direttamente l'anteprima del file."
        }
        qrCodeAlt={`QR code ${qrItemTarget?.item.name ?? "contenuto condiviso"}`}
        qrCodeDataUrl={qrItemDataUrl}
        subject={qrItemTarget?.item.name}
        url={qrItemTarget?.url}
        onCopy={
          qrItemTarget
            ? () => {
                void copyText(qrItemTarget.url);
              }
            : undefined
        }
        actionHref={qrItemTarget?.url}
        actionLabel={qrItemTarget ? (qrItemTarget.item.kind === "video" ? "Apri player" : "Apri anteprima") : undefined}
        actionIcon={qrItemTarget?.item.kind === "video" ? <QrCode2RoundedIcon /> : <OpenInNewRoundedIcon />}
        onAction={() => {
          setQrItemTarget(null);
        }}
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
        onClose={() => {
          setSnackbar(null);
        }}
        message={snackbar}
      />
    </Box>
  );
}
