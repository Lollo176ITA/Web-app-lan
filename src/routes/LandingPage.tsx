import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import FlashOnRoundedIcon from "@mui/icons-material/FlashOnRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Stack,
  Typography,
  Avatar
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useLanLiveState } from "../lib/useLanLiveState";

const featureCards = [
  {
    icon: FlashOnRoundedIcon,
    title: "Velocità del router, non del cloud",
    body: "I file passano dentro la tua LAN. Routeroom sfrutta la rete locale per upload e download immediati."
  },
  {
    icon: PlayCircleOutlineRoundedIcon,
    title: "Video e audio direttamente nel browser",
    body: "Apri i contenuti appena caricati e guardali o ascoltali senza installare niente sugli altri device."
  },
  {
    icon: ShieldRoundedIcon,
    title: "Zero account, zero servizi esterni",
    body: "Chi è sulla stessa rete apre l’URL LAN e usa l’app. Nessun passaggio su Internet per farla funzionare."
  }
];

export function LandingPage() {
  const liveState = useLanLiveState({ source: "library" });

  return (
    <Box sx={{ pb: 8 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Routeroom" subtitle="LAN media relay" networkState={liveState} />

        <Card sx={{ mt: 3, overflow: "hidden" }}>
          <CardContent sx={{ p: { xs: 2.5, md: 4.5 } }}>
            <Box
              sx={{
                display: "grid",
                gap: { xs: 4, md: 5 },
                alignItems: "center",
                gridTemplateColumns: { xs: "1fr", lg: "1.02fr 0.98fr" }
              }}
            >
              <Stack spacing={2.5}>
                <Chip
                  icon={<CloudOffRoundedIcon />}
                  label="Solo rete locale, nessun passaggio cloud"
                  sx={{
                    alignSelf: "flex-start",
                    bgcolor: alpha("#1769aa", 0.1),
                    boxShadow: `inset 0 0 0 1px ${alpha("#1769aa", 0.08)}`
                  }}
                />
                <Typography variant="h1">
                  Trasferisci file e guarda media alla velocità della tua LAN.
                </Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 700, fontSize: { xs: "1rem", md: "1.1rem" } }}>
                  Routeroom trasforma un laptop o un desktop in un hub locale per file, video, audio e documenti. Avvii il server, condividi l’URL del router e tutti i device sulla stessa rete entrano subito.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button
                    component={RouterLink}
                    to="/app"
                    size="large"
                    variant="contained"
                    endIcon={<ArrowOutwardRoundedIcon />}
                    sx={{
                      background: "linear-gradient(135deg, #1769aa 0%, #0f9d94 100%)",
                      boxShadow: "0 18px 34px rgba(23, 105, 170, 0.22)"
                    }}
                  >
                    Apri la LAN
                  </Button>
                  <Button component={RouterLink} to="/app" size="large" variant="outlined">
                    Entra nell'app
                  </Button>
                </Stack>
              </Stack>

              <Card variant="outlined" sx={{ overflow: "hidden", bgcolor: "#08131e" }}>
                <CardMedia
                  component="img"
                  src="/visuals/routeroom-hero.svg"
                  alt="Illustrazione Routeroom in rete locale"
                  sx={{ display: "block", width: "100%", objectFit: "cover" }}
                />
              </Card>
            </Box>
          </CardContent>
        </Card>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            mt: { xs: 4, md: 5 },
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }
          }}
        >
          {featureCards.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardContent>
                <Stack spacing={2}>
                  <Avatar sx={{ width: 52, height: 52, bgcolor: alpha("#0f9d94", 0.12), color: "secondary.main" }}>
                    <Icon />
                  </Avatar>
                  <Typography variant="h5">{title}</Typography>
                  <Typography color="text.secondary">{body}</Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
