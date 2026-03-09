import { lazy, Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";

const LandingPage = lazy(async () => import("./routes/LandingPage").then((module) => ({ default: module.LandingPage })));
const AppPage = lazy(async () => import("./routes/AppPage").then((module) => ({ default: module.AppPage })));
const ChatPage = lazy(async () => import("./routes/ChatPage").then((module) => ({ default: module.ChatPage })));
const StreamRoomsPage = lazy(async () => import("./routes/StreamRoomsPage").then((module) => ({ default: module.StreamRoomsPage })));
const StreamRoomPage = lazy(async () => import("./routes/StreamRoomPage").then((module) => ({ default: module.StreamRoomPage })));
const VideoPlayerPage = lazy(async () => import("./routes/VideoPlayerPage").then((module) => ({ default: module.VideoPlayerPage })));

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
  return (
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
