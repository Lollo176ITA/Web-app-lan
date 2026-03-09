import { startTransition, useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import QRCode from "qrcode";
import { Link as RouterLink } from "react-router-dom";
import type { LibraryItem, StreamRoomSummary } from "../../shared/types";
import { PageHeader } from "../components/PageHeader";
import { copyTextToClipboard } from "../lib/clipboard";
import { createStreamRoom, deleteStreamRoom, fetchItems, fetchSession, fetchStreamRooms, openLanEvents } from "../lib/api";

type LiveState = "live" | "fallback" | "connecting";

function formatRoomTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function buildRoomShareUrl(roomId: string, lanUrl?: string | null) {
  const browserUrl = new URL(window.location.href);
  const shareUrl = new URL(browserUrl.href);

  if (lanUrl) {
    const sessionUrl = new URL(lanUrl);

    if (browserUrl.hostname === "localhost" || browserUrl.hostname === "127.0.0.1") {
      shareUrl.protocol = sessionUrl.protocol;
      shareUrl.hostname = sessionUrl.hostname;
    }
  }

  shareUrl.pathname = `/stream/room/${roomId}`;
  shareUrl.search = "";
  shareUrl.hash = "";

  return shareUrl.toString();
}

export function StreamRoomsPage() {
  const [rooms, setRooms] = useState<StreamRoomSummary[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<LiveState>("connecting");
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [sessionLanUrl, setSessionLanUrl] = useState<string | null>(null);
  const [qrRoomTarget, setQrRoomTarget] = useState<StreamRoomSummary | null>(null);
  const [qrRoomDataUrl, setQrRoomDataUrl] = useState("");
  const theme = useTheme();

  const videoItems = useMemo(() => items.filter((item) => item.kind === "video"), [items]);

  async function syncData() {
    const [roomsResponse, allItems, session] = await Promise.all([fetchStreamRooms(), fetchItems(), fetchSession()]);

    startTransition(() => {
      setRooms(roomsResponse.rooms);
      setItems(allItems);
      setSessionLanUrl(session.lanUrl);
      setLoading(false);
    });
  }

  useEffect(() => {
    if (!qrRoomTarget) {
      setQrRoomDataUrl("");
      return;
    }

    void QRCode.toDataURL(buildRoomShareUrl(qrRoomTarget.id, sessionLanUrl), {
      margin: 1,
      width: 256,
      color: {
        dark: "#10273a",
        light: "#0000"
      }
    }).then(setQrRoomDataUrl);
  }, [qrRoomTarget, sessionLanUrl]);

  useEffect(() => {
    void syncData();
  }, []);

  useEffect(() => {
    let pollingId: number | undefined;

    const source = openLanEvents(
      {
        "stream-room-created": () => {
          setLiveState("live");
          void syncData();
        },
        "stream-room-updated": () => {
          setLiveState("live");
          void syncData();
        },
        "stream-room-deleted": () => {
          setLiveState("live");
          void syncData();
        },
        "library-updated": () => {
          setLiveState("live");
          void syncData();
        }
      },
      () => {
        setLiveState("fallback");
        pollingId = window.setInterval(() => {
          void syncData();
        }, 15000);
      },
      () => {
        setLiveState("live");
      }
    );

    return () => {
      source.close();

      if (pollingId) {
        window.clearInterval(pollingId);
      }
    };
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
        <PageHeader
          title="Stanze Streaming"
          subtitle="Watch party locale"
          trailing={
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor:
                  liveState === "live" ? alpha(theme.palette.secondary.main, 0.18) : alpha("#10273a", 0.08),
                color: liveState === "live" ? "secondary.main" : "text.secondary"
              }}
            >
              {liveState === "live" ? <WifiRoundedIcon /> : <AutorenewRoundedIcon />}
            </Avatar>
          }
        />

        <Stack spacing={3} sx={{ mt: 3 }}>
          <Box
            sx={{
              display: "grid",
              gap: 2.5,
              alignItems: "start",
              gridTemplateColumns: { xs: "1fr", lg: "0.95fr 1.05fr" }
            }}
          >
            <Card>
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

          <Card>
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
                                  bgcolor: alpha("#1769aa", 0.12),
                                  color: "primary.main"
                                }}
                              >
                                <MeetingRoomRoundedIcon />
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle1" sx={{ wordBreak: "break-word", lineHeight: 1.2 }}>
                                  {room.name}
                                </Typography>
                                <Typography color="text.secondary" variant="caption">
                                  Aggiornata {formatRoomTime(room.updatedAt)}
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

      <Dialog
        open={Boolean(qrRoomTarget)}
        onClose={() => {
          setQrRoomTarget(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>QR code stanza</DialogTitle>
        <DialogContent>
          {qrRoomTarget ? (
            <Stack spacing={2} sx={{ pt: 1, alignItems: "center" }}>
              <Typography color="text.secondary" variant="body2" sx={{ alignSelf: "stretch" }}>
                Inquadra questo codice dalla stessa LAN per aprire subito la stanza.
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  border: `1px solid ${alpha("#1769aa", 0.1)}`
                }}
              >
                {qrRoomDataUrl ? (
                  <Box
                    component="img"
                    src={qrRoomDataUrl}
                    alt={`QR code ${qrRoomTarget.name}`}
                    sx={{ width: 224, height: 224, display: "block" }}
                  />
                ) : null}
              </Box>
              <Typography variant="subtitle1" sx={{ alignSelf: "stretch", wordBreak: "break-word" }}>
                {qrRoomTarget.name}
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ alignSelf: "stretch", wordBreak: "break-word" }}>
                {buildRoomShareUrl(qrRoomTarget.id, sessionLanUrl)}
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setQrRoomTarget(null);
            }}
          >
            Chiudi
          </Button>
          <Button
            onClick={() => {
              if (!qrRoomTarget) {
                return;
              }

              void copyTextToClipboard(buildRoomShareUrl(qrRoomTarget.id, sessionLanUrl))
                .then(() => {
                  setSnackbar("Link stanza copiato.");
                })
                .catch(() => {
                  setSnackbar("Copia link non disponibile.");
                });
            }}
          >
            Copia link
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
