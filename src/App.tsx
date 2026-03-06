import { lazy, Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";

const LandingPage = lazy(async () => import("./routes/LandingPage").then((module) => ({ default: module.LandingPage })));
const AppPage = lazy(async () => import("./routes/AppPage").then((module) => ({ default: module.AppPage })));
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
        <Route path="/player/:itemId" element={<VideoPlayerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
