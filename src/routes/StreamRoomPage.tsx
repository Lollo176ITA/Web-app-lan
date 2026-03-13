import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
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
  IconButton,
  InputAdornment,
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
import type { LanIdentity, LibraryItem, RoomChatMessage, ScreenShareSignalEvent, StreamRoomDetail } from "../../shared/types";
import { PageHeader } from "../components/PageHeader";
import { copyTextToClipboard } from "../lib/clipboard";
import { useIdentity } from "../lib/identity-context";
import {
  deleteStreamRoom,
  fetchItems,
  fetchSession,
  fetchStreamRoom,
  joinScreenShare,
  sendRoomMessage,
  sendScreenShareSignal,
  setStreamRoomVideo,
  startScreenShare,
  stopScreenShare,
  updateStreamRoomPlayback
} from "../lib/api";
import { createLanShareUrl, resolvePreferredSessionUrl } from "../lib/share-url";
import { useLanLiveState } from "../lib/useLanLiveState";

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function buildRoomShareUrl(roomId: string, lanUrl?: string | null) {
  const shareUrl = createLanShareUrl(lanUrl);
  shareUrl.pathname = `/stream/room/${roomId}`;
  shareUrl.search = "";
  shareUrl.hash = "";
  return shareUrl.toString();
}

function detectScreenShareSupportError() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "La presentazione schermo e disponibile solo nel browser.";
  }

  if (!window.isSecureContext) {
    return "La presentazione schermo richiede un contesto sicuro: usa Routy in localhost, nell'app desktop Electron oppure via HTTPS.";
  }

  if (typeof window.RTCPeerConnection === "undefined") {
    return "Questo browser non supporta WebRTC per la presentazione.";
  }

  if (typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
    return "Questo browser non supporta la condivisione schermo.";
  }

  const userAgent = navigator.userAgent.toLowerCase();

  if (/android|iphone|ipad|mobile/.test(userAgent)) {
    return "Per condividere lo schermo con audio serve un browser desktop.";
  }

  if (!/(chrome|chromium|edg)\//.test(userAgent)) {
    return "Per condividere lo schermo con audio usa Chrome o Edge desktop.";
  }

  return null;
}

function serializeIceCandidate(candidate: RTCIceCandidate) {
  if (typeof candidate.toJSON === "function") {
    return candidate.toJSON();
  }

  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment ?? undefined
  };
}

function isScreenShareSignalEvent(value: unknown): value is ScreenShareSignalEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ScreenShareSignalEvent).roomId === "string" &&
    typeof (value as ScreenShareSignalEvent).sessionId === "string" &&
    typeof (value as ScreenShareSignalEvent).targetUserId === "string" &&
    typeof (value as ScreenShareSignalEvent).kind === "string" &&
    typeof (value as ScreenShareSignalEvent).fromIdentity?.id === "string" &&
    typeof (value as ScreenShareSignalEvent).fromIdentity?.nickname === "string"
  );
}

export function StreamRoomPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const [room, setRoom] = useState<StreamRoomDetail | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingVideo, setUpdatingVideo] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState(false);
  const [sessionLanUrl, setSessionLanUrl] = useState<string | null>(null);
  const [startingScreenShare, setStartingScreenShare] = useState(false);
  const [stoppingScreenShare, setStoppingScreenShare] = useState(false);
  const [isPlayerMuted, setIsPlayerMuted] = useState(true);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const roomRef = useRef<StreamRoomDetail | null>(null);
  const identityRef = useRef(identity);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const viewerPeerRef = useRef<RTCPeerConnection | null>(null);
  const presenterPeersRef = useRef(new Map<string, RTCPeerConnection>());
  const joinedScreenSessionRef = useRef<string | null>(null);
  const suppressVideoEventsUntilRef = useRef(0);
  const screenStopInFlightRef = useRef(false);

  const videoItems = useMemo(() => items.filter((item) => item.kind === "video"), [items]);
  const roomMessages = room?.messages ?? [];
  const shareUrl = roomId ? buildRoomShareUrl(roomId, sessionLanUrl) : "";
  const screenShareSupportError = useMemo(() => detectScreenShareSupportError(), []);
  const isLiveScreenRoom = room?.sourceMode === "screen" && room.screenShare.status === "live";
  const presenter = room?.screenShare.presenter ?? null;
  const isActivePresenter = Boolean(isLiveScreenRoom && presenter && identity && presenter.id === identity.id);
  const activeScreenStream = isActivePresenter ? localScreenStream : remoteScreenStream;

  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  function applyRoom(nextRoom: StreamRoomDetail | null) {
    roomRef.current = nextRoom;
    setRoom(nextRoom);
  }

  function resetRemoteScreenStream() {
    setRemoteScreenStream(null);
  }

  function releaseLocalScreenStream() {
    const current = localScreenStreamRef.current;

    if (current) {
      current.getTracks().forEach((track) => {
        track.stop();
      });
    }

    localScreenStreamRef.current = null;
    setLocalScreenStream(null);
  }

  function replaceLocalScreenStream(stream: MediaStream | null) {
    if (localScreenStreamRef.current && localScreenStreamRef.current !== stream) {
      localScreenStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
    }

    localScreenStreamRef.current = stream;
    setLocalScreenStream(stream);
  }

  function destroyViewerPeer() {
    const peer = viewerPeerRef.current;

    if (!peer) {
      resetRemoteScreenStream();
      return;
    }

    viewerPeerRef.current = null;
    peer.onicecandidate = null;
    peer.ontrack = null;
    peer.onconnectionstatechange = null;
    peer.close();
    resetRemoteScreenStream();
  }

  function destroyPresenterPeers() {
    for (const peer of presenterPeersRef.current.values()) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
    }

    presenterPeersRef.current.clear();
  }

  async function emitScreenSignal(
    sessionId: string,
    targetUserId: string,
    kind: "offer" | "answer" | "ice-candidate" | "hangup",
    payload: unknown
  ) {
    const currentIdentity = identityRef.current;

    if (!roomId || !currentIdentity) {
      return;
    }

    try {
      await sendScreenShareSignal(roomId, currentIdentity, sessionId, targetUserId, kind, payload);
    } catch {
      setSnackbar("Segnalazione live non riuscita.");
    }
  }

  function createPresenterPeer(targetIdentity: LanIdentity, sessionId: string) {
    const existingPeer = presenterPeersRef.current.get(targetIdentity.id);

    if (existingPeer) {
      return existingPeer;
    }

    const localStream = localScreenStreamRef.current;

    if (!localStream) {
      return null;
    }

    const peer = new RTCPeerConnection();
    localStream.getTracks().forEach((track) => {
      peer.addTrack(track, localStream);
    });

    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      void emitScreenSignal(sessionId, targetIdentity.id, "ice-candidate", serializeIceCandidate(event.candidate));
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed" || peer.connectionState === "closed") {
        presenterPeersRef.current.delete(targetIdentity.id);
        peer.close();
      }
    };

    presenterPeersRef.current.set(targetIdentity.id, peer);
    return peer;
  }

  function createViewerPeer(presenterIdentity: LanIdentity, sessionId: string) {
    if (viewerPeerRef.current) {
      return viewerPeerRef.current;
    }

    const peer = new RTCPeerConnection();

    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      void emitScreenSignal(sessionId, presenterIdentity.id, "ice-candidate", serializeIceCandidate(event.candidate));
    };

    peer.ontrack = (event) => {
      const [stream] = event.streams;

      if (stream) {
        setRemoteScreenStream(stream);
        return;
      }

      setRemoteScreenStream(new MediaStream([event.track]));
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed" || peer.connectionState === "closed") {
        destroyViewerPeer();
      }
    };

    viewerPeerRef.current = peer;
    return peer;
  }

  async function handleIncomingSignal(payload?: unknown) {
    const currentIdentity = identityRef.current;

    if (!roomId || !currentIdentity || !isScreenShareSignalEvent(payload)) {
      return;
    }

    if (payload.roomId !== roomId || payload.targetUserId !== currentIdentity.id) {
      return;
    }

    const currentRoom = roomRef.current;

    if (
      !currentRoom ||
      currentRoom.sourceMode !== "screen" ||
      currentRoom.screenShare.status !== "live" ||
      currentRoom.screenShare.sessionId !== payload.sessionId
    ) {
      return;
    }

    try {
      if (currentRoom.screenShare.presenter?.id === currentIdentity.id) {
        if (payload.kind === "join-request") {
          const peer = createPresenterPeer(payload.fromIdentity, payload.sessionId);

          if (!peer) {
            return;
          }

          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          await emitScreenSignal(payload.sessionId, payload.fromIdentity.id, "offer", {
            type: offer.type,
            sdp: offer.sdp
          });
          return;
        }

        if (payload.kind === "answer") {
          const peer = presenterPeersRef.current.get(payload.fromIdentity.id);

          if (!peer) {
            return;
          }

          await peer.setRemoteDescription(payload.payload as RTCSessionDescriptionInit);
          return;
        }

        if (payload.kind === "ice-candidate") {
          const peer = presenterPeersRef.current.get(payload.fromIdentity.id);

          if (!peer || !payload.payload) {
            return;
          }

          await peer.addIceCandidate(payload.payload as RTCIceCandidateInit);
          return;
        }

        if (payload.kind === "hangup") {
          const peer = presenterPeersRef.current.get(payload.fromIdentity.id);

          if (!peer) {
            return;
          }

          presenterPeersRef.current.delete(payload.fromIdentity.id);
          peer.close();
        }

        return;
      }

      const currentPresenter = currentRoom.screenShare.presenter;

      if (!currentPresenter || payload.fromIdentity.id !== currentPresenter.id) {
        return;
      }

      if (payload.kind === "offer") {
        const peer = createViewerPeer(currentPresenter, payload.sessionId);
        await peer.setRemoteDescription(payload.payload as RTCSessionDescriptionInit);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await emitScreenSignal(payload.sessionId, currentPresenter.id, "answer", {
          type: answer.type,
          sdp: answer.sdp
        });
        return;
      }

      if (payload.kind === "ice-candidate" && payload.payload) {
        const peer = createViewerPeer(currentPresenter, payload.sessionId);
        await peer.addIceCandidate(payload.payload as RTCIceCandidateInit);
        return;
      }

      if (payload.kind === "hangup") {
        destroyViewerPeer();
      }
    } catch {
      setSnackbar("Connessione live non riuscita.");
    }
  }

  const liveState = useLanLiveState(
    {
      handlers: {
        "stream-room-updated": () => {
          void syncRoom();
        },
        "stream-room-chat-updated": () => {
          void syncRoom();
        },
        "stream-room-deleted": () => {
          void syncRoom();
        },
        "stream-room-signal": (payload) => {
          void handleIncomingSignal(payload);
        },
        "library-updated": () => {
          void syncRoom();
        }
      },
      onFallback: () => {
        const pollingId = window.setInterval(() => {
          void syncRoom();
        }, 15000);

        return () => {
          window.clearInterval(pollingId);
        };
      }
    },
    [roomId]
  );

  async function syncRoom() {
    if (!roomId) {
      setLoading(false);
      setError("Stanza non trovata.");
      return;
    }

    try {
      const [roomResponse, allItems, session] = await Promise.all([fetchStreamRoom(roomId), fetchItems(), fetchSession()]);
      roomRef.current = roomResponse.room;

      startTransition(() => {
        setRoom(roomResponse.room);
        setItems(allItems);
        setSessionLanUrl(resolvePreferredSessionUrl(session));
        setError(null);
        setLoading(false);
      });
    } catch (nextError) {
      roomRef.current = null;
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
    const video = videoRef.current;

    if (!video || !room?.videoItem?.streamUrl || room.sourceMode !== "video") {
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
    room?.sourceMode,
    isPlayerMuted
  ]);

  useEffect(() => {
    const screenVideo = screenVideoRef.current;

    if (!screenVideo) {
      return;
    }

    if (!isLiveScreenRoom || !activeScreenStream) {
      screenVideo.srcObject = null;
      return;
    }

    if (screenVideo.srcObject !== activeScreenStream) {
      screenVideo.srcObject = activeScreenStream;
    }

    void screenVideo.play().catch(() => {
      if (!isActivePresenter) {
        setSnackbar("Riproduzione live bloccata dal browser. Premi Play per avviare il feed.");
      }
    });
  }, [activeScreenStream, isActivePresenter, isLiveScreenRoom]);

  useEffect(() => {
    if (room?.sourceMode === "screen" && room.screenShare.status === "live") {
      return;
    }

    joinedScreenSessionRef.current = null;
    destroyViewerPeer();
    destroyPresenterPeers();
    releaseLocalScreenStream();
  }, [room?.sourceMode, room?.screenShare.sessionId, room?.screenShare.status]);

  useEffect(() => {
    if (!roomId || !identity || !room || room.sourceMode !== "screen" || room.screenShare.status !== "live") {
      return;
    }

    if (!room.screenShare.sessionId || room.screenShare.presenter?.id === identity.id) {
      return;
    }

    if (joinedScreenSessionRef.current === room.screenShare.sessionId) {
      return;
    }

    joinedScreenSessionRef.current = room.screenShare.sessionId;

    void joinScreenShare(roomId, identity, room.screenShare.sessionId).catch(() => {
      joinedScreenSessionRef.current = null;
      setSnackbar("Connessione alla presentazione non riuscita.");
    });
  }, [
    roomId,
    room?.screenShare.presenter?.id,
    room?.screenShare.sessionId,
    room?.screenShare.status,
    room?.sourceMode,
    identity,
    identity?.id
  ]);

  useEffect(() => {
    return () => {
      const currentRoom = roomRef.current;
      const currentIdentity = identityRef.current;

      if (
        roomId &&
        currentRoom?.sourceMode === "screen" &&
        currentRoom.screenShare.status === "live" &&
        currentRoom.screenShare.presenter?.id === currentIdentity?.id &&
        currentRoom.screenShare.sessionId &&
        typeof navigator.sendBeacon === "function"
      ) {
        const body = JSON.stringify({
          identity: currentIdentity,
          sessionId: currentRoom.screenShare.sessionId
        });

        navigator.sendBeacon(
          `/api/stream/rooms/${roomId}/screen-share/stop`,
          new Blob([body], { type: "application/json" })
        );
      }

      destroyViewerPeer();
      destroyPresenterPeers();
      releaseLocalScreenStream();
    };
  }, [roomId]);

  async function handlePlaybackAction(action: "play" | "pause" | "seek") {
    const video = videoRef.current;

    if (!roomId || !room || !video || room.sourceMode !== "video") {
      return;
    }

    if (performance.now() < suppressVideoEventsUntilRef.current) {
      return;
    }

    try {
      const response = await updateStreamRoomPlayback(roomId, action, video.currentTime);
      applyRoom(response.room);
    } catch {
      setSnackbar("Sync playback non riuscito.");
    }
  }

  async function handleSelectVideo(videoItemId: string) {
    if (!roomId || room?.sourceMode === "screen") {
      return;
    }

    setUpdatingVideo(true);

    try {
      const response = await setStreamRoomVideo(roomId, videoItemId);
      applyRoom(response.room);
      setSnackbar("Video stanza aggiornato.");
    } catch {
      setSnackbar("Selezione video non riuscita.");
    } finally {
      setUpdatingVideo(false);
    }
  }

  async function handleStartScreenShare() {
    if (!roomId || !identity || !room) {
      return;
    }

    if (room.sourceMode === "screen") {
      setSnackbar("La stanza ha gia una presentazione attiva.");
      return;
    }

    if (screenShareSupportError) {
      setSnackbar(screenShareSupportError);
      return;
    }

    setStartingScreenShare(true);

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      if (stream.getAudioTracks().length === 0) {
        throw new Error("missing-audio");
      }

      const response = await startScreenShare(roomId, identity, true);
      replaceLocalScreenStream(stream);

      stream.getTracks().forEach((track) => {
        track.addEventListener(
          "ended",
          () => {
            const currentRoom = roomRef.current;
            const currentIdentity = identityRef.current;

            if (
              !currentRoom ||
              currentRoom.sourceMode !== "screen" ||
              currentRoom.screenShare.status !== "live" ||
              currentRoom.screenShare.presenter?.id !== currentIdentity?.id
            ) {
              return;
            }

            void handleStopScreenShare(true);
          },
          { once: true }
        );
      });

      applyRoom(response.room);
      setSnackbar("Presentazione schermo avviata.");
    } catch (nextError) {
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }

      if (nextError instanceof Error && nextError.message === "missing-audio") {
        setSnackbar("Condividi anche l'audio del sistema o della tab: senza traccia audio la presentazione non parte.");
      } else if (nextError instanceof Error && nextError.message.includes("409")) {
        setSnackbar("C'e gia una presentazione attiva in questa stanza.");
      } else {
        setSnackbar("Avvio presentazione non riuscito.");
      }
    } finally {
      setStartingScreenShare(false);
    }
  }

  async function handleStopScreenShare(triggeredByTrackEnd = false) {
    if (screenStopInFlightRef.current) {
      return;
    }

    const currentRoom = roomRef.current;
    const currentIdentity = identityRef.current;

    if (
      !roomId ||
      !currentRoom ||
      currentRoom.sourceMode !== "screen" ||
      currentRoom.screenShare.status !== "live" ||
      !currentRoom.screenShare.sessionId ||
      !currentIdentity ||
      currentRoom.screenShare.presenter?.id !== currentIdentity.id
    ) {
      destroyPresenterPeers();
      releaseLocalScreenStream();
      return;
    }

    screenStopInFlightRef.current = true;

    if (!triggeredByTrackEnd) {
      setStoppingScreenShare(true);
    }

    try {
      const response = await stopScreenShare(roomId, currentIdentity, currentRoom.screenShare.sessionId);
      applyRoom(response.room);
      destroyPresenterPeers();
      destroyViewerPeer();
      releaseLocalScreenStream();
      joinedScreenSessionRef.current = null;

      if (!triggeredByTrackEnd) {
        setSnackbar("Presentazione terminata.");
      }
    } catch {
      destroyPresenterPeers();
      destroyViewerPeer();
      releaseLocalScreenStream();
      joinedScreenSessionRef.current = null;

      if (!triggeredByTrackEnd) {
        setSnackbar("Stop presentazione non riuscito.");
      }
    } finally {
      screenStopInFlightRef.current = false;

      if (!triggeredByTrackEnd) {
        setStoppingScreenShare(false);
      }
    }
  }

  async function handleSendMessage() {
    if (!roomId || !identity) {
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
        <PageHeader title={room.name} subtitle="Stanza streaming sincronizzata" networkState={liveState} />

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
                  <Chip
                    color={room.sourceMode === "screen" ? "secondary" : "default"}
                    label={room.sourceMode === "screen" ? "Schermo live" : room.playback.status === "playing" ? "In riproduzione" : "In pausa"}
                  />
                  {room.sourceMode === "screen" && room.screenShare.presenter ? (
                    <Chip label={`Presenter: ${room.screenShare.presenter.nickname}`} />
                  ) : null}
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
                        <Typography variant="h5">
                          {room.sourceMode === "screen" ? "Presentazione schermo" : "Player condiviso"}
                        </Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                          {room.sourceMode === "screen"
                            ? isActivePresenter
                              ? "Stai condividendo il tuo schermo con audio. Gli altri utenti restano in sola visione e chat."
                              : room.screenShare.presenter
                                ? `Stai guardando lo schermo di ${room.screenShare.presenter.nickname}. In questa modalita gli altri utenti non possono cambiare sorgente o playback.`
                                : "Presentazione schermo attiva nella stanza."
                            : "Chiunque nella stanza puo cambiare video, play, pausa e seek per tutti."}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                          icon={<MovieRoundedIcon />}
                          label={room.sourceMode === "screen" ? "Schermo live" : room.currentVideoName ?? "Nessun video"}
                        />
                        <Chip label={room.messageCount === 1 ? "1 messaggio" : `${room.messageCount} messaggi`} />
                        {!isLiveScreenRoom ? (
                          <Button
                            variant="outlined"
                            disabled={startingScreenShare}
                            onClick={() => {
                              void handleStartScreenShare();
                            }}
                          >
                            {startingScreenShare ? "Avvio..." : "Presenta schermo"}
                          </Button>
                        ) : null}
                        {isActivePresenter ? (
                          <Button
                            color="warning"
                            variant="contained"
                            disabled={stoppingScreenShare}
                            onClick={() => {
                              void handleStopScreenShare();
                            }}
                          >
                            {stoppingScreenShare ? "Stop..." : "Termina presentazione"}
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>

                    {!isLiveScreenRoom && screenShareSupportError ? (
                      <Alert severity="info">{screenShareSupportError}</Alert>
                    ) : null}

                    {isLiveScreenRoom ? (
                      <Alert severity={isActivePresenter ? "success" : "info"}>
                        {isActivePresenter
                          ? "Presentazione attiva. Il feed include audio obbligatorio e sostituisce temporaneamente il player video."
                          : "Modalita view-and-chat attiva: puoi guardare il feed, usare la chat, regolare volume e fullscreen solo sul tuo device."}
                      </Alert>
                    ) : null}

                    <FormControl fullWidth>
                      <InputLabel id="stream-room-video-label">Video stanza</InputLabel>
                      <Select
                        labelId="stream-room-video-label"
                        label="Video stanza"
                        value={room.videoItem?.id ?? ""}
                        disabled={updatingVideo || videoItems.length === 0 || room.sourceMode === "screen"}
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

                    {room.sourceMode === "screen" ? (
                      activeScreenStream ? (
                        <Box
                          sx={{
                            borderRadius: 4,
                            overflow: "hidden",
                            border: "1px solid rgba(255,255,255,0.08)",
                            bgcolor: "#000"
                          }}
                        >
                          <Box
                            component="video"
                            ref={screenVideoRef}
                            autoPlay
                            controls
                            muted={isActivePresenter}
                            playsInline
                            aria-label={
                              room.screenShare.presenter
                                ? `Presentazione schermo ${room.screenShare.presenter.nickname}`
                                : "Presentazione schermo"
                            }
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
                              <MeetingRoomRoundedIcon />
                            </Avatar>
                            <Typography color="common.white" variant="h6">
                              Connessione alla presentazione in corso
                            </Typography>
                            <Typography color="rgba(255,255,255,0.72)">
                              Sto preparando il feed live della stanza. Se il browser blocca l'autoplay, premi Play.
                            </Typography>
                          </Stack>
                        </Box>
                      )
                    ) : room.videoItem?.streamUrl ? (
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
                            I contenuti arrivano dalla libreria Routy gia caricata sull'host.
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
                      bgcolor: alpha(theme.palette.primary.main, isDark ? 0.1 : 0.02),
                      border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)}`
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
                                  bgcolor: isOwnMessage
                                    ? alpha(theme.palette.primary.main, isDark ? 0.16 : 0.08)
                                    : "background.paper",
                                  borderColor: isOwnMessage
                                    ? alpha(theme.palette.primary.main, isDark ? 0.28 : 0.16)
                                    : alpha(theme.palette.text.primary, isDark ? 0.14 : 0.06)
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

                  <Stack>
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
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                color="primary"
                                aria-label="Invia messaggio"
                                disabled={sendingMessage || messageText.trim().length === 0}
                                onClick={() => {
                                  void handleSendMessage();
                                }}
                              >
                                <SendRoundedIcon />
                              </IconButton>
                            </InputAdornment>
                          )
                        }
                      }}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Box>
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
