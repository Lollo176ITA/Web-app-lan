import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import AudiotrackRoundedIcon from "@mui/icons-material/AudiotrackRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
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
  Stack,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { LibraryItem } from "../../shared/types";
import { formatBytes, formatDate } from "../lib/format";

interface LibraryGridProps {
  items: LibraryItem[];
  selectedId: string | null;
  onSelect: (itemId: string) => void;
}

const kindConfig = {
  video: { label: "Video", icon: MovieRoundedIcon, accent: "#1769aa" },
  image: { label: "Immagine", icon: ImageRoundedIcon, accent: "#0f9d94" },
  audio: { label: "Audio", icon: AudiotrackRoundedIcon, accent: "#4553c7" },
  document: { label: "Documento", icon: DescriptionRoundedIcon, accent: "#c47917" },
  archive: { label: "Archivio", icon: ArchiveRoundedIcon, accent: "#8b4fcf" },
  other: { label: "Altro", icon: MoreHorizRoundedIcon, accent: "#5a7184" }
} as const;

export function LibraryGrid({ items, selectedId, onSelect }: LibraryGridProps) {
  if (items.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ py: 7, textAlign: "center" }}>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Libreria ancora vuota
          </Typography>
          <Typography color="text.secondary">
            Carica il primo contenuto per trasformare questa rete nel tuo hub locale.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))"
        },
        gap: 2
      }}
    >
      {items.map((item) => {
        const config = kindConfig[item.kind];
        const Icon = config.icon;
        const isSelected = item.id === selectedId;

        return (
          <Card
            key={item.id}
            elevation={0}
            sx={{
              overflow: "hidden",
              borderColor: isSelected ? alpha(config.accent, 0.36) : "rgba(16, 39, 58, 0.08)",
              boxShadow: isSelected ? `0 16px 36px ${alpha(config.accent, 0.16)}` : "0 10px 28px rgba(16, 39, 58, 0.05)"
            }}
          >
            <CardActionArea onClick={() => onSelect(item.id)} sx={{ height: "100%", alignItems: "stretch" }}>
              {item.kind === "image" ? (
                <CardMedia
                  component="img"
                  src={item.contentUrl ?? item.downloadUrl}
                  alt={item.name}
                  sx={{ height: 188, objectFit: "cover" }}
                />
              ) : (
                <Box
                  sx={{
                    height: 188,
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
                        width: 64,
                        height: 64,
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

              <CardContent>
                <Stack spacing={1.25}>
                  <Typography variant="h6" sx={{ lineHeight: 1.18, wordBreak: "break-word" }}>
                    {item.name}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={config.label} size="small" />
                    <Chip label={formatBytes(item.sizeBytes)} size="small" variant="outlined" />
                  </Stack>
                  <Typography color="text.secondary" variant="body2">
                    Aggiunto {formatDate(item.createdAt)}
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
