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
    case "minimal":
      return {
        xs: "1fr"
      };
    case "compact":
      return {
        xs: "repeat(2, minmax(0, 1fr))",
        md: "repeat(3, minmax(0, 1fr))"
      };
    default:
      return {
        xs: "1fr",
        lg: "repeat(2, minmax(0, 1fr))"
      };
  }
}

function getPreviewHeight(layoutMode: LibraryLayoutMode) {
  if (layoutMode === "compact") {
    return 112;
  }

  return 172;
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

        if (layoutMode === "minimal") {
          return (
            <Card
              key={item.id}
              elevation={0}
              sx={{
                position: "relative",
                overflow: "hidden",
                borderColor: isSelected ? alpha(config.accent, 0.36) : "rgba(16, 39, 58, 0.08)",
                boxShadow: isSelected ? `0 12px 28px ${alpha(config.accent, 0.14)}` : "0 8px 22px rgba(16, 39, 58, 0.04)"
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
                    top: 8,
                    right: 8,
                    zIndex: 2,
                    bgcolor: "rgba(255,255,255,0.92)"
                  }}
                >
                  <CloseRoundedIcon fontSize="small" />
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
              >
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2, py: 1.5, pr: 6 }}>
                  <Avatar
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: alpha(config.accent, 0.12),
                      color: config.accent
                    }}
                  >
                    <Icon fontSize="small" />
                  </Avatar>
                  <Stack spacing={0.2} sx={{ minWidth: 0 }}>
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
                    bgcolor: alpha(config.accent, 0.08)
                  }}
                >
                  <Stack spacing={1} alignItems="center">
                    <Avatar
                      sx={{
                        width: layoutMode === "compact" ? 48 : 60,
                        height: layoutMode === "compact" ? 48 : 60,
                        bgcolor: alpha(config.accent, 0.14),
                        color: config.accent
                      }}
                    >
                      <Icon />
                    </Avatar>
                    {layoutMode === "descriptive" ? (
                      <Chip
                        label={config.label}
                        size="small"
                        sx={{ bgcolor: alpha(config.accent, 0.14), color: config.accent }}
                      />
                    ) : null}
                  </Stack>
                </Box>
              )}

              <CardContent>
                <Stack spacing={layoutMode === "compact" ? 0.75 : 1.25}>
                  <Typography
                    variant={layoutMode === "compact" ? "subtitle1" : "h6"}
                    sx={{ lineHeight: 1.18, wordBreak: "break-word", pr: 4.5 }}
                  >
                    {item.name}
                  </Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={config.label} size="small" />
                    <Chip
                      label={isFolder ? `${item.childrenCount ?? 0} elementi` : formatBytes(item.sizeBytes)}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>

                  {layoutMode === "descriptive" ? (
                    <>
                      <Typography color="text.secondary" variant="body2">
                        {isFolder ? "Cartella locale" : `Aggiunto ${formatDate(item.createdAt)}`}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        {isFolder
                          ? "Aprila per continuare l’esplorazione a colonne."
                          : `${item.mimeType} · ${formatBytes(item.sizeBytes)}`}
                      </Typography>
                    </>
                  ) : (
                    <Typography color="text.secondary" variant="body2">
                      {isFolder ? "Cartella locale" : formatDate(item.createdAt)}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
}
