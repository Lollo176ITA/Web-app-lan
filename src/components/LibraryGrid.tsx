import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import AudiotrackRoundedIcon from "@mui/icons-material/AudiotrackRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
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
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { LibraryItem, LibraryLayoutMode } from "../../shared/types";
import { formatBytes, formatDate } from "../lib/format";

interface LibraryGridProps {
  items: LibraryItem[];
  layoutMode: LibraryLayoutMode;
  selectedId: string | null;
  onDelete: (item: LibraryItem) => void;
  onOpenFolder: (folderId: string) => void;
  onSelect: (itemId: string) => void;
}

const kindConfig = {
  folder: { label: "Cartella", icon: FolderRoundedIcon, accent: "#1769aa" },
  video: { label: "Video", icon: MovieRoundedIcon, accent: "#1769aa" },
  image: { label: "Immagine", icon: ImageRoundedIcon, accent: "#0f9d94" },
  audio: { label: "Audio", icon: AudiotrackRoundedIcon, accent: "#4553c7" },
  document: { label: "Documento", icon: DescriptionRoundedIcon, accent: "#c47917" },
  archive: { label: "Archivio", icon: ArchiveRoundedIcon, accent: "#8b4fcf" },
  other: { label: "Altro", icon: MoreHorizRoundedIcon, accent: "#5a7184" }
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
  switch (layoutMode) {
    case "compact":
      return {
        xs: "1fr",
        sm: "repeat(2, minmax(0, 1fr))",
        lg: "repeat(3, minmax(0, 1fr))"
      };
    case "descriptive":
      return {
        xs: "1fr",
        xl: "1fr"
      };
    default:
      return {
        xs: "1fr",
        sm: "repeat(2, minmax(0, 1fr))"
      };
  }
}

function getPreviewHeight(layoutMode: LibraryLayoutMode) {
  switch (layoutMode) {
    case "compact":
      return 116;
    case "descriptive":
      return 220;
    default:
      return 188;
  }
}

export function LibraryGrid({
  items,
  layoutMode,
  selectedId,
  onDelete,
  onOpenFolder,
  onSelect
}: LibraryGridProps) {
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
        gap: 2
      }}
    >
      {sortVisibleItems(items).map((item) => {
        const config = kindConfig[item.kind];
        const Icon = config.icon;
        const isSelected = item.id === selectedId;
        const isFolder = item.kind === "folder";
        const isDescriptive = layoutMode === "descriptive";

        return (
          <Card
            key={item.id}
            elevation={0}
            sx={{
              position: "relative",
              overflow: "hidden",
              borderColor: isSelected ? alpha(config.accent, 0.36) : "rgba(16, 39, 58, 0.08)",
              boxShadow: isSelected ? `0 16px 36px ${alpha(config.accent, 0.16)}` : "0 10px 28px rgba(16, 39, 58, 0.05)"
            }}
          >
            <Tooltip title={`Elimina ${item.name}`}>
              <IconButton
                aria-label={`Elimina ${item.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(item);
                }}
                sx={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  zIndex: 2,
                  bgcolor: "rgba(255,255,255,0.92)"
                }}
              >
                <CloseRoundedIcon />
              </IconButton>
            </Tooltip>

            <CardActionArea
              onClick={() => {
                if (isFolder) {
                  onOpenFolder(item.id);
                  return;
                }

                onSelect(item.id);
              }}
              sx={{
                height: "100%",
                alignItems: "stretch",
                display: "flex",
                flexDirection: isDescriptive ? { xs: "column", md: "row" } : "column"
              }}
            >
              {item.kind === "image" ? (
                <CardMedia
                  component="img"
                  src={item.contentUrl ?? item.downloadUrl}
                  alt={item.name}
                  sx={{
                    height: isDescriptive ? { xs: previewHeight, md: "100%" } : previewHeight,
                    width: isDescriptive ? { xs: "100%", md: 260 } : "100%",
                    objectFit: "cover"
                  }}
                />
              ) : (
                <Box
                  sx={{
                    height: isDescriptive ? { xs: previewHeight, md: "100%" } : previewHeight,
                    width: isDescriptive ? { xs: "100%", md: 260 } : "100%",
                    px: 2.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: alpha(config.accent, 0.08)
                  }}
                >
                  <Stack spacing={1.5} alignItems="center">
                    <Avatar
                      sx={{
                        width: layoutMode === "compact" ? 52 : 64,
                        height: layoutMode === "compact" ? 52 : 64,
                        bgcolor: alpha(config.accent, 0.14),
                        color: config.accent
                      }}
                    >
                      <Icon />
                    </Avatar>
                    <Chip
                      label={config.label}
                      size="small"
                      sx={{ bgcolor: alpha(config.accent, 0.14), color: config.accent }}
                    />
                  </Stack>
                </Box>
              )}

              <CardContent sx={{ width: "100%" }}>
                <Stack spacing={layoutMode === "compact" ? 1 : 1.25}>
                  <Typography
                    variant={layoutMode === "compact" ? "subtitle1" : "h6"}
                    sx={{ lineHeight: 1.18, wordBreak: "break-word", pr: 4.5 }}
                  >
                    {item.name}
                  </Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={config.label} size="small" />
                    {isFolder ? (
                      <Chip label={`${item.childrenCount ?? 0} elementi`} size="small" variant="outlined" />
                    ) : (
                      <Chip label={formatBytes(item.sizeBytes)} size="small" variant="outlined" />
                    )}
                  </Stack>

                  <Typography color="text.secondary" variant="body2">
                    {isFolder ? "Cartella locale" : `Aggiunto ${formatDate(item.createdAt)}`}
                  </Typography>

                  {layoutMode === "descriptive" ? (
                    <Typography color="text.secondary" variant="body2">
                      {isFolder
                        ? "Aprila per navigare i contenuti, come in una vista a colonne."
                        : `${item.mimeType} · ${formatBytes(item.sizeBytes)}`}
                    </Typography>
                  ) : null}
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
}
