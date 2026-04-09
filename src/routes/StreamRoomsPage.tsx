import { startTransition, useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import type { StreamRoomSummary } from "../../shared/types";
import { PageHeader } from "../components/PageHeader";
import { QrCodeDialog } from "../components/QrCodeDialog";
import { copyTextToClipboard } from "../lib/clipboard";
import { buildStreamRoomShareUrl } from "../lib/share-links";
import { useAppShell } from "../lib/app-shell-context";
import { insetCardSx, pageCardSx } from "../lib/surfaces";
import { useQrDialog } from "../lib/useQrDialog";
import { createStreamRoom, deleteStreamRoom, fetchStreamRooms } from "../lib/api";
import { useLanLiveState } from "../lib/useLanLiveState";

function formatRoomTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

export function StreamRoomsPage() {
  const theme = useTheme();
  const [rooms, setRooms] = useState<StreamRoomSummary[]>([]);
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [qrRoomTarget, setQrRoomTarget] = useState<StreamRoomSummary | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const { session } = useAppShell();
  const sessionLanUrl = session?.lanUrl ?? null;
  const roomQrUrl = qrRoomTarget ? buildStreamRoomShareUrl(qrRoomTarget.id, sessionLanUrl) : null;
  const roomQrDialog = useQrDialog(roomQrUrl, { width: 256 });
  const roomQrHref = roomQrUrl ?? undefined;

  const liveState = useLanLiveState({
    handlers: {
      "stream-room-created": () => {
        void syncData();
      },
      "stream-room-updated": () => {
        void syncData();
      },
      "stream-room-deleted": () => {
        void syncData();
      },
      "library-updated": () => {
        void syncData();
      }
    },
    onFallback: () => {
      const pollingId = window.setInterval(() => {
        void syncData();
      }, 15000);

      return () => {
        window.clearInterval(pollingId);
      };
    }
  });

  async function syncData() {
    const roomsResponse = await fetchStreamRooms();

    startTransition(() => {
      setRooms(roomsResponse.rooms);
      setLoading(false);
    });
  }

  useEffect(() => {
    void syncData();
  }, []);

  async function handleCreateRoom() {
    const trimmedName = roomName.trim();

    if (!trimmedName) {
      return;
    }

    setCreatingRoom(true);

    try {
      await createStreamRoom(trimmedName);
      setRoomName("");
      await syncData();
      setSnackbar("Stanza creata.");
    } catch {
      setSnackbar("Creazione stanza non riuscita.");
    } finally {
      setCreatingRoom(false);
    }
  }

  async function handleDeleteRoom(roomId: string) {
    setDeletingRoomId(roomId);

    try {
      await deleteStreamRoom(roomId);
      setRooms((currentRooms) => currentRooms.filter((room) => room.id !== roomId));
      setSnackbar("Stanza eliminata.");
    } catch {
      setSnackbar("Eliminazione stanza non riuscita.");
    } finally {
      setDeletingRoomId(null);
    }
  }

  return (
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Stanze Streaming" subtitle="Watch party locale" />

        <Stack spacing={3} sx={{ mt: 3 }}>
          <Box
            sx={{
              display: "grid",
              gap: 2.5,
              alignItems: "start",
              gridTemplateColumns: { xs: "1fr", lg: "0.95fr 1.05fr" }
            }}
          >
            <Card sx={pageCardSx}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h5">Nuova stanza pubblica</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                    <TextField
                      fullWidth
                      label="Nome stanza"
                      value={roomName}
                      onChange={(event) => {
                        setRoomName(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleCreateRoom();
                        }
                      }}
                    />
                    <Button
                      variant="contained"
                      startIcon={<AddRoundedIcon />}
                      disabled={creatingRoom || roomName.trim().length === 0}
                      onClick={() => {
                        void handleCreateRoom();
                      }}
                    >
                      Crea stanza
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          {liveState === "fallback" ? (
            <Alert severity="warning">Connessione live non disponibile. Sto aggiornando l’elenco con polling.</Alert>
          ) : null}

          <Card sx={pageCardSx}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5">Elenco stanze</Typography>
                {loading ? (
                  <Typography color="text.secondary">Caricamento stanze...</Typography>
                ) : rooms.length === 0 ? (
                  <Typography color="text.secondary">Nessuna stanza attiva. Crea la prima watch room.</Typography>
                ) : (
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.25,
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                        md: "repeat(3, minmax(0, 1fr))",
                        lg: "repeat(4, minmax(0, 1fr))"
                      }
                    }}
                  >
                    {rooms.map((room) => (
                      <Card
                        key={room.id}
                        variant="outlined"
                        sx={{
                          position: "relative",
                          ...insetCardSx,
                          minWidth: 0
                        }}
                      >
                        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                          <Stack
                            direction="row"
                            spacing={0.25}
                            sx={{
                              position: "absolute",
                              top: 6,
                              right: 6
                            }}
                          >
                            <IconButton
                              size="small"
                              aria-label={`Mostra QR code stanza ${room.name}`}
                              onClick={() => {
                                setQrRoomTarget(room);
                                roomQrDialog.openDialog();
                              }}
                            >
                              <QrCode2RoundedIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              aria-label={`Elimina stanza ${room.name}`}
                              disabled={deletingRoomId === room.id}
                              onClick={() => {
                                void handleDeleteRoom(room.id);
                              }}
                            >
                              <CloseRoundedIcon fontSize="small" />
                            </IconButton>
                          </Stack>

                          <Stack spacing={1.25}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ pr: 3 }}>
                              <Avatar
                                sx={{
                                  width: 36,
                                  height: 36,
                                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                                  color: "primary.main"
                                }}
                              >
                                <MeetingRoomRoundedIcon />
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle1" sx={{ wordBreak: "break-word", lineHeight: 1.2 }}>
                                  {room.name}
                                </Typography>
                              </Box>
                            </Stack>

                            <Stack spacing={0.25}>
                              <Typography color="text.secondary" variant="caption">
                                Video corrente
                              </Typography>
                              <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                                {room.currentVideoName ?? "Nessun video selezionato"}
                              </Typography>
                            </Stack>

                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <Chip
                                size="small"
                                label={room.messageCount === 1 ? "1 messaggio" : `${room.messageCount} messaggi`}
                              />
                              <Chip
                                size="small"
                                label={room.playback.status === "playing" ? "In riproduzione" : "In pausa"}
                              />
                            </Stack>

                            <Button
                              component={RouterLink}
                              to={`/stream/room/${room.id}`}
                              variant="contained"
                              startIcon={<PlayArrowRoundedIcon />}
                              size="small"
                              fullWidth
                            >
                              Apri stanza
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={2600}
        onClose={() => {
          setSnackbar(null);
        }}
        message={snackbar}
      />

      <QrCodeDialog
        {...roomQrDialog.dialogProps}
        onClose={() => {
          roomQrDialog.closeDialog();
          setQrRoomTarget(null);
        }}
        title="QR code stanza"
        description="Inquadra questo codice dalla stessa LAN per aprire subito la stanza."
        qrCodeAlt={`QR code ${qrRoomTarget?.name ?? "stanza streaming"}`}
        subject={qrRoomTarget?.name}
        url={roomQrHref}
        onCopy={
          roomQrHref
            ? () => {
                void copyTextToClipboard(roomQrHref)
                  .then(() => {
                    setSnackbar("Link stanza copiato.");
                  })
                  .catch(() => {
                    setSnackbar("Copia link non disponibile.");
                  });
              }
            : undefined
        }
      />
    </Box>
  );
}
