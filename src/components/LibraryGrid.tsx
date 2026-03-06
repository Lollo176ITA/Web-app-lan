import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import AudiotrackRoundedIcon from "@mui/icons-material/AudiotrackRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import { alpha } from "@mui/material/styles";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
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
      <Paper
        sx={{
          p: 4,
          borderRadius: 6,
          textAlign: "center",
          bgcolor: "rgba(255,255,255,0.8)"
        }}
      >
        <Typography variant="h5" sx={{ mb: 1 }}>
          Libreria ancora vuota
        </Typography>
        <Typography color="text.secondary">
          Carica il primo contenuto per trasformare questa rete nel tuo hub locale.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: "repeat(2, minmax(0, 1fr))",
          xl: "repeat(3, minmax(0, 1fr))"
        },
        gap: 2
      }}
    >
      {items.map((item) => {
        const config = kindConfig[item.kind];
        const Icon = config.icon;
        const isSelected = item.id === selectedId;

        return (
          <Paper
            key={item.id}
            onClick={() => onSelect(item.id)}
            elevation={0}
            sx={{
              cursor: "pointer",
              overflow: "hidden",
              borderRadius: 6,
              borderColor: isSelected ? alpha(config.accent, 0.45) : "rgba(16, 39, 58, 0.08)",
              boxShadow: isSelected ? `0 18px 48px ${alpha(config.accent, 0.22)}` : "none",
              transform: isSelected ? "translateY(-2px)" : "none",
              transition: "all 180ms ease"
            }}
          >
            <Box
              sx={{
                position: "relative",
                height: 170,
                bgcolor: alpha(config.accent, 0.08),
                display: "grid",
                placeItems: "center",
                overflow: "hidden"
              }}
            >
              {item.kind === "image" ? (
                <Box
                  component="img"
                  src={item.contentUrl ?? item.downloadUrl}
                  alt={item.name}
                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Stack alignItems="center" spacing={1.2}>
                  <Icon sx={{ fontSize: 42, color: config.accent }} />
                  <Chip label={config.label} size="small" sx={{ bgcolor: alpha(config.accent, 0.14), color: config.accent }} />
                </Stack>
              )}
            </Box>

            <Stack spacing={1.25} sx={{ p: 2.25 }}>
              <Typography variant="h6" sx={{ lineHeight: 1.15, wordBreak: "break-word" }}>
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
          </Paper>
        );
      })}
    </Box>
  );
}
