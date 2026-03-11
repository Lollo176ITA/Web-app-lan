import { lazy, Suspense, useEffect, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { LanIdentity } from "../shared/types";
import { NicknameDialog } from "./components/NicknameDialog";
import { createIdentityFromNickname, persistIdentity, readStoredIdentity } from "./lib/identity";
import { IdentityContext } from "./lib/identity-context";

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

  useEffect(() => {
    setIdentityState(readStoredIdentity());
  }, []);

  function setIdentity(nextIdentity: LanIdentity) {
    persistIdentity(nextIdentity);
    setIdentityState(nextIdentity);
  }

  return (
    <IdentityContext.Provider value={{ identity, setIdentity }}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<AppPage />} />
          <Route path="/chat" element={<Navigate to="/chat/globale" replace />} />
          <Route path="/chat/globale" element={<ChatPage />} />
          <Route path="/chat/utente/:userId" element={<ChatPage />} />
          <Route path="/stream" element={<StreamRoomsPage />} />
          <Route path="/stream/room/:roomId" element={<StreamRoomPage />} />
          <Route path="/player/:itemId" element={<VideoPlayerPage />} />
          <Route path="/utente/:userId" element={<UserProfilePage />} />
          <Route path="/diagnostics" element={<DiagnosticsPage />} />
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
    </IdentityContext.Provider>
  );
}
