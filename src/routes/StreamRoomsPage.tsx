import { startTransition, useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
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
  Snackbar,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import type { LibraryItem, StreamRoomSummary } from "../../shared/types";
import { PageHeader } from "../components/PageHeader";
import { createStreamRoom, fetchItems, fetchStreamRooms, openLanEvents } from "../lib/api";

type LiveState = "live" | "fallback" | "connecting";

function formatRoomTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

export function StreamRoomsPage() {
  const [rooms, setRooms] = useState<StreamRoomSummary[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [liveState, setLiveState] = useState<LiveState>("connecting");
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const theme = useTheme();

  const videoItems = useMemo(() => items.filter((item) => item.kind === "video"), [items]);

  async function syncData() {
    const [roomsResponse, allItems] = await Promise.all([fetchStreamRooms(), fetchItems()]);

    startTransition(() => {
      setRooms(roomsResponse.rooms);
      setItems(allItems);
      setLoading(false);
    });
  }

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
                      gap: 2,
                      gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }
                    }}
                  >
                    {rooms.map((room) => (
                      <Card key={room.id} variant="outlined">
                        <CardContent>
                          <Stack spacing={2}>
                            <Stack direction="row" spacing={1.25} alignItems="center">
                              <Avatar sx={{ bgcolor: alpha("#1769aa", 0.12), color: "primary.main" }}>
                                <MeetingRoomRoundedIcon />
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="h6" sx={{ wordBreak: "break-word" }}>
                                  {room.name}
                                </Typography>
                                <Typography color="text.secondary" variant="body2">
                                  Aggiornata {formatRoomTime(room.updatedAt)}
                                </Typography>
                              </Box>
                            </Stack>

                            <Stack spacing={0.75}>
                              <Typography color="text.secondary" variant="body2">
                                Video corrente
                              </Typography>
                              <Typography>
                                {room.currentVideoName ?? "Nessun video selezionato"}
                              </Typography>
                            </Stack>

                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <Chip label={room.messageCount === 1 ? "1 messaggio" : `${room.messageCount} messaggi`} />
                              <Chip label={room.playback.status === "playing" ? "In riproduzione" : "In pausa"} />
                            </Stack>

                            <Button
                              component={RouterLink}
                              to={`/stream/room/${room.id}`}
                              variant="contained"
                              startIcon={<PlayArrowRoundedIcon />}
                            >
                              Entra nella stanza
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
    </Box>
  );
}
