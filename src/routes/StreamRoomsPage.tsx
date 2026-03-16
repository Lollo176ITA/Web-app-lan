import { startTransition, useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Container,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import { Link as RouterLink } from "react-router-dom";
import type { StreamRoomSummary } from "../../shared/types";
import { PageHeader } from "../components/PageHeader";
import { QrCodeDialog } from "../components/QrCodeDialog";
import { SectionHeader } from "../components/ui/SectionHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { SurfaceCard } from "../components/ui/SurfaceCard";
import { copyTextToClipboard } from "../lib/clipboard";
import { buildStreamRoomShareUrl } from "../lib/share-links";
import { useQrCodeDataUrl } from "../lib/useQrCodeDataUrl";
import { createStreamRoom, deleteStreamRoom, fetchSession, fetchStreamRooms } from "../lib/api";
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
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [rooms, setRooms] = useState<StreamRoomSummary[]>([]);
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [sessionLanUrl, setSessionLanUrl] = useState<string | null>(null);
  const [qrRoomTarget, setQrRoomTarget] = useState<StreamRoomSummary | null>(null);
  const qrRoomShareUrl = qrRoomTarget ? buildStreamRoomShareUrl(qrRoomTarget.id, sessionLanUrl) : null;
  const qrCodeDataUrl = useQrCodeDataUrl(qrRoomShareUrl, { width: 256 });

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
    const [roomsResponse, session] = await Promise.all([fetchStreamRooms(), fetchSession()]);

    startTransition(() => {
      setRooms(roomsResponse.rooms);
      setSessionLanUrl(session.lanUrl);
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

  const columns: GridColDef<StreamRoomSummary>[] = [
    {
      field: "name",
      headerName: "Stanza",
      minWidth: 220,
      flex: 1.1,
      renderCell: (params: GridRenderCellParams<StreamRoomSummary>) => (
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar sx={{ bgcolor: theme.app.kind.folder.soft, color: "primary.main" }}>
            <MeetingRoomRoundedIcon />
          </Avatar>
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography fontWeight={700} noWrap>
              {params.row.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              Aggiornata {formatRoomTime(params.row.updatedAt)}
            </Typography>
          </Stack>
        </Stack>
      )
    },
    {
      field: "currentVideoName",
      headerName: "Video corrente",
      minWidth: 220,
      flex: 1,
      renderCell: (params: GridRenderCellParams<StreamRoomSummary>) => (
        <Typography variant="body2" color="text.secondary">
          {params.row.currentVideoName ?? "Nessun video selezionato"}
        </Typography>
      )
    },
    {
      field: "messageCount",
      headerName: "Chat",
      width: 120,
      renderCell: (params: GridRenderCellParams<StreamRoomSummary>) => (
        <Typography variant="body2">
          {params.row.messageCount === 1 ? "1 messaggio" : `${params.row.messageCount} messaggi`}
        </Typography>
      )
    },
    {
      field: "playback",
      headerName: "Playback",
      width: 170,
      sortable: false,
      renderCell: (params: GridRenderCellParams<StreamRoomSummary>) => (
        <StatusBadge
          status={params.row.playback.status === "playing" ? "pass" : "info"}
          label={params.row.playback.status === "playing" ? "In riproduzione" : "In pausa"}
        />
      )
    },
    {
      field: "actions",
      headerName: "Azioni",
      minWidth: 250,
      flex: 0.9,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<StreamRoomSummary>) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <IconButton
            size="small"
            aria-label={`Mostra QR code stanza ${params.row.name}`}
            onClick={() => {
              setQrRoomTarget(params.row);
            }}
          >
            <QrCode2RoundedIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label={`Elimina stanza ${params.row.name}`}
            disabled={deletingRoomId === params.row.id}
            onClick={() => {
              void handleDeleteRoom(params.row.id);
            }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
          <Button
            component={RouterLink}
            to={`/stream/room/${params.row.id}`}
            size="small"
            variant="contained"
            startIcon={<OpenInNewRoundedIcon />}
          >
            Apri
          </Button>
        </Stack>
      )
    }
  ];

  return (
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Stanze Streaming" subtitle="Watch party locale" networkState={liveState} />

        <Stack spacing={3} sx={{ mt: 3 }}>
          <SurfaceCard>
            <Box sx={{ p: { xs: 2.25, md: 3 } }}>
              <SectionHeader
                eyebrow="Nuova room"
                title="Nuova stanza pubblica"
                description="Crea una watch room e condividila subito con gli altri device nella LAN."
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 2 }}>
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
            </Box>
          </SurfaceCard>

          {liveState === "fallback" ? (
            <Alert severity="warning">Connessione live non disponibile. Sto aggiornando l’elenco con polling.</Alert>
          ) : null}

          <SurfaceCard tone="sunken">
            <Box sx={{ p: { xs: 2.25, md: 3 } }}>
              <SectionHeader
                eyebrow="Rooms"
                title="Elenco stanze"
                description="Apri una stanza esistente, condividi il QR o rimuovi una watch room non più necessaria."
              />
            </Box>

            {loading ? (
              <Box sx={{ px: 3, pb: 3 }}>
                <Typography color="text.secondary">Caricamento stanze...</Typography>
              </Box>
            ) : rooms.length === 0 ? (
              <Box sx={{ px: 3, pb: 3 }}>
                <Typography color="text.secondary">Nessuna stanza attiva. Crea la prima watch room.</Typography>
              </Box>
            ) : isMobile ? (
              <Box
                sx={{
                  px: 2.25,
                  pb: 2.25,
                  display: "grid",
                  gap: 1.25,
                  gridTemplateColumns: "1fr"
                }}
              >
                {rooms.map((room) => (
                  <SurfaceCard key={room.id} tone="overlay">
                    <Box sx={{ p: 2 }}>
                      <Stack spacing={1.25}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                            <Avatar sx={{ bgcolor: alpha("#1769aa", 0.12), color: "primary.main" }}>
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
                          <Stack direction="row" spacing={0.25}>
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
                        </Stack>

                        <Typography variant="body2" color="text.secondary">
                          {room.currentVideoName ?? "Nessun video selezionato"}
                        </Typography>

                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          <StatusBadge
                            status={room.playback.status === "playing" ? "pass" : "info"}
                            label={room.playback.status === "playing" ? "In riproduzione" : "In pausa"}
                          />
                          <StatusBadge
                            status="info"
                            label={room.messageCount === 1 ? "1 messaggio" : `${room.messageCount} messaggi`}
                          />
                        </Stack>

                        <Button
                          component={RouterLink}
                          to={`/stream/room/${room.id}`}
                          variant="contained"
                          startIcon={<PlayArrowRoundedIcon />}
                          fullWidth
                        >
                          Apri stanza
                        </Button>
                      </Stack>
                    </Box>
                  </SurfaceCard>
                ))}
              </Box>
            ) : (
              <Box sx={{ height: 460, px: 2, pb: 2 }}>
                <DataGrid
                  aria-label="Tabella stanze streaming"
                  rows={rooms}
                  columns={columns}
                  getRowHeight={() => 82}
                  hideFooter
                  disableColumnMenu
                  disableRowSelectionOnClick
                  rowSelection={false}
                  sx={{ border: "none" }}
                />
              </Box>
            )}
          </SurfaceCard>
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
        open={Boolean(qrRoomTarget)}
        onClose={() => {
          setQrRoomTarget(null);
        }}
        title="QR code stanza streaming"
        description="Condividi questo codice nella stessa LAN per aprire direttamente la watch room."
        qrCodeAlt={`QR code stanza ${qrRoomTarget?.name ?? ""}`}
        qrCodeDataUrl={qrCodeDataUrl}
        subject={qrRoomTarget?.name}
        url={qrRoomShareUrl}
        onCopy={
          qrRoomShareUrl
            ? () => {
                void copyTextToClipboard(qrRoomShareUrl)
                  .then(() => {
                    setSnackbar("Link stanza copiato.");
                  })
                  .catch(() => {
                    setSnackbar("Copia link non disponibile.");
                  });
              }
            : undefined
        }
        actionHref={qrRoomShareUrl ?? undefined}
        actionLabel={qrRoomTarget ? "Apri stanza" : undefined}
        actionIcon={<OpenInNewRoundedIcon />}
        onAction={() => {
          setQrRoomTarget(null);
        }}
      />
    </Box>
  );
}
