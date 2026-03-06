import { Navigate, Route, Routes } from "react-router-dom";
import { AppPage } from "./routes/AppPage";
import { LandingPage } from "./routes/LandingPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<AppPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
