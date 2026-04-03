import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, Snackbar, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ClientProfileResponse, FeatureFlags, LanIdentity, SessionInfo } from "../shared/types";
import { FeatureDisabledPage } from "./components/FeatureDisabledPage";
import { NicknameDialog } from "./components/NicknameDialog";
import { UploadProgressCard } from "./components/UploadProgressCard";
import {
  AppShellContext,
  fallbackFeatureFlags,
  persistFeatureFlags,
  readStoredFeatureFlags
} from "./lib/app-shell-context";
import { createIdentityFromNickname, persistIdentity, readStoredIdentity } from "./lib/identity";
import { IdentityContext } from "./lib/identity-context";
import { fetchClientProfile, fetchSession, openLanEvents, type UploadProgress, uploadFiles } from "./lib/api";
import { LandingPage } from "./routes/LandingPage";
import { compareVersions } from "./lib/updates";

const AppPage = lazy(async () => import("./routes/AppPage").then((module) => ({ default: module.AppPage })));
const ChatPage = lazy(async () => import("./routes/ChatPage").then((module) => ({ default: module.ChatPage })));
const StreamRoomsPage = lazy(async () => import("./routes/StreamRoomsPage").then((module) => ({ default: module.StreamRoomsPage })));
const StreamRoomPage = lazy(async () => import("./routes/StreamRoomPage").then((module) => ({ default: module.StreamRoomPage })));
const VideoPlayerPage = lazy(async () => import("./routes/VideoPlayerPage").then((module) => ({ default: module.VideoPlayerPage })));
const SettingsPage = lazy(async () => import("./routes/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const UserProfilePage = lazy(async () =>
  import("./routes/UserProfilePage").then((module) => ({ default: module.UserProfilePage }))
);
const DiagnosticsPage = lazy(async () =>
  import("./routes/DiagnosticsPage").then((module) => ({ default: module.DiagnosticsPage }))
);
const SyncPage = lazy(async () => import("./routes/SyncPage").then((module) => ({ default: module.SyncPage })));

interface AppUploadState {
  lastUploadedItemId: string | null;
  settledAt: number;
}

interface AppShellState {
  clientProfile: ClientProfileResponse | null;
  loading: boolean;
  session: SessionInfo | null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("App shell request timed out."));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function RouteFallback() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default"
      }}
    >
      <CircularProgress />
    </Box>
  );
}

function HomeRoute({
  cachedFeatureFlags,
  session
}: Pick<AppShellState, "session"> & { cachedFeatureFlags: FeatureFlags | null }) {
  const resolvedFeatureFlags = session?.featureFlags ?? cachedFeatureFlags;

  if (resolvedFeatureFlags?.homepage === false) {
    return <Navigate to="/app" replace />;
  }

  return <LandingPage />;
}

export default function App() {
  const location = useLocation();
  const [identity, setIdentityState] = useState(() => readStoredIdentity());
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [appShellState, setAppShellState] = useState<AppShellState>({
    clientProfile: null,
    loading: true,
    session: null
  });
  const [cachedFeatureFlags, setCachedFeatureFlags] = useState<FeatureFlags | null>(() => readStoredFeatureFlags());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadSnackbar, setUploadSnackbar] = useState<string | null>(null);
  const [availableHostWebVersion, setAvailableHostWebVersion] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<AppUploadState>({
    lastUploadedItemId: null,
    settledAt: 0
  });
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setIdentityState(readStoredIdentity());
  }, []);

  async function syncAppShell(markLoading = false) {
    if (markLoading && mountedRef.current) {
      setAppShellState((currentState) => ({
        ...currentState,
        loading: true
      }));
    }

    const [sessionResult, clientProfileResult] = await Promise.allSettled([
      withTimeout(fetchSession(), 4_000),
      withTimeout(fetchClientProfile(), 4_000)
    ]);

    if (!mountedRef.current) {
      return;
    }

    if (sessionResult.status === "fulfilled") {
      persistFeatureFlags(sessionResult.value.featureFlags);
      setCachedFeatureFlags(sessionResult.value.featureFlags);
      setAvailableHostWebVersion(
        compareVersions(sessionResult.value.appVersion, __APP_VERSION__) > 0 ? sessionResult.value.appVersion : null
      );
    } else if (!appShellState.session) {
      setAvailableHostWebVersion(null);
    }

    setAppShellState((currentState) => {
      const nextSession = sessionResult.status === "fulfilled" ? sessionResult.value : currentState.session;
      const nextClientProfile =
        clientProfileResult.status === "fulfilled" ? clientProfileResult.value : currentState.clientProfile;

      return {
        session: nextSession,
        clientProfile: nextClientProfile,
        loading: false
      };
    });
  }

  useEffect(() => {
    if (!uploading) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [uploading]);

  useEffect(() => {
    let active = true;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncAppShell();
      }
    };
    const handleGlobalSettingsUpdate = (event: Event) => {
      const nextFlags = (event as CustomEvent<{ featureFlags?: FeatureFlags }>).detail?.featureFlags;

      if (nextFlags) {
        persistFeatureFlags(nextFlags);
        setCachedFeatureFlags(nextFlags);
        setAppShellState((currentState) => ({
          ...currentState,
          session: currentState.session
            ? {
                ...currentState.session,
                featureFlags: nextFlags
              }
            : currentState.session
        }));
      }

      void syncAppShell();
    };

    void syncAppShell();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncAppShell();
      }
    }, 60_000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("routy-settings-updated", handleGlobalSettingsUpdate);

    let fallbackIntervalId: number | null = null;
    const source = openLanEvents(
      {
        "settings-updated": () => {
          void syncAppShell();
        }
      },
      () => {
        fallbackIntervalId = window.setInterval(() => {
          void syncAppShell();
        }, 3_000);
      },
      () => {
        void syncAppShell();
      }
    );

    return () => {
      active = false;
      source.close();
      window.clearInterval(intervalId);
      if (fallbackIntervalId !== null) {
        window.clearInterval(fallbackIntervalId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("routy-settings-updated", handleGlobalSettingsUpdate);
    };
  }, []);

  function setIdentity(nextIdentity: LanIdentity) {
    persistIdentity(nextIdentity);
    setIdentityState(nextIdentity);
  }

  async function startUpload(files: File[], parentId?: string | null, targetLabel = "Radice LAN") {
    if (files.length === 0 || uploadAbortControllerRef.current) {
      return;
    }

    const abortController = new AbortController();
    let lastUploadedItemId: string | null = null;
    let nextSnackbar: string | null = null;
    uploadAbortControllerRef.current = abortController;
    setUploading(true);
    setUploadProgress(null);

    try {
      const response = await uploadFiles(files, parentId, {
        onProgress: setUploadProgress,
        signal: abortController.signal
      });

      lastUploadedItemId = response.items.find((item) => item.kind !== "folder")?.id ?? null;
      nextSnackbar = `${files.length} file caricati in ${targetLabel}.`;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        nextSnackbar = "Caricamento interrotto. I file gia ricevuti restano nella libreria.";
      } else {
        console.error(error);
        nextSnackbar = "Caricamento interrotto. Alcuni file potrebbero essere gia stati salvati.";
      }
    } finally {
      if (uploadAbortControllerRef.current === abortController) {
        uploadAbortControllerRef.current = null;
      }

      setUploading(false);
      setUploadProgress(null);
      setUploadState({
        lastUploadedItemId,
        settledAt: Date.now()
      });

      if (nextSnackbar) {
        setUploadSnackbar(nextSnackbar);
      }
    }
  }

  function cancelUpload() {
    uploadAbortControllerRef.current?.abort();
  }

  const featureFlags = appShellState.session?.featureFlags ?? cachedFeatureFlags ?? fallbackFeatureFlags;

  return (
    <IdentityContext.Provider value={{ identity, setIdentity }}>
      <AppShellContext.Provider
        value={{
          clientProfile: appShellState.clientProfile,
          loading: appShellState.loading,
          refresh: async () => {
            await syncAppShell(true);
          },
          session: appShellState.session
        }}
      >
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route
              path="/"
              element={
                <HomeRoute
                  cachedFeatureFlags={cachedFeatureFlags}
                  session={appShellState.session}
                />
              }
            />
            <Route
              path="/app"
              element={
                <AppPage
                  lastUploadSettledAt={uploadState.settledAt}
                  lastUploadedItemId={uploadState.lastUploadedItemId}
                  onStartUpload={startUpload}
                  uploading={uploading}
                />
              }
            />
            <Route path="/chat" element={<Navigate to="/chat/globale" replace />} />
            <Route
              path="/chat/globale"
              element={
                featureFlags.chat ? (
                  <ChatPage />
                ) : (
                  <FeatureDisabledPage actionLabel="Apri la libreria" actionTo="/app" title="Chat LAN" />
                )
              }
            />
            <Route
              path="/chat/utente/:userId"
              element={
                featureFlags.chat ? (
                  <ChatPage />
                ) : (
                  <FeatureDisabledPage actionLabel="Apri la libreria" actionTo="/app" title="Chat LAN" />
                )
              }
            />
            <Route
              path="/stream"
              element={
                featureFlags.streaming ? (
                  <StreamRoomsPage />
                ) : (
                  <FeatureDisabledPage actionLabel="Apri la libreria" actionTo="/app" title="Streaming" />
                )
              }
            />
            <Route
              path="/stream/room/:roomId"
              element={
                featureFlags.streaming ? (
                  <StreamRoomPage />
                ) : (
                  <FeatureDisabledPage actionLabel="Apri la libreria" actionTo="/app" title="Streaming" />
                )
              }
            />
            <Route path="/player/:itemId" element={<VideoPlayerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/utente/:userId" element={<UserProfilePage />} />
            <Route path="/diagnostics" element={<DiagnosticsPage />} />
            <Route
              path="/sync"
              element={
                featureFlags.sync ? (
                  <SyncPage />
                ) : (
                  <FeatureDisabledPage actionLabel="Apri la libreria" actionTo="/app" title="Sync Host" />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>

        <NicknameDialog
          open={!identity}
          initialValue=""
          dialogTitle={location.pathname === "/" ? "Benvenuto nella LAN" : "Prima di entrare"}
          helperText="Scegli il nickname una sola volta. Lo ritroverai nel tuo profilo personale."
          onSave={(nickname) => {
            setIdentity(createIdentityFromNickname(nickname));
          }}
        />

        <Snackbar
          open={Boolean(uploadProgress)}
          anchorOrigin={isMobile ? { vertical: "bottom", horizontal: "center" } : { vertical: "bottom", horizontal: "right" }}
          sx={{
            bottom: {
              xs: 18,
              sm: 24
            }
          }}
        >
          <Box
            sx={{
              width: {
                xs: "min(calc(100vw - 24px), 540px)",
                sm: 420
              }
            }}
          >
            {uploadProgress ? (
              <UploadProgressCard
                compact={isMobile}
                onCancel={cancelUpload}
                progress={uploadProgress}
              />
            ) : null}
          </Box>
        </Snackbar>

        <Snackbar
          open={Boolean(uploadSnackbar)}
          autoHideDuration={2600}
          anchorOrigin={{ vertical: isMobile ? "top" : "bottom", horizontal: "center" }}
          onClose={() => {
            setUploadSnackbar(null);
          }}
          message={uploadSnackbar}
        />

        <Snackbar
          open={Boolean(availableHostWebVersion)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          onClose={() => {
            setAvailableHostWebVersion(null);
          }}
          message={
            availableHostWebVersion
              ? `Web app aggiornata sull'host: Routy ${availableHostWebVersion}.`
              : undefined
          }
          action={
            availableHostWebVersion ? (
              <Button
                color="secondary"
                size="small"
                onClick={() => {
                  window.location.reload();
                }}
              >
                Ricarica
              </Button>
            ) : undefined
          }
        />
      </AppShellContext.Provider>
    </IdentityContext.Provider>
  );
}
