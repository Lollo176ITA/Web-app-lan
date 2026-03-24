import { useEffect, useState } from "react";
import { Box, CircularProgress, Container, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useParams } from "react-router-dom";
import type { LibraryItem } from "../../shared/types";
import { fetchItem } from "../lib/api";
import { cardRadii } from "../lib/surfaces";

export function VideoPlayerPage() {
  const { itemId } = useParams();
  const theme = useTheme();
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!itemId) {
      setLoading(false);
      setError("Video non trovato.");
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    void fetchItem(itemId)
      .then((nextItem) => {
        if (!active) {
          return;
        }

        setItem(nextItem);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setError("Video non disponibile su questo host.");
        setItem(null);
      })
      .finally(() => {
        if (!active) {
          return;
        }

        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [itemId]);

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          bgcolor: theme.palette.background.default
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!item || item.kind !== "video" || !item.streamUrl) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          bgcolor: theme.palette.background.default,
          px: 3
        }}
      >
        <Typography color="common.white" variant="h5" textAlign="center">
          {error ?? "Questo contenuto non e un video riproducibile."}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: theme.palette.background.default,
        pb: 3
      }}
    >
      <Container maxWidth="xl" sx={{ pt: { xs: 1, md: 2 } }}>
        <Box
          sx={{
            borderRadius: cardRadii.inset,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            bgcolor: "#000"
          }}
        >
          <Box
            component="video"
            controls
            autoPlay
            playsInline
            src={item.streamUrl}
            aria-label={`Player video ${item.name}`}
            sx={{
              width: "100%",
              maxHeight: "calc(100vh - 40px)",
              display: "block",
              bgcolor: "#000",
              objectFit: "contain"
            }}
          />
        </Box>
      </Container>
    </Box>
  );
}
