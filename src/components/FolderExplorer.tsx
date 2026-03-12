import { useEffect, useRef } from "react";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import MusicNoteRoundedIcon from "@mui/icons-material/MusicNoteRounded";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
  useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { ArchiveFormat, LibraryItem } from "../../shared/types";
import { ItemActionsMenu } from "./ItemActionsMenu";

interface FolderExplorerProps {
  availableArchiveFormats: ArchiveFormat[];
  currentFolderId: string | null;
  items: LibraryItem[];
  selectedId: string | null;
  onCreateArchive: (item: LibraryItem, format: ArchiveFormat) => void | Promise<void>;
  onDeleteItem: (item: LibraryItem) => void | Promise<void>;
  onDownloadItem: (item: LibraryItem, format?: ArchiveFormat) => void;
  onOpenFolder: (folderId: string | null) => void;
  onSelectItem: (itemId: string) => void;
  onShowQrCode: (item: LibraryItem) => void | Promise<void>;
}

const itemIcons = {
  folder: FolderRoundedIcon,
  video: MovieRoundedIcon,
  image: ImageRoundedIcon,
  audio: MusicNoteRoundedIcon,
  document: DescriptionRoundedIcon,
  archive: DescriptionRoundedIcon,
  other: DescriptionRoundedIcon
} as const;

const itemAccents = {
  folder: "#1769aa",
  video: "#1769aa",
  image: "#0f9d94",
  audio: "#4553c7",
  document: "#c47917",
  archive: "#8b4fcf",
  other: "#5a7184"
} as const;

function sortExplorerItems(items: LibraryItem[]) {
  return [...items].sort((left, right) => {
    if (left.kind === "folder" && right.kind !== "folder") {
      return -1;
    }

    if (left.kind !== "folder" && right.kind === "folder") {
      return 1;
    }

    return left.name.localeCompare(right.name, "it", { sensitivity: "base" });
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

export function FolderExplorer({
  availableArchiveFormats,
  currentFolderId,
  items,
  selectedId,
  onCreateArchive,
  onDeleteItem,
  onDownloadItem,
  onOpenFolder,
  onSelectItem,
  onShowQrCode
}: FolderExplorerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDark = theme.palette.mode === "dark";
  const columnsViewportRef = useRef<HTMLDivElement | null>(null);
  const folderPath = buildFolderPath(items, currentFolderId);
  const pathFolderIds = new Set(folderPath.map((folder) => folder.id));
  const columns = [
    {
      id: "root",
      title: "LAN",
      items: sortExplorerItems(items.filter((item) => item.parentId === null))
    },
    ...folderPath.map((folder) => ({
      id: folder.id,
      title: folder.name,
      items: sortExplorerItems(items.filter((item) => item.parentId === folder.id))
    }))
  ];

  useEffect(() => {
    const viewport = columnsViewportRef.current;

    if (!isMobile || !viewport) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (!currentFolderId) {
        viewport.scrollTo({
          left: 0,
          behavior: "smooth"
        });
        return;
      }

      viewport.lastElementChild?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "end"
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [currentFolderId, isMobile]);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
        <Button
          startIcon={<HomeRoundedIcon />}
          variant={currentFolderId === null ? "contained" : folderPath.length > 0 ? "outlined" : "text"}
          onClick={() => {
            onOpenFolder(null);
          }}
        >
          Radice
        </Button>
        {folderPath.map((folder) => (
          <Button
            key={folder.id}
            startIcon={<ChevronRightRoundedIcon />}
            variant={folder.id === currentFolderId ? "contained" : "outlined"}
            onClick={() => {
              onOpenFolder(folder.id);
            }}
          >
            {folder.name}
          </Button>
        ))}
      </Stack>

      <Box
        ref={columnsViewportRef}
        sx={{
          display: "grid",
          gap: 1.5,
          gridAutoColumns: { xs: "minmax(260px, 80vw)", md: "minmax(220px, 1fr)" },
          gridAutoFlow: "column",
          overflowX: "auto",
          pb: 0.5
        }}
      >
        {columns.map((column) => (
          <Card key={column.id} variant="outlined" sx={{ minHeight: 260 }}>
            <CardContent sx={{ p: 0 }}>
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  borderBottom: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)}`
                }}
              >
                <Typography variant="subtitle1">{column.title}</Typography>
              </Box>

              <List disablePadding dense>
                {column.items.length === 0 ? (
                  <Box sx={{ px: 2, py: 3 }}>
                    <Typography color="text.secondary" variant="body2">
                      Nessun elemento in questa colonna.
                    </Typography>
                  </Box>
                ) : null}

                {column.items.map((item) => {
                  const Icon = itemIcons[item.kind];
                  const accent = itemAccents[item.kind];
                  const isCurrentFolder = item.kind === "folder" && item.id === currentFolderId;
                  const isPathFolder = item.kind === "folder" && pathFolderIds.has(item.id);
                  const isSelectedFile = item.kind !== "folder" && item.id === selectedId;
                  const isActive = isCurrentFolder || isSelectedFile;

                  return (
                    <ListItemButton
                      key={item.id}
                      selected={isActive}
                      onClick={() => {
                        if (item.kind === "folder") {
                          onOpenFolder(item.id);
                          return;
                        }

                        onSelectItem(item.id);
                      }}
                      sx={{
                        gap: 1.25,
                        alignItems: "center",
                        borderLeft:
                          isCurrentFolder || isSelectedFile || isPathFolder
                            ? `3px solid ${accent}`
                            : "3px solid transparent",
                        bgcolor: isCurrentFolder
                          ? alpha(accent, isDark ? 0.22 : 0.14)
                          : isPathFolder
                            ? alpha(accent, isDark ? 0.14 : 0.08)
                            : undefined,
                        "&:hover": {
                          bgcolor: isCurrentFolder
                            ? alpha(accent, isDark ? 0.28 : 0.18)
                            : isPathFolder
                              ? alpha(accent, isDark ? 0.18 : 0.12)
                              : undefined
                        }
                      }}
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
                      <ListItemText
                        primary={item.name}
                        secondary={
                          item.kind === "folder"
                            ? `${item.childrenCount ?? 0} elementi`
                            : item.mimeType
                        }
                        primaryTypographyProps={{
                          noWrap: true,
                          fontWeight:
                            item.kind === "folder"
                              ? isCurrentFolder
                                ? 800
                                : isPathFolder
                                  ? 700
                                  : 650
                              : 500
                        }}
                        secondaryTypographyProps={{ noWrap: true }}
                      />
                      <Stack direction="row" spacing={0.25} alignItems="center">
                        <ItemActionsMenu
                          availableArchiveFormats={availableArchiveFormats}
                          item={item}
                          onCreateArchive={onCreateArchive}
                          onDelete={onDeleteItem}
                          onDownload={onDownloadItem}
                          onShowQrCode={onShowQrCode}
                          triggerSx={{
                            color: "text.secondary"
                          }}
                        />
                        {item.kind === "folder" ? <ChevronRightRoundedIcon color="disabled" /> : null}
                      </Stack>
                    </ListItemButton>
                  );
                })}
              </List>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  );
}
