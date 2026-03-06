import { useEffect, useState } from "react";
import { Box, CircularProgress, Container, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import type { LibraryItem } from "../../shared/types";
import { PageHeader } from "../components/PageHeader";
import { fetchItem } from "../lib/api";

export function VideoPlayerPage() {
  const { itemId } = useParams();
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
          bgcolor: "#04090f"
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
          bgcolor: "#04090f",
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
    <Box sx={{ minHeight: "100vh", bgcolor: "#04090f", pb: 3 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Routeroom" subtitle="LAN media relay" />

        <Box
          sx={{
            mt: 3,
            borderRadius: 4,
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
              maxHeight: "calc(100vh - 140px)",
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
