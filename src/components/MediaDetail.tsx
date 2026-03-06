import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import { alpha } from "@mui/material/styles";
import { Box, Button, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import type { LibraryItem } from "../../shared/types";
import { formatBytes, formatDate } from "../lib/format";

interface MediaDetailProps {
  item: LibraryItem | null;
  onCopyLink: (url: string) => Promise<void>;
}

export function MediaDetail({ item, onCopyLink }: MediaDetailProps) {
  if (!item) {
    return (
      <Paper sx={{ p: 4, borderRadius: 6, minHeight: 420 }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Seleziona un contenuto
        </Typography>
        <Typography color="text.secondary">
          Vedrai qui il player locale, le azioni rapide e i dettagli del file scelto.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, borderRadius: 6, minHeight: 420, bgcolor: "rgba(255,255,255,0.88)" }}>
      <Stack spacing={2.5}>
        <Box
          sx={{
            overflow: "hidden",
            borderRadius: 5,
            minHeight: 260,
            display: "grid",
            placeItems: "center",
            bgcolor: alpha("#1769aa", 0.06)
          }}
        >
          {item.kind === "video" ? (
            <Box
              component="video"
              controls
              src={item.streamUrl}
              sx={{ width: "100%", maxHeight: 360, bgcolor: "#08131e" }}
            />
          ) : null}
          {item.kind === "image" ? (
            <Box
              component="img"
              src={item.contentUrl ?? item.downloadUrl}
              alt={item.name}
              sx={{ maxWidth: "100%", maxHeight: 360, objectFit: "contain" }}
            />
          ) : null}
          {item.kind === "audio" ? (
            <Stack spacing={2} alignItems="center" sx={{ width: "100%", px: 2 }}>
              <Chip icon={<LanRoundedIcon />} label="Streaming audio locale" color="secondary" />
              <Box component="audio" controls src={item.streamUrl} sx={{ width: "100%" }} />
            </Stack>
          ) : null}
          {!["video", "image", "audio"].includes(item.kind) ? (
            <Stack spacing={1.5} alignItems="center">
              <Typography variant="h5">Download locale pronto</Typography>
              <Typography color="text.secondary" textAlign="center" sx={{ maxWidth: 360 }}>
                Questo formato non richiede un player inline. Gli altri device in LAN lo scaricano direttamente dall’host.
              </Typography>
            </Stack>
          ) : null}
        </Box>

        <Stack spacing={1}>
          <Typography variant="h4" sx={{ fontSize: "clamp(1.5rem, 2vw, 2rem)" }}>
            {item.name}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={item.kind} />
            <Chip label={item.mimeType} variant="outlined" />
            <Chip label={formatBytes(item.sizeBytes)} variant="outlined" />
          </Stack>
        </Stack>

        <Divider />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button component="a" href={item.downloadUrl} variant="contained" startIcon={<DownloadRoundedIcon />}>
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

        <Stack spacing={0.5}>
          <Typography color="text.secondary">Creato {formatDate(item.createdAt)}</Typography>
          <Typography color="text.secondary">Stored name: {item.storedName}</Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
