import { useEffect, useState } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
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
import type { ItemPreview, LibraryItem } from "../../shared/types";
import { fetchItemPreview } from "../lib/api";
import { formatBytes, formatDate } from "../lib/format";

interface MediaDetailProps {
  item: LibraryItem | null;
  onCopyLink: (url: string) => Promise<void>;
}

const detailIcons = {
  folder: FolderRoundedIcon,
  video: MovieRoundedIcon,
  image: ImageRoundedIcon,
  audio: MusicNoteRoundedIcon,
  document: DescriptionRoundedIcon,
  archive: SourceRoundedIcon,
  other: SourceRoundedIcon
} as const;

const detailAccent = {
  folder: "#1769aa",
  video: "#1769aa",
  image: "#0f9d94",
  audio: "#4553c7",
  document: "#c47917",
  archive: "#8b4fcf",
  other: "#5a7184"
} as const;

function DocumentPreview({
  item,
  preview,
  loading
}: {
  item: LibraryItem;
  loading: boolean;
  preview: ItemPreview | null;
}) {
  if (loading) {
    return (
      <Stack spacing={1.5} alignItems="center">
        <CircularProgress />
        <Typography color="text.secondary">Preparazione anteprima documento...</Typography>
      </Stack>
    );
  }

  if (!preview) {
    return (
      <Typography color="text.secondary">
        Nessuna anteprima disponibile per questo documento.
      </Typography>
    );
  }

  if (preview.mode === "pdf") {
    return (
      <Box
        component="iframe"
        title={`Anteprima ${item.name}`}
        src={preview.url}
        sx={{
          width: "100%",
          height: 520,
          border: 0,
          bgcolor: "background.paper"
        }}
      />
    );
  }

  if (preview.mode === "text") {
    return (
      <Box
        component="pre"
        sx={{
          m: 0,
          width: "100%",
          minHeight: 220,
          maxHeight: 360,
          overflow: "auto",
          p: 2,
          borderRadius: 1.5,
          border: "1px solid rgba(16, 39, 58, 0.12)",
          bgcolor: "background.paper",
          fontFamily: '"Roboto Mono", "SFMono-Regular", monospace',
          fontSize: "0.92rem",
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word"
        }}
      >
        {preview.text}
      </Box>
    );
  }

  return (
    <Typography color="text.secondary">
      {preview.mode === "none"
        ? preview.notice
        : `Questa cartella contiene ${preview.childCount} elementi.`}
    </Typography>
  );
}

export function MediaDetail({ item, onCopyLink }: MediaDetailProps) {
  const [preview, setPreview] = useState<ItemPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (!item || !["document", "folder"].includes(item.kind)) {
      setPreview(null);
      setPreviewLoading(false);
      return () => {
        active = false;
      };
    }

    setPreviewLoading(true);
    void fetchItemPreview(item.id)
      .then((result) => {
        if (!active) {
          return;
        }

        setPreview(result);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setPreview({
          mode: "none",
          notice: "Anteprima non disponibile per questo formato."
        });
      })
      .finally(() => {
        if (!active) {
          return;
        }

        setPreviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [item]);

  if (!item) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ py: 7 }}>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Seleziona un contenuto
          </Typography>
          <Typography color="text.secondary">
            Vedrai qui il player locale, le azioni rapide, la preview documenti e i dettagli della cartella o del file scelto.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const Icon = detailIcons[item.kind];
  const accent = detailAccent[item.kind];
  const shareUrl = item.downloadUrl ?? item.contentUrl ?? "";

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
        subheader={
          item.kind === "folder"
            ? `${item.childrenCount ?? 0} elementi`
            : `${item.mimeType} · ${formatBytes(item.sizeBytes)} · ${formatDate(item.createdAt)}`
        }
      />
      <Divider />
      <CardContent sx={{ pt: 3 }}>
        <Stack spacing={2}>
          <Box
            sx={{
              overflow: "hidden",
              borderRadius: 2,
              border: "1px solid rgba(16, 39, 58, 0.12)",
              minHeight: 280,
              display: "grid",
              placeItems: "center",
              p: item.kind === "document" ? 1.5 : 0,
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
                <Box component="audio" controls src={item.streamUrl} sx={{ width: "100%" }} />
              </Stack>
            ) : null}

            {item.kind === "folder" ? (
              <Stack spacing={1.5} alignItems="center" sx={{ px: 3 }}>
                <Avatar sx={{ width: 72, height: 72, bgcolor: alpha(accent, 0.14), color: accent }}>
                  <FolderRoundedIcon sx={{ fontSize: 36 }} />
                </Avatar>
                <Typography variant="h6">Cartella attiva</Typography>
                <Typography color="text.secondary" textAlign="center" sx={{ maxWidth: 360 }}>
                  {preview?.mode === "folder"
                    ? `Questa cartella contiene ${preview.childCount} elementi.`
                    : "Usa l’esploratore a colonne per entrare e muoverti tra le sottocartelle."}
                </Typography>
              </Stack>
            ) : null}

            {item.kind === "document" ? (
              <DocumentPreview item={item} preview={preview} loading={previewLoading} />
            ) : null}

            {!["video", "image", "audio", "document", "folder"].includes(item.kind) ? (
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


        </Stack>
      </CardContent>
      <Divider />
      <CardActions sx={{ px: 3, py: 2, flexWrap: "wrap", rowGap: 1 }}>
        <Box sx={{ flex: 1 }} />
        {item.kind !== "folder" ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            {item.downloadUrl ? (
              <Button
                component="a"
                href={item.downloadUrl}
                variant="contained"
                startIcon={<DownloadRoundedIcon />}
              >
                Scarica
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </CardActions>
    </Card>
  );
}
