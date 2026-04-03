import { startTransition, useEffect, useRef, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Container,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink, useLocation, useParams } from "react-router-dom";
import type {
  ChatMessage,
  ChatSnapshotResponse,
  ChatThreadSummary,
  PrivateChatMessage
} from "../../shared/types";
import { FeatureDisabledPage } from "../components/FeatureDisabledPage";
import { PageHeader } from "../components/PageHeader";
import { useAppShell } from "../lib/app-shell-context";
import { useIdentity } from "../lib/identity-context";
import {
  clearGlobalChat,
  fetchChatSnapshot,
  fetchDirectChatSnapshot,
  sendChatMessage,
  sendDirectChatMessage
} from "../lib/api";
import { cardRadii, pageCardSx } from "../lib/surfaces";
import { useLanLiveState } from "../lib/useLanLiveState";
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

function buildUserTone(identityId: string, isDark: boolean) {
  const hue = hashValue(identityId);

  if (isDark) {
    return {
      solid: `hsl(${hue} 82% 72%)`,
      text: `hsl(${hue} 92% 84%)`,
      soft: `hsla(${hue} 52% 30% / 0.34)`,
      border: `hsla(${hue} 82% 72% / 0.28)`,
      glow: `hsla(${hue} 88% 68% / 0.18)`
    };
  }

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
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isDark = theme.palette.mode === "dark";
  const isDirectChat = Boolean(userId);
  const showGlobalThread = new URLSearchParams(location.search).get("view") === "thread";
  const isConversationScreen = isDirectChat || showGlobalThread;
  const { identity } = useIdentity();
  const { clientProfile, refresh } = useAppShell();
  const [overview, setOverview] = useState<ChatSnapshotResponse>({
    globalMessages: [],
    threads: [],
    knownUsers: []
  });
  const [directMessages, setDirectMessages] = useState<PrivateChatMessage[]>([]);
  const [directParticipant, setDirectParticipant] = useState<ChatSnapshotResponse["knownUsers"][number] | null>(null);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearingGlobalChat, setClearingGlobalChat] = useState(false);
  const [chatDisabled, setChatDisabled] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const activeConversationKey = userId ? `user:${userId}` : "global";
  const showConversationList = !isMobile || !isConversationScreen;
  const showConversationPanel = !isMobile || isConversationScreen;
  const isHostClient = clientProfile?.isHost === true;
  const globalChatHref = isMobile ? "/chat/globale?view=thread" : "/chat/globale";
  const listPageHref = "/chat/globale";
  const globalThreadActive = isMobile ? showGlobalThread : !isDirectChat;
  const pageSubtitle = isMobile
    ? isConversationScreen
      ? isDirectChat
        ? "Conversazione privata"
        : "Canale globale"
      : "Conversazioni"
    : isDirectChat
      ? "Conversazione privata"
      : "Canale globale";

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

  const liveState = useLanLiveState(
    {
      handlers: {
        "chat-global-updated": () => {
          void syncChatState();
        },
        "chat-private-updated": () => {
          void syncChatState();
        }
      },
      onFallback: () => {
        const pollingId = window.setInterval(() => {
          void syncChatState();
        }, 3000);

        return () => {
          window.clearInterval(pollingId);
        };
      }
    },
    [identity?.id, userId]
  );

  function scrollMessagesToBottom(behavior: ScrollBehavior) {
    const viewport = messagesViewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior
    });
  }

  async function syncChatState() {
    try {
      const [nextOverview, nextDirect] = await Promise.all([
        fetchChatSnapshot(identity?.id),
        userId && identity ? fetchDirectChatSnapshot(userId, identity.id) : Promise.resolve(null)
      ]);

      startTransition(() => {
        setChatDisabled(false);
        setOverview(nextOverview);
        setDirectParticipant(nextDirect?.participant ?? null);
        setDirectMessages(nextDirect?.messages ?? []);
        setLoading(false);
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Request failed: 403") {
        setChatDisabled(true);
        void refresh();
        setLoading(false);
        return;
      }

      setLoading(false);
      setSnackbar("Caricamento chat non riuscito.");
    }
  }

  useEffect(() => {
    void syncChatState();
  }, [identity?.id, userId]);

  useEffect(() => {
    const viewport = messagesViewportRef.current;

    if (!viewport || loading || !showConversationPanel) {
      return;
    }

    let timeoutId = 0;
    const frameId = window.requestAnimationFrame(() => {
      scrollMessagesToBottom(isMobile ? "auto" : "smooth");
      timeoutId = window.setTimeout(() => {
        scrollMessagesToBottom("auto");
      }, 180);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [activeConversationKey, activeMessages.length, isMobile, loading, showConversationPanel]);

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

  async function handleClearGlobalChat() {
    if (!isHostClient || isDirectChat || clearingGlobalChat) {
      return;
    }

    const shouldClear = window.confirm("Vuoi davvero svuotare tutta la chat globale?");

    if (!shouldClear) {
      return;
    }

    setClearingGlobalChat(true);

    try {
      await clearGlobalChat();
      await syncChatState();
      setSnackbar("Chat globale svuotata.");
    } catch {
      setSnackbar("Svuotamento chat globale non riuscito.");
    } finally {
      setClearingGlobalChat(false);
    }
  }

  if (chatDisabled) {
    return <FeatureDisabledPage actionLabel="Apri la libreria" actionTo="/app" title="Chat LAN" />;
  }

  return (
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader
          title="Chat LAN"
          subtitle={pageSubtitle}
        />

        <Stack spacing={3} sx={{ mt: 3 }}>
          {liveState === "fallback" && !showConversationPanel ? (
            <Alert severity="warning">Connessione live non disponibile. Sto usando refresh periodico.</Alert>
          ) : null}

          <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5} alignItems="stretch">
            {showConversationList ? (
              <Card
                sx={{
                  width: { xs: "100%", lg: 360 },
                  flexShrink: 0,
                  ...pageCardSx,
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
                        to={globalChatHref}
                        sx={{
                          width: "100%",
                          display: "block",
                          textAlign: "left",
                          borderRadius: cardRadii.panel,
                          border: `1px solid ${globalThreadActive ? alpha(theme.palette.primary.main, isDark ? 0.3 : 0.24) : alpha(theme.palette.text.primary, isDark ? 0.16 : 0.08)}`,
                          backgroundColor: globalThreadActive
                            ? alpha(theme.palette.primary.main, isDark ? 0.24 : 0.12)
                            : alpha(theme.palette.background.paper, isDark ? 0.76 : 0.72)
                        }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1.5, py: 1.35 }}>
                          <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.14), color: "primary.main" }}>
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
                            borderRadius: cardRadii.panel,
                            border: `1px dashed ${alpha(theme.palette.primary.main, isDark ? 0.26 : 0.18)}`,
                            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.1 : 0.02)
                          }}
                        >
                          <Typography color="text.secondary">
                            Nessun altro utente visto nella chat LAN. Appena qualcuno scrive comparira qui.
                          </Typography>
                        </Box>
                      ) : (
                        sidebarUsers.map(({ participant, thread }) => {
                          const tone = buildUserTone(participant.id, isDark);
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
                                borderRadius: cardRadii.panel,
                                border: `1px solid ${isActive ? tone.border : alpha(theme.palette.text.primary, isDark ? 0.16 : 0.08)}`,
                                background: isActive ? tone.soft : alpha(theme.palette.background.paper, isDark ? 0.8 : 0.76),
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
            ) : null}

            {showConversationPanel ? (
              <Card sx={{ flex: 1, ...pageCardSx }}>
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Stack spacing={2}>
                    {liveState === "fallback" ? (
                      <Alert severity="warning">Connessione live non disponibile. Sto usando refresh periodico.</Alert>
                    ) : null}

                    {isMobile ? (
                      <Button
                        component={RouterLink}
                        to={listPageHref}
                        color="inherit"
                        startIcon={<ArrowBackRoundedIcon />}
                        sx={{
                          alignSelf: "flex-start",
                          px: 0.5,
                          color: "text.secondary"
                        }}
                      >
                        Conversazioni
                      </Button>
                    ) : null}

                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ flexWrap: "wrap" }}
                    >
                      <Box>
                        <Typography variant="h5">
                          {isDirectChat ? selectedParticipant?.nickname ?? "Utente LAN" : "Canale globale"}
                        </Typography>
                      </Box>

                      {!isDirectChat && isHostClient ? (
                        <IconButton
                          aria-label="Svuota chat globale"
                          title="Svuota chat globale"
                          color="inherit"
                          disabled={clearingGlobalChat || overview.globalMessages.length === 0}
                          onClick={() => {
                            void handleClearGlobalChat();
                          }}
                          sx={{
                            border: `1px solid ${alpha(theme.palette.error.main, isDark ? 0.42 : 0.18)}`,
                            color: theme.palette.error.main
                          }}
                        >
                          <CloseRoundedIcon />
                        </IconButton>
                      ) : null}
                    </Stack>

                    <Box
                      ref={messagesViewportRef}
                      sx={{
                        minHeight: { xs: 360, md: 420 },
                        maxHeight: { xs: "calc(100vh - 280px)", md: 560 },
                        overflowY: "auto",
                        px: { xs: 0.5, md: 0.75 },
                        py: 0.75,
                        borderRadius: cardRadii.inset,
                        bgcolor: alpha(theme.palette.background.paper, isDark ? 0.82 : 0.92),
                        border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1)}`
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
                            const tone = buildUserTone(message.identity.id, isDark);

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
                                    borderRadius: cardRadii.panel,
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
                                    <Typography
                                      sx={{
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                        color: isDark ? alpha(theme.palette.common.white, 0.92) : theme.palette.text.primary
                                      }}
                                    >
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
                            borderRadius: cardRadii.panel
                          }
                        }}
                      />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ) : null}
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
