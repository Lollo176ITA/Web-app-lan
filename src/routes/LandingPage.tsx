import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import DevicesRoundedIcon from "@mui/icons-material/DevicesRounded";
import FlashOnRoundedIcon from "@mui/icons-material/FlashOnRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import { alpha } from "@mui/material/styles";
import {
  Box,
  Button,
  Chip,
  Container,
  Link,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

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

const proofPanels = [
  {
    title: "Shell operativa live",
    body: "Session card, drag-and-drop, filtri e dettaglio media in una sola vista.",
    image: "/screenshots/routeroom-app-desktop.png"
  },
  {
    title: "Controllo mobile in rete locale",
    body: "La libreria resta leggibile e pronta all’uso anche da smartphone.",
    image: "/screenshots/routeroom-app-mobile.png"
  }
];

export function LandingPage() {
  return (
    <Box sx={{ pb: 8 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 3, md: 4 } }}>
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            overflow: "hidden",
            px: { xs: 2.25, md: 5 },
            py: { xs: 3, md: 5 },
            borderRadius: 8,
            background:
              "linear-gradient(140deg, rgba(255,255,255,0.92) 0%, rgba(244,250,255,0.96) 45%, rgba(233,246,245,0.98) 100%)"
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: { xs: 4, md: 6 } }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 3.5,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "primary.main",
                  color: "common.white"
                }}
              >
                <LanRoundedIcon />
              </Box>
              <Typography variant="h6">Routeroom</Typography>
            </Stack>
            <Button component={RouterLink} to="/app" variant="outlined">
              Apri la LAN
            </Button>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gap: { xs: 4, md: 5 },
              alignItems: "center",
              gridTemplateColumns: { xs: "1fr", lg: "1.05fr 0.95fr" }
            }}
          >
            <Stack spacing={2.5}>
              <Chip
                icon={<CloudOffRoundedIcon />}
                label="Solo rete locale, nessun passaggio cloud"
                sx={{ alignSelf: "flex-start", bgcolor: alpha("#1769aa", 0.1) }}
              />
              <Typography variant="h1">
                Trasferisci file e guarda media alla velocità della tua LAN.
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 700, fontSize: { xs: "1rem", md: "1.15rem" } }}>
                Routeroom trasforma un laptop o un desktop in un hub locale per file, video, audio e documenti. Avvii il server, condividi l’URL del router e tutti i device sulla stessa rete entrano subito.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button component={RouterLink} to="/app" size="large" variant="contained" endIcon={<ArrowOutwardRoundedIcon />}>
                  Apri la LAN
                </Button>
                <Button component={Link} href="#come-funziona" size="large" variant="text">
                  Come funziona
                </Button>
              </Stack>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Chip icon={<FlashOnRoundedIcon />} label="Upload locale multi-file" />
                <Chip icon={<PlayCircleOutlineRoundedIcon />} label="Streaming video diretto" />
                <Chip icon={<DevicesRoundedIcon />} label="Desktop + mobile" />
              </Stack>
            </Stack>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 7,
                bgcolor: "rgba(6, 31, 54, 0.96)",
                boxShadow: "0 28px 80px rgba(8, 26, 48, 0.28)"
              }}
            >
              <Box
                component="img"
                src="/visuals/routeroom-hero.svg"
                alt="Illustrazione Routeroom in rete locale"
                sx={{ width: "100%", display: "block", borderRadius: 5 }}
              />
            </Paper>
          </Box>
        </Paper>
      </Container>

      <Container id="come-funziona" maxWidth="xl" sx={{ mt: { xs: 4, md: 7 } }}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }
          }}
        >
          {featureCards.map(({ icon: Icon, title, body }) => (
            <Paper key={title} sx={{ p: 3, borderRadius: 6, bgcolor: "rgba(255,255,255,0.84)" }}>
              <Stack spacing={2}>
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 4,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: alpha("#0f9d94", 0.12),
                    color: "secondary.main"
                  }}
                >
                  <Icon />
                </Box>
                <Typography variant="h5">{title}</Typography>
                <Typography color="text.secondary">{body}</Typography>
              </Stack>
            </Paper>
          ))}
        </Box>
      </Container>

      <Container maxWidth="xl" sx={{ mt: { xs: 4, md: 7 } }}>
        <Paper sx={{ p: { xs: 2.25, md: 4 }, borderRadius: 7, bgcolor: "rgba(255,255,255,0.86)" }}>
          <Box
            sx={{
              display: "grid",
              gap: 4,
              alignItems: "center",
              gridTemplateColumns: { xs: "1fr", lg: "0.8fr 1.2fr" }
            }}
          >
            <Stack spacing={2.5}>
              <Typography variant="h2">Un’unica stanza locale per tutto il tuo media sharing</Typography>
              <Typography color="text.secondary">
                I device vedono lo stesso catalogo LAN, con filtri per tipo file, preview immediate e download diretti dall’host.
              </Typography>
              <Box
                component="img"
                src="/visuals/routeroom-devices.svg"
                alt="Tre dispositivi con Routeroom aperto"
                sx={{ width: "100%", maxWidth: 560, borderRadius: 6 }}
              />
            </Stack>

            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }
              }}
            >
              {proofPanels.map((panel) => (
                <Paper key={panel.title} sx={{ p: 1.5, borderRadius: 5, overflow: "hidden" }}>
                  <Box
                    component="img"
                    src={panel.image}
                    alt={panel.title}
                    sx={{ width: "100%", aspectRatio: panel.image.includes("mobile") ? "10 / 16" : "16 / 10", objectFit: "cover", borderRadius: 4 }}
                  />
                  <Stack spacing={0.75} sx={{ p: 1.25 }}>
                    <Typography variant="h6">{panel.title}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {panel.body}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
