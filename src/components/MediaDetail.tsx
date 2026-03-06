import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import MusicNoteRoundedIcon from "@mui/icons-material/MusicNoteRounded";
import SourceRoundedIcon from "@mui/icons-material/SourceRounded";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Stack,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { LibraryItem } from "../../shared/types";
import { formatBytes, formatDate } from "../lib/format";

interface MediaDetailProps {
  item: LibraryItem | null;
  onCopyLink: (url: string) => Promise<void>;
}

const detailIcons = {
  video: MovieRoundedIcon,
  image: ImageRoundedIcon,
  audio: MusicNoteRoundedIcon,
  document: SourceRoundedIcon,
  archive: SourceRoundedIcon,
  other: SourceRoundedIcon
} as const;

const detailAccent = {
  video: "#1769aa",
  image: "#0f9d94",
  audio: "#4553c7",
  document: "#c47917",
  archive: "#8b4fcf",
  other: "#5a7184"
} as const;

export function MediaDetail({ item, onCopyLink }: MediaDetailProps) {
  if (!item) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ py: 7 }}>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Seleziona un contenuto
          </Typography>
          <Typography color="text.secondary">
            Vedrai qui il player locale, le azioni rapide e i dettagli del file scelto.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const Icon = detailIcons[item.kind];
  const accent = detailAccent[item.kind];

  return (
    <Card>
      <CardHeader
        avatar={
          <Avatar sx={{ bgcolor: alpha(accent, 0.14), color: accent }}>
            <Icon />
          </Avatar>
        }
        titleTypographyProps={{ variant: "h4", sx: { fontSize: "clamp(1.45rem, 2vw, 2rem)" } }}
        subheaderTypographyProps={{ color: "text.secondary" }}
        title={item.name}
        subheader={`${item.mimeType} · ${formatBytes(item.sizeBytes)}`}
      />
      <Divider />
      <CardContent sx={{ pt: 3 }}>
        <Stack spacing={2.5}>
          <Box
            sx={{
              overflow: "hidden",
              borderRadius: 4,
              minHeight: 280,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(accent, 0.08)
            }}
          >
            {item.kind === "video" ? (
              <Box
                component="video"
                controls
                src={item.streamUrl}
                sx={{ width: "100%", maxHeight: 420, display: "block", bgcolor: "#08131e" }}
              />
            ) : null}
            {item.kind === "image" ? (
              <Box
                component="img"
                src={item.contentUrl ?? item.downloadUrl}
                alt={item.name}
                sx={{ width: "100%", maxHeight: 420, objectFit: "contain", display: "block" }}
              />
            ) : null}
            {item.kind === "audio" ? (
              <Stack spacing={2.25} alignItems="center" sx={{ width: "100%", px: 3 }}>
                <Chip icon={<LanRoundedIcon />} label="Streaming audio locale" color="secondary" />
                <Box component="audio" controls src={item.streamUrl} sx={{ width: "100%" }} />
              </Stack>
            ) : null}
            {!["video", "image", "audio"].includes(item.kind) ? (
              <Stack spacing={1.5} alignItems="center" sx={{ px: 3 }}>
                <Avatar sx={{ width: 64, height: 64, bgcolor: alpha(accent, 0.14), color: accent }}>
                  <Icon />
                </Avatar>
                <Typography variant="h6">Download locale pronto</Typography>
                <Typography color="text.secondary" textAlign="center" sx={{ maxWidth: 360 }}>
                  Questo formato non richiede un player inline. Gli altri device in LAN lo scaricano direttamente dall’host.
                </Typography>
              </Stack>
            ) : null}
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={item.kind} />
            <Chip label={item.mimeType} variant="outlined" />
            <Chip label={formatBytes(item.sizeBytes)} variant="outlined" />
          </Stack>

          <Typography color="text.secondary">
            Creato {formatDate(item.createdAt)} · Stored name: {item.storedName}
          </Typography>
        </Stack>
      </CardContent>
      <Divider />
      <CardActions sx={{ px: 3, py: 2, flexWrap: "wrap", rowGap: 1 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Chip icon={<LanRoundedIcon />} label="Solo host locale" color="secondary" variant="outlined" />
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button
            component="a"
            href={item.downloadUrl}
            variant="contained"
            startIcon={<DownloadRoundedIcon />}
          >
            Scarica
          </Button>
          <Button
            variant="outlined"
            startIcon={<ContentCopyRoundedIcon />}
            onClick={() => {
              void onCopyLink(window.location.origin + item.downloadUrl);
            }}
          >
            Copia link locale
          </Button>
        </Stack>
      </CardActions>
    </Card>
  );
}
