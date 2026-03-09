import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { resolvePlaybackPosition } from "../../shared/playback";
import type { LanIdentity, LibraryItem, RoomChatMessage, StreamRoomDetail } from "../../shared/types";
import { NicknameDialog } from "../components/NicknameDialog";
import { PageHeader } from "../components/PageHeader";
import { copyTextToClipboard } from "../lib/clipboard";
import { createIdentityFromNickname, persistIdentity, readStoredIdentity } from "../lib/identity";
import {
  deleteStreamRoom,
  fetchItems,
  fetchStreamRoom,
  openLanEvents,
  sendRoomMessage,
  setStreamRoomVideo,
  updateStreamRoomPlayback
} from "../lib/api";

type LiveState = "live" | "fallback" | "connecting";

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function buildRoomShareUrl(roomId: string) {
  const shareUrl = new URL(window.location.href);
  shareUrl.pathname = `/stream/room/${roomId}`;
  shareUrl.search = "";
  shareUrl.hash = "";
  return shareUrl.toString();
}

export function StreamRoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<LanIdentity | null>(() => readStoredIdentity());
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(() => readStoredIdentity() === null);
  const [room, setRoom] = useState<StreamRoomDetail | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [liveState, setLiveState] = useState<LiveState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingVideo, setUpdatingVideo] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState(false);
  const [isPlayerMuted, setIsPlayerMuted] = useState(true);
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const suppressVideoEventsUntilRef = useRef(0);

  const videoItems = useMemo(() => items.filter((item) => item.kind === "video"), [items]);
  const roomMessages = room?.messages ?? [];
  const shareUrl = roomId ? buildRoomShareUrl(roomId) : "";

  async function syncRoom() {
    if (!roomId) {
      setLoading(false);
      setError("Stanza non trovata.");
      return;
    }

    try {
      const [roomResponse, allItems] = await Promise.all([fetchStreamRoom(roomId), fetchItems()]);

      startTransition(() => {
        setRoom(roomResponse.room);
        setItems(allItems);
        setError(null);
        setLoading(false);
      });
    } catch (nextError) {
      startTransition(() => {
        setRoom(null);
        setLoading(false);
        setError(nextError instanceof Error && nextError.message.includes("404") ? "Stanza non trovata." : "Impossibile caricare la stanza.");
      });
    }
  }

  useEffect(() => {
    void syncRoom();
  }, [roomId]);

  useEffect(() => {
    let pollingId: number | undefined;

    const source = openLanEvents(
      {
        "stream-room-updated": () => {
          setLiveState("live");
          void syncRoom();
        },
        "stream-room-chat-updated": () => {
          setLiveState("live");
          void syncRoom();
        },
        "stream-room-deleted": () => {
          setLiveState("live");
          void syncRoom();
        },
        "library-updated": () => {
          setLiveState("live");
          void syncRoom();
        }
      },
      () => {
        setLiveState("fallback");
        pollingId = window.setInterval(() => {
          void syncRoom();
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
  }, [roomId]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !room?.videoItem?.streamUrl) {
      return;
    }

    const applyState = () => {
      const targetTime = resolvePlaybackPosition(room.playback, new Date());
      suppressVideoEventsUntilRef.current = performance.now() + 180;
      video.muted = isPlayerMuted;

      if (Math.abs(video.currentTime - targetTime) > 0.75) {
        try {
          video.currentTime = targetTime;
        } catch {
          // Ignored until metadata is ready.
        }
      }

      if (room.playback.status === "playing") {
        void video.play().catch(() => {
          setSnackbar("Riproduzione automatica bloccata dal browser. Premi Play per riprendere.");
        });
        return;
      }

      video.pause();
    };

    if (video.readyState >= 1) {
      applyState();
      return;
    }

    const handleLoadedMetadata = () => {
      applyState();
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [
    room?.playback.positionSeconds,
    room?.playback.startedAt,
    room?.playback.status,
    room?.playback.videoItemId,
    room?.videoItem?.streamUrl,
    isPlayerMuted
  ]);

  async function handlePlaybackAction(action: "play" | "pause" | "seek") {
    const video = videoRef.current;

    if (!roomId || !room || !video) {
      return;
    }

    if (performance.now() < suppressVideoEventsUntilRef.current) {
      return;
    }

    try {
      const response = await updateStreamRoomPlayback(roomId, action, video.currentTime);
      setRoom(response.room);
    } catch {
      setSnackbar("Sync playback non riuscito.");
    }
  }

  async function handleSelectVideo(videoItemId: string) {
    if (!roomId) {
      return;
    }

    setUpdatingVideo(true);

    try {
      const response = await setStreamRoomVideo(roomId, videoItemId);
      setRoom(response.room);
      setSnackbar("Video stanza aggiornato.");
    } catch {
      setSnackbar("Selezione video non riuscita.");
    } finally {
      setUpdatingVideo(false);
    }
  }

  async function handleSendMessage() {
    if (!roomId) {
      return;
    }

    if (!identity) {
      setNicknameDialogOpen(true);
      return;
    }

    const text = messageText.trim();

    if (!text) {
      return;
    }

    setSendingMessage(true);

    try {
      await sendRoomMessage(roomId, identity, text);
      setMessageText("");
      await syncRoom();
    } catch {
      setSnackbar("Invio messaggio non riuscito.");
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleDeleteRoom() {
    if (!roomId) {
      return;
    }

    setDeletingRoom(true);

    try {
      await deleteStreamRoom(roomId);
      navigate("/stream", { replace: true });
    } catch {
      setSnackbar("Eliminazione stanza non riuscita.");
      setDeletingRoom(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Typography color="text.secondary">Caricamento stanza...</Typography>
      </Box>
    );
  }

  if (error || !room) {
    return (
      <Box sx={{ pb: 7 }}>
        <Container maxWidth="md" sx={{ pt: { xs: 2, md: 3 } }}>
          <PageHeader title="Streaming" subtitle="Watch party locale" />
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Alert severity="error">{error ?? "Stanza non trovata."}</Alert>
                <Button component={RouterLink} to="/stream" variant="contained">
                  Torna alle stanze
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader
          title={room.name}
          subtitle="Stanza streaming sincronizzata"
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
          <Card>
            <CardContent>
              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={2}
                alignItems={{ xs: "flex-start", lg: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Avatar sx={{ bgcolor: alpha("#1769aa", 0.12), color: "primary.main", width: 40, height: 40 }}>
                      <MeetingRoomRoundedIcon />
                    </Avatar>
                    <Typography variant="h5">{room.name}</Typography>
                  </Stack>
                  <Typography color="text.secondary">
                    Link diretto stanza: {shareUrl}
                  </Typography>
                </Box>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                  <Chip label={room.playback.status === "playing" ? "In riproduzione" : "In pausa"} />
                  <Chip label={identity ? `Nickname: ${identity.nickname}` : "Nickname richiesto"} />
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopyRoundedIcon />}
                    onClick={() => {
                      void copyTextToClipboard(shareUrl)
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
                  <Button
                    variant="outlined"
                    startIcon={<EditRoundedIcon />}
                    onClick={() => {
                      setNicknameDialogOpen(true);
                    }}
                  >
                    Modifica nickname
                  </Button>
                  <Button
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteRoundedIcon />}
                    disabled={deletingRoom}
                    onClick={() => {
                      void handleDeleteRoom();
                    }}
                  >
                    Elimina stanza
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {liveState === "fallback" ? (
            <Alert severity="warning">Connessione live non disponibile. Sto usando refresh periodico per lo stato stanza.</Alert>
          ) : null}

          <Box
            sx={{
              display: "grid",
              gap: 2.5,
              alignItems: "start",
              gridTemplateColumns: { xs: "1fr", xl: "1.25fr 0.75fr" }
            }}
          >
            <Stack spacing={2.5}>
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      justifyContent="space-between"
                      alignItems={{ xs: "stretch", sm: "center" }}
                    >
                      <Box>
                        <Typography variant="h5">Player condiviso</Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                          Chiunque nella stanza puo cambiare video, play, pausa e seek per tutti.
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip icon={<MovieRoundedIcon />} label={room.currentVideoName ?? "Nessun video"} />
                        <Chip label={room.messageCount === 1 ? "1 messaggio" : `${room.messageCount} messaggi`} />
                      </Stack>
                    </Stack>

                    <FormControl fullWidth>
                      <InputLabel id="stream-room-video-label">Video stanza</InputLabel>
                      <Select
                        labelId="stream-room-video-label"
                        label="Video stanza"
                        value={room.videoItem?.id ?? ""}
                        disabled={updatingVideo || videoItems.length === 0}
                        onChange={(event) => {
                          void handleSelectVideo(event.target.value);
                        }}
                      >
                        {videoItems.map((item) => (
                          <MenuItem key={item.id} value={item.id}>
                            {item.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {room.videoItem?.streamUrl ? (
                      <Box
                        sx={{
                          borderRadius: 4,
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.08)",
                          bgcolor: "#000"
                        }}
                      >
                        <Box
                          key={room.videoItem.id}
                          component="video"
                          ref={videoRef}
                          autoPlay
                          controls
                          muted={isPlayerMuted}
                          playsInline
                          src={room.videoItem.streamUrl}
                          aria-label={`Stanza video ${room.videoItem.name}`}
                          onVolumeChange={() => {
                            setIsPlayerMuted(videoRef.current?.muted ?? true);
                          }}
                          onPlay={() => {
                            void handlePlaybackAction("play");
                          }}
                          onPause={() => {
                            void handlePlaybackAction("pause");
                          }}
                          onSeeked={() => {
                            void handlePlaybackAction("seek");
                          }}
                          sx={{
                            width: "100%",
                            maxHeight: "calc(100vh - 180px)",
                            display: "block",
                            bgcolor: "#000",
                            objectFit: "contain"
                          }}
                        />
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          minHeight: 260,
                          display: "grid",
                          placeItems: "center",
                          borderRadius: 4,
                          bgcolor: "#09131d",
                          border: "1px solid rgba(255,255,255,0.08)",
                          p: 3,
                          textAlign: "center"
                        }}
                      >
                        <Stack spacing={1.5} alignItems="center">
                          <Avatar sx={{ bgcolor: alpha("#0f9d94", 0.18), color: "#8ae6da" }}>
                            <MovieRoundedIcon />
                          </Avatar>
                          <Typography color="common.white" variant="h6">
                            Seleziona un video per iniziare la stanza
                          </Typography>
                          <Typography color="rgba(255,255,255,0.72)">
                            I contenuti arrivano dalla libreria Routeroom gia caricata sull’host.
                          </Typography>
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>

            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h5">Chat stanza</Typography>
                  <Box
                    sx={{
                      minHeight: 320,
                      maxHeight: 420,
                      overflowY: "auto",
                      p: 1,
                      borderRadius: 4,
                      bgcolor: alpha("#10273a", 0.02),
                      border: `1px solid ${alpha("#1769aa", 0.08)}`
                    }}
                  >
                    {roomMessages.length === 0 ? (
                      <Typography color="text.secondary">Nessun messaggio nella stanza.</Typography>
                    ) : (
                      <Stack spacing={1.25}>
                        {roomMessages.map((message: RoomChatMessage) => {
                          const isOwnMessage = identity?.id === message.identity.id;

                          return (
                            <Box
                              key={message.id}
                              sx={{
                                alignSelf: isOwnMessage ? "flex-end" : "flex-start",
                                maxWidth: "100%"
                              }}
                            >
                              <Card
                                variant="outlined"
                                sx={{
                                  bgcolor: isOwnMessage ? alpha("#1769aa", 0.08) : "background.paper",
                                  borderColor: isOwnMessage ? alpha("#1769aa", 0.16) : alpha("#10273a", 0.06)
                                }}
                              >
                                <CardContent sx={{ p: 2 }}>
                                  <Stack spacing={0.75}>
                                    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="baseline">
                                      <Typography variant="subtitle2">{message.identity.nickname}</Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {formatMessageTime(message.sentAt)}
                                      </Typography>
                                    </Stack>
                                    <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                      {message.text}
                                    </Typography>
                                  </Stack>
                                </CardContent>
                              </Card>
                            </Box>
                          );
                        })}
                      </Stack>
                    )}
                  </Box>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "flex-end" }}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={4}
                      label="Messaggio stanza"
                      value={messageText}
                      onChange={(event) => {
                        setMessageText(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                          event.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      variant="contained"
                      startIcon={<SendRoundedIcon />}
                      disabled={sendingMessage || messageText.trim().length === 0}
                      onClick={() => {
                        void handleSendMessage();
                      }}
                    >
                      Invia
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Stack>
      </Container>

      <NicknameDialog
        open={nicknameDialogOpen}
        initialValue={identity?.nickname ?? ""}
        onClose={identity ? () => setNicknameDialogOpen(false) : undefined}
        onSave={(nickname) => {
          const nextIdentity = createIdentityFromNickname(nickname);
          persistIdentity(nextIdentity);
          setIdentity(nextIdentity);
          setNicknameDialogOpen(false);
          setSnackbar("Nickname aggiornato.");
        }}
      />

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={2600}
        onClose={() => {
          setSnackbar(null);
        }}
        message={snackbar}
      />
    </Box>
  );
}
