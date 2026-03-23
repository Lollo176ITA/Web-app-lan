import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Stack,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { SessionInfo } from "../../../shared/types";
import { formatBytes } from "../../lib/format";
import { cardRadii, insetCardSx, pageCardSx } from "../../lib/surfaces";
import { formatLibraryCount } from "./utils";

interface HostSessionCardProps {
  isMobile: boolean;
  loading: boolean;
  onOpenQrCode: () => void;
  qrCodeDataUrl: string;
  session: SessionInfo | null;
}

export function HostSessionCard({
  isMobile,
  loading,
  onOpenQrCode,
  qrCodeDataUrl,
  session
}: HostSessionCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Card sx={pageCardSx}>
      <CardHeader title="Sessione host" subheader="Condividi questo indirizzo nella stessa rete" />
      <CardContent sx={{ pt: 0 }}>
        {loading || !session ? (
          <Typography color="text.secondary">Caricamento informazioni host...</Typography>
        ) : (
          <Stack spacing={2.25}>
            <Box
              sx={{
                p: { xs: 2, md: 2.25 },
                display: "grid",
                gap: 2,
                alignItems: "center",
                gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) auto" },
                borderRadius: cardRadii.inset,
                bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.05),
                border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)}`
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="space-between">
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      URL LAN
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 0.75, wordBreak: "break-word" }}>
                      {session.lanUrl}
                    </Typography>
                  </Box>

                  {isMobile && qrCodeDataUrl ? (
                    <IconButton
                      aria-label="Apri QR code URL LAN"
                      onClick={onOpenQrCode}
                      sx={{
                        flexShrink: 0,
                        borderRadius: cardRadii.panel,
                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                        color: isDark ? theme.palette.primary.light : "primary.main",
                        border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.24 : 0.12)}`
                      }}
                    >
                      <QrCode2RoundedIcon />
                    </IconButton>
                  ) : null}
                </Stack>
              </Stack>

              {!isMobile && qrCodeDataUrl ? (
                <Box
                  sx={{
                    p: 1.25,
                    justifySelf: { xs: "flex-start", sm: "end" },
                    borderRadius: cardRadii.inset,
                    bgcolor: "#ffffff",
                    border: `1px solid ${alpha("#1769aa", 0.16)}`
                  }}
                >
                  <Box
                    component="img"
                    src={qrCodeDataUrl}
                    alt="QR code URL LAN"
                    sx={{ width: { xs: 132, sm: 148 }, height: { xs: 132, sm: 148 }, display: "block" }}
                  />
                </Box>
              ) : null}
            </Box>

            <Card variant="outlined" sx={insetCardSx}>
              <CardContent sx={{ p: 2.25 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "baseline",
                        gap: 1
                      }}
                    >
                      <Box component="span">
                        {formatBytes(session.totalBytes)} in {formatLibraryCount(session.itemCount)}
                      </Box>
                    </Typography>
                    <Typography
                      color="text.secondary"
                      variant="body2"
                      sx={{ mt: 1, wordBreak: "break-word" }}
                    >
                      {session.storagePath}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
