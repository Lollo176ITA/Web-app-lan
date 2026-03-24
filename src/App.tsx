import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Snackbar, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { LanIdentity } from "../shared/types";
import { NicknameDialog } from "./components/NicknameDialog";
import { UploadProgressCard } from "./components/UploadProgressCard";
import { createIdentityFromNickname, persistIdentity, readStoredIdentity } from "./lib/identity";
import { IdentityContext } from "./lib/identity-context";
import { type UploadProgress, uploadFiles } from "./lib/api";

const LandingPage = lazy(async () => import("./routes/LandingPage").then((module) => ({ default: module.LandingPage })));
const AppPage = lazy(async () => import("./routes/AppPage").then((module) => ({ default: module.AppPage })));
const ChatPage = lazy(async () => import("./routes/ChatPage").then((module) => ({ default: module.ChatPage })));
const StreamRoomsPage = lazy(async () => import("./routes/StreamRoomsPage").then((module) => ({ default: module.StreamRoomsPage })));
const StreamRoomPage = lazy(async () => import("./routes/StreamRoomPage").then((module) => ({ default: module.StreamRoomPage })));
const VideoPlayerPage = lazy(async () => import("./routes/VideoPlayerPage").then((module) => ({ default: module.VideoPlayerPage })));
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

export default function App() {
  const location = useLocation();
  const [identity, setIdentityState] = useState(() => readStoredIdentity());
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadSnackbar, setUploadSnackbar] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<AppUploadState>({
    lastUploadedItemId: null,
    settledAt: 0
  });
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setIdentityState(readStoredIdentity());
  }, []);

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

  return (
    <IdentityContext.Provider value={{ identity, setIdentity }}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
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
          <Route path="/chat/globale" element={<ChatPage />} />
          <Route path="/chat/utente/:userId" element={<ChatPage />} />
          <Route path="/stream" element={<StreamRoomsPage />} />
          <Route path="/stream/room/:roomId" element={<StreamRoomPage />} />
          <Route path="/player/:itemId" element={<VideoPlayerPage />} />
          <Route path="/utente/:userId" element={<UserProfilePage />} />
          <Route path="/diagnostics" element={<DiagnosticsPage />} />
          <Route path="/sync" element={<SyncPage />} />
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
    </IdentityContext.Provider>
  );
}
