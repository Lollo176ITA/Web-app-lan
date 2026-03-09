import { startTransition, useEffect, useRef, useState } from "react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  Container,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink, useParams } from "react-router-dom";
import type {
  ChatMessage,
  ChatSnapshotResponse,
  ChatThreadSummary,
  PrivateChatMessage
} from "../../shared/types";
import { PageHeader } from "../components/PageHeader";
import { useIdentity } from "../lib/identity-context";
import {
  fetchChatSnapshot,
  fetchDirectChatSnapshot,
  openLanEvents,
  sendChatMessage,
  sendDirectChatMessage
} from "../lib/api";

type LiveState = "live" | "fallback" | "connecting";
type ActiveChatMessage = ChatMessage | PrivateChatMessage;

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function buildDirectChatUrl(userId: string) {
  return `/chat/utente/${userId}`;
}

function hashValue(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) % 360;
  }

  return hash;
}

function buildUserTone(identityId: string) {
  const hue = hashValue(identityId);

  return {
    solid: `hsl(${hue} 62% 46%)`,
    text: `hsl(${hue} 70% 24%)`,
    soft: `hsl(${hue} 75% 96%)`,
    border: `hsl(${hue} 48% 78%)`,
    glow: `hsla(${hue} 75% 44% / 0.12)`
  };
}

function buildInitials(nickname: string) {
  return nickname
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function buildThreadMap(threads: ChatThreadSummary[]) {
  return new Map(threads.map((thread) => [thread.participant.id, thread]));
}

export function ChatPage() {
  const { userId } = useParams();
  const isDirectChat = Boolean(userId);
  const { identity } = useIdentity();
  const [overview, setOverview] = useState<ChatSnapshotResponse>({
    globalMessages: [],
    threads: [],
    knownUsers: []
  });
  const [directMessages, setDirectMessages] = useState<PrivateChatMessage[]>([]);
  const [directParticipant, setDirectParticipant] = useState<ChatSnapshotResponse["knownUsers"][number] | null>(null);
  const [messageText, setMessageText] = useState("");
  const [liveState, setLiveState] = useState<LiveState>("connecting");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const theme = useTheme();
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const activeConversationKey = userId ? `user:${userId}` : "global";

  const threadMap = buildThreadMap(overview.threads);
  const knownUsers = overview.knownUsers.filter((user) => user.id !== identity?.id);
  const selectedParticipant = userId ? directParticipant ?? overview.knownUsers.find((user) => user.id === userId) ?? null : null;
  const activeMessages: ActiveChatMessage[] = isDirectChat ? directMessages : overview.globalMessages;
  const sidebarUsers = knownUsers
    .map((user) => ({
      participant: user,
      thread: threadMap.get(user.id) ?? null
    }))
    .sort((left, right) => {
      const leftTimestamp = left.thread?.lastMessage?.sentAt ?? "";
      const rightTimestamp = right.thread?.lastMessage?.sentAt ?? "";

      if (leftTimestamp !== rightTimestamp) {
        return rightTimestamp.localeCompare(leftTimestamp);
      }

      return left.participant.nickname.localeCompare(right.participant.nickname, "it");
    });

  async function syncChatState() {
    try {
      const [nextOverview, nextDirect] = await Promise.all([
        fetchChatSnapshot(identity?.id),
        userId && identity ? fetchDirectChatSnapshot(userId, identity.id) : Promise.resolve(null)
      ]);

      startTransition(() => {
        setOverview(nextOverview);
        setDirectParticipant(nextDirect?.participant ?? null);
        setDirectMessages(nextDirect?.messages ?? []);
        setLoading(false);
      });
    } catch {
      setLoading(false);
      setSnackbar("Caricamento chat non riuscito.");
    }
  }

  useEffect(() => {
    void syncChatState();
  }, [identity?.id, userId]);

  useEffect(() => {
    let pollingId: number | undefined;

    const source = openLanEvents(
      {
        "chat-global-updated": () => {
          setLiveState("live");
          void syncChatState();
        },
        "chat-private-updated": () => {
          setLiveState("live");
          void syncChatState();
        }
      },
      () => {
        setLiveState("fallback");
        pollingId = window.setInterval(() => {
          void syncChatState();
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
  }, [identity?.id, userId]);

  useEffect(() => {
    const viewport = messagesViewportRef.current;

    if (!viewport || loading) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: "smooth"
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeConversationKey, activeMessages.length, loading]);

  async function handleSendMessage() {
    const text = messageText.trim();

    if (!identity) {
      return;
    }

    if (!text) {
      return;
    }

    if (isDirectChat && !selectedParticipant) {
      setSnackbar("Utente non disponibile per la chat privata.");
      return;
    }

    setSending(true);

    try {
      if (isDirectChat && userId) {
        await sendDirectChatMessage(userId, identity, text);
      } else {
        await sendChatMessage(identity, text);
      }

      setMessageText("");
      await syncChatState();
    } catch {
      setSnackbar("Invio messaggio non riuscito.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader
          title="Chat LAN"
          subtitle={isDirectChat ? "Conversazione privata" : "Canale globale"}
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
          <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5} alignItems="stretch">
            <Card
              sx={{
                width: { xs: "100%", lg: 360 },
                flexShrink: 0,
                borderRadius: 2.5,
                alignSelf: "stretch"
              }}
            >
              <CardContent sx={{ p: 0 }}>
                <Stack spacing={0}>
                  <Box sx={{ px: 2.25, py: 2 }}>
                    <Typography variant="h6">Conversazioni</Typography>
                  </Box>

                  <Box sx={{ px: 1.25, pb: 1.25 }}>
                    <ButtonBase
                      component={RouterLink}
                      to="/chat/globale"
                      sx={{
                        width: "100%",
                        display: "block",
                        textAlign: "left",
                        borderRadius: 2,
                        border: `1px solid ${!isDirectChat ? alpha("#1769aa", 0.24) : alpha("#10273a", 0.08)}`,
                        background: !isDirectChat
                          ? "linear-gradient(135deg, rgba(23,105,170,0.14), rgba(15,157,148,0.08))"
                          : "rgba(255,255,255,0.72)"
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1.5, py: 1.35 }}>
                        <Avatar sx={{ bgcolor: alpha("#1769aa", 0.14), color: "primary.main" }}>
                          <ForumRoundedIcon />
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="subtitle1">Globale</Typography>
                          <Typography color="text.secondary" noWrap>
                            {overview.globalMessages.length === 0
                              ? "Nessun messaggio ancora"
                              : `${overview.globalMessages.length} messaggi condivisi`}
                          </Typography>
                        </Box>
                      </Stack>
                    </ButtonBase>
                  </Box>

                  <Box sx={{ px: 2.25, pt: 0.5, pb: 1 }}>
                    <Typography variant="overline" color="secondary.main">
                      Utenti LAN
                    </Typography>
                  </Box>

                  <Stack spacing={1} sx={{ px: 1.25, pb: 1.25 }}>
                    {sidebarUsers.length === 0 ? (
                      <Box
                        sx={{
                          px: 1.5,
                          py: 2,
                          borderRadius: 2,
                          border: `1px dashed ${alpha("#1769aa", 0.18)}`,
                          bgcolor: alpha("#10273a", 0.02)
                        }}
                      >
                        <Typography color="text.secondary">
                          Nessun altro utente visto nella chat LAN. Appena qualcuno scrive comparira qui.
                        </Typography>
                      </Box>
                    ) : (
                      sidebarUsers.map(({ participant, thread }) => {
                        const tone = buildUserTone(participant.id);
                        const isActive = participant.id === userId;

                        return (
                          <ButtonBase
                            key={participant.id}
                            component={RouterLink}
                            to={buildDirectChatUrl(participant.id)}
                            sx={{
                              width: "100%",
                              display: "block",
                              textAlign: "left",
                              borderRadius: 2,
                              border: `1px solid ${isActive ? tone.border : alpha("#10273a", 0.08)}`,
                              background: isActive ? tone.soft : "rgba(255,255,255,0.76)",
                              boxShadow: isActive ? `inset 3px 0 0 ${tone.solid}` : "none"
                            }}
                          >
                            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1.5, py: 1.3 }}>
                              <Avatar
                                sx={{
                                  bgcolor: tone.glow,
                                  color: tone.solid,
                                  fontWeight: 700
                                }}
                              >
                                {buildInitials(participant.nickname)}
                              </Avatar>
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="subtitle2" noWrap sx={{ color: tone.text }}>
                                  {participant.nickname}
                                </Typography>
                                <Typography color="text.secondary" variant="body2" noWrap>
                                  {thread?.lastMessage?.text ?? "Apri la chat privata"}
                                </Typography>
                              </Box>
                              {thread?.lastMessage ? (
                                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                                  {formatMessageTime(thread.lastMessage.sentAt)}
                                </Typography>
                              ) : (
                                <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18, color: alpha(tone.solid, 0.72) }} />
                              )}
                            </Stack>
                          </ButtonBase>
                        );
                      })
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ flex: 1, borderRadius: 2.5 }}>
              <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack spacing={2}>
                  {liveState === "fallback" ? (
                    <Alert severity="warning">Connessione live non disponibile. Sto usando refresh periodico.</Alert>
                  ) : null}

                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.5}
                    alignItems={{ xs: "flex-start", md: "center" }}
                    justifyContent="space-between"
                  >
                    <Box>
                      <Typography variant="h5">
                        {isDirectChat ? selectedParticipant?.nickname ?? "Utente LAN" : "Canale globale"}
                      </Typography>
                    </Box>

                    {selectedParticipant ? (
                      <Chip
                        avatar={
                          <Avatar
                            sx={{
                              bgcolor: buildUserTone(selectedParticipant.id).glow,
                              color: buildUserTone(selectedParticipant.id).solid
                            }}
                          >
                            {buildInitials(selectedParticipant.nickname)}
                          </Avatar>
                        }
                        label={`utente:${selectedParticipant.id.slice(0, 8)}`}
                        sx={{
                          borderRadius: 1.5,
                          bgcolor: buildUserTone(selectedParticipant.id).soft,
                          border: `1px solid ${buildUserTone(selectedParticipant.id).border}`
                        }}
                      />
                    ) : null}
                  </Stack>

                  <Box
                    ref={messagesViewportRef}
                    sx={{
                      minHeight: 420,
                      maxHeight: 560,
                      overflowY: "auto",
                      px: { xs: 0.5, md: 0.75 },
                      py: 0.75,
                      borderRadius: 2,
                      bgcolor: alpha("#f8fbfd", 0.92),
                      border: `1px solid ${alpha("#1769aa", 0.1)}`,
                      backgroundImage:
                        "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(240,247,251,0.92)), radial-gradient(circle at top, rgba(23,105,170,0.08), transparent 34%)"
                    }}
                  >
                    {loading ? (
                      <Typography color="text.secondary">Caricamento messaggi...</Typography>
                    ) : activeMessages.length === 0 ? (
                      <Typography color="text.secondary">
                        {isDirectChat
                          ? "Nessun messaggio in questa chat privata. Scrivi tu per primo."
                          : "Nessun messaggio nella chat LAN. Inizia tu."}
                      </Typography>
                    ) : (
                      <Stack spacing={1.25}>
                        {activeMessages.map((message) => {
                          const isOwnMessage = identity?.id === message.identity.id;
                          const tone = buildUserTone(message.identity.id);

                          return (
                            <Box
                              key={message.id}
                              sx={{
                                alignSelf: isOwnMessage ? "flex-end" : "flex-start",
                                maxWidth: { xs: "100%", sm: "82%" }
                              }}
                            >
                              <Box
                                sx={{
                                  px: 1.5,
                                  py: 1.35,
                                  borderRadius: 1.5,
                                  border: `1px solid ${tone.border}`,
                                  bgcolor: tone.soft,
                                  boxShadow: `0 10px 24px ${tone.glow}`,
                                  borderLeftWidth: 5
                                }}
                              >
                                <Stack spacing={0.8}>
                                  <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="baseline">
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Avatar
                                        sx={{
                                          width: 28,
                                          height: 28,
                                          fontSize: "0.8rem",
                                          bgcolor: tone.glow,
                                          color: tone.solid
                                        }}
                                      >
                                        {buildInitials(message.identity.nickname)}
                                      </Avatar>
                                      <Typography variant="subtitle2" sx={{ color: tone.text }}>
                                        {message.identity.nickname}
                                      </Typography>
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary">
                                      {formatMessageTime(message.sentAt)}
                                    </Typography>
                                  </Stack>
                                  <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#173042" }}>
                                    {message.text}
                                  </Typography>
                                </Stack>
                              </Box>
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
                      minRows={1}
                      maxRows={5}
                      label={"Scrivi un messaggio"}
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
                                disabled={sending || messageText.trim().length === 0 || (isDirectChat && !selectedParticipant)}
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
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 2
                        }
                      }}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
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
