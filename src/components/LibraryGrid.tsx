import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import AudiotrackRoundedIcon from "@mui/icons-material/AudiotrackRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Stack,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { ArchiveFormat, LibraryItem, LibraryLayoutMode } from "../../shared/types";
import { formatBytes, formatDate } from "../lib/format";
import { getItemKindAccent } from "../lib/item-kind-accent";
import { ItemActionsMenu } from "./ItemActionsMenu";

interface LibraryGridProps {
  availableArchiveFormats: ArchiveFormat[];
  items: LibraryItem[];
  layoutMode: LibraryLayoutMode;
  selectedId: string | null;
  onCreateArchive: (item: LibraryItem, format: ArchiveFormat) => void | Promise<void>;
  onDelete: (item: LibraryItem) => void;
  onDownload: (item: LibraryItem, format?: ArchiveFormat) => void;
  onOpenFolder: (folderId: string) => void;
  onSelect: (itemId: string) => void;
  onShowQrCode: (item: LibraryItem) => void | Promise<void>;
}

const kindConfig = {
  folder: { label: "Cartella", icon: FolderRoundedIcon },
  video: { label: "Video", icon: MovieRoundedIcon },
  image: { label: "Immagine", icon: ImageRoundedIcon },
  audio: { label: "Audio", icon: AudiotrackRoundedIcon },
  document: { label: "Documento", icon: DescriptionRoundedIcon },
  archive: { label: "Archivio", icon: ArchiveRoundedIcon },
  other: { label: "Altro", icon: MoreHorizRoundedIcon }
} as const;

function sortVisibleItems(items: LibraryItem[]) {
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

function getGridTemplate(layoutMode: LibraryLayoutMode) {
  if (layoutMode === "minimal") {
    return {
      xs: "1fr"
    };
  }

  return {
    xs: "repeat(2, minmax(0, 1fr))",
    md: "repeat(3, minmax(0, 1fr))"
  };
}

function getPreviewHeight(layoutMode: LibraryLayoutMode) {
  if (layoutMode === "compact") {
    return 112;
  }

  return 172;
}

export function LibraryGrid({
  availableArchiveFormats,
  items,
  layoutMode,
  selectedId,
  onCreateArchive,
  onDelete,
  onDownload,
  onOpenFolder,
  onSelect,
  onShowQrCode
}: LibraryGridProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  if (items.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ py: 7, textAlign: "center" }}>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Questa cartella e vuota
          </Typography>
          <Typography color="text.secondary">
            Crea una cartella o carica il primo contenuto per riempire l’esploratore LAN.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const previewHeight = getPreviewHeight(layoutMode);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: getGridTemplate(layoutMode),
        gap: 2,
        "& > *": {
          minWidth: 0
        }
      }}
    >
      {sortVisibleItems(items).map((item) => {
        const config = kindConfig[item.kind];
        const accent = getItemKindAccent(theme, item.kind);
        const Icon = config.icon;
        const isSelected = item.id === selectedId;
        const isFolder = item.kind === "folder";

        if (layoutMode === "minimal") {
          return (
            <Card
              key={item.id}
              elevation={0}
              sx={{
                position: "relative",
                overflow: "hidden",
                width: "100%",
                minWidth: 0,
                borderColor: isSelected ? alpha(accent, isDark ? 0.46 : 0.36) : alpha(theme.palette.text.primary, isDark ? 0.16 : 0.08),
                boxShadow: isSelected
                  ? `0 12px 28px ${alpha(accent, isDark ? 0.22 : 0.14)}`
                  : isDark
                    ? "0 10px 28px rgba(0, 0, 0, 0.24)"
                    : "0 8px 22px rgba(16, 39, 58, 0.04)"
              }}
            >
              <ItemActionsMenu
                availableArchiveFormats={availableArchiveFormats}
                item={item}
                onCreateArchive={onCreateArchive}
                onDelete={onDelete}
                onDownload={onDownload}
                onShowQrCode={onShowQrCode}
                triggerSx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  zIndex: 2,
                  bgcolor: alpha(theme.palette.background.paper, isDark ? 0.9 : 0.92)
                }}
              />

              <CardActionArea
                onClick={() => {
                  if (isFolder) {
                    onOpenFolder(item.id);
                    return;
                  }

                  onSelect(item.id);
                }}
                sx={{ width: "100%", minWidth: 0 }}
              >
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{ px: 2, py: 1.5, pr: 6, width: "100%", minWidth: 0 }}
                >
                  <Avatar
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: alpha(accent, 0.12),
                      color: accent
                    }}
                  >
                    <Icon fontSize="small" />
                  </Avatar>
                  <Stack spacing={0.2} sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap fontWeight={600}>
                      {item.name}
                    </Typography>
                    <Typography noWrap variant="body2" color="text.secondary">
                      {isFolder
                        ? `${item.childrenCount ?? 0} elementi`
                        : formatBytes(item.sizeBytes)}
                    </Typography>
                  </Stack>
                </Stack>
              </CardActionArea>
            </Card>
          );
        }

        return (
          <Card
            key={item.id}
            elevation={0}
            sx={{
              position: "relative",
              overflow: "hidden",
              borderColor: isSelected ? alpha(accent, isDark ? 0.46 : 0.36) : alpha(theme.palette.text.primary, isDark ? 0.16 : 0.08),
              boxShadow: isSelected
                ? `0 16px 36px ${alpha(accent, isDark ? 0.24 : 0.16)}`
                : isDark
                  ? "0 12px 32px rgba(0, 0, 0, 0.26)"
                  : "0 10px 28px rgba(16, 39, 58, 0.05)"
            }}
          >
            <ItemActionsMenu
              availableArchiveFormats={availableArchiveFormats}
              item={item}
              onCreateArchive={onCreateArchive}
              onDelete={onDelete}
              onDownload={onDownload}
              onShowQrCode={onShowQrCode}
              triggerSx={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 2,
                bgcolor: alpha(theme.palette.background.paper, isDark ? 0.9 : 0.92)
              }}
            />

            <CardActionArea
              onClick={() => {
                if (isFolder) {
                  onOpenFolder(item.id);
                  return;
                }

                onSelect(item.id);
              }}
              sx={{ height: "100%", alignItems: "stretch" }}
            >
              {item.kind === "image" ? (
                <CardMedia
                  component="img"
                  src={item.contentUrl ?? item.downloadUrl}
                  alt={item.name}
                  sx={{
                    height: layoutMode === "compact" ? previewHeight : 188,
                    objectFit: "cover"
                  }}
                />
              ) : (
                <Box
                  sx={{
                    height: layoutMode === "compact" ? previewHeight : 188,
                    px: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: alpha(accent, 0.08)
                  }}
                >
                  <Stack spacing={1} alignItems="center">
                    <Avatar
                      sx={{
                        width: layoutMode === "compact" ? 48 : 60,
                        height: layoutMode === "compact" ? 48 : 60,
                        bgcolor: alpha(accent, 0.14),
                        color: accent
                      }}
                    >
                      <Icon />
                    </Avatar>
                  </Stack>
                </Box>
              )}

              <CardContent>
                <Stack spacing={0.75}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      pr: 4.5,
                      minHeight: "2.7em",
                      lineHeight: 1.35,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                      wordBreak: "break-word"
                    }}
                  >
                    {item.name}
                  </Typography>

                  <Typography color="text.secondary" variant="body2">
                    {isFolder
                      ? `${config.label} · ${item.childrenCount ?? 0} elementi`
                      : `${config.label} · ${formatBytes(item.sizeBytes)}`}
                  </Typography>

                  <Typography color="text.secondary" variant="body2">
                    {formatDate(item.createdAt)}
                  </Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
}
