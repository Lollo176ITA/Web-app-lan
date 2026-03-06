import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import DevicesRoundedIcon from "@mui/icons-material/DevicesRounded";
import FlashOnRoundedIcon from "@mui/icons-material/FlashOnRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Stack,
  Toolbar,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
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
    body: "Libreria popolata, preview media e pannello dettaglio in chiave Material.",
    image: "/screenshots/routeroom-app-desktop.png"
  },
  {
    title: "Controllo mobile in rete locale",
    body: "Filtri e contenuti restano leggibili anche su smartphone.",
    image: "/screenshots/routeroom-app-mobile.png"
  }
];

export function LandingPage() {
  return (
    <Box sx={{ pb: 8 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <AppBar
          position="static"
          color="transparent"
          sx={{
            borderRadius: { xs: 3, md: 4 },
            px: { xs: 0.5, md: 1.5 }
          }}
        >
          <Toolbar
            sx={{
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", md: "center" },
              flexDirection: { xs: "column", sm: "row" },
              gap: 1.5,
              minHeight: { xs: 76, md: 88 },
              py: { xs: 1.5, sm: 0 }
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: "primary.main" }}>
                <LanRoundedIcon />
              </Avatar>
              <Typography variant="h6">Routeroom</Typography>
            </Stack>
            <Button component={RouterLink} to="/app" variant="outlined">
              Apri la LAN
            </Button>
          </Toolbar>
        </AppBar>

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
                  sx={{ alignSelf: "flex-start", bgcolor: alpha("#1769aa", 0.1) }}
                />
                <Typography variant="h1">
                  Trasferisci file e guarda media alla velocità della tua LAN.
                </Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 700, fontSize: { xs: "1rem", md: "1.1rem" } }}>
                  Routeroom trasforma un laptop o un desktop in un hub locale per file, video, audio e documenti. Avvii il server, condividi l’URL del router e tutti i device sulla stessa rete entrano subito.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button component={RouterLink} to="/app" size="large" variant="contained" endIcon={<ArrowOutwardRoundedIcon />}>
                    Apri la LAN
                  </Button>
                  <Button href="#come-funziona" size="large" variant="text">
                    Come funziona
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                  <Chip icon={<FlashOnRoundedIcon />} label="Upload locale multi-file" />
                  <Chip icon={<PlayCircleOutlineRoundedIcon />} label="Streaming video diretto" />
                  <Chip icon={<DevicesRoundedIcon />} label="Desktop + mobile" />
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
      </Container>

      <Container id="come-funziona" maxWidth="xl" sx={{ mt: { xs: 4, md: 5 } }}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
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

      <Container maxWidth="xl" sx={{ mt: { xs: 4, md: 5 } }}>
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
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
                <Card variant="outlined" sx={{ overflow: "hidden", maxWidth: 560 }}>
                  <CardMedia
                    component="img"
                    src="/visuals/routeroom-devices.svg"
                    alt="Tre dispositivi con Routeroom aperto"
                  />
                </Card>
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }
                }}
              >
                {proofPanels.map((panel) => (
                  <Card key={panel.title} variant="outlined" sx={{ overflow: "hidden" }}>
                    <CardMedia
                      component="img"
                      src={panel.image}
                      alt={panel.title}
                      sx={{
                        width: "100%",
                        aspectRatio: panel.image.includes("mobile") ? "10 / 16" : "16 / 10",
                        objectFit: "cover"
                      }}
                    />
                    <CardContent>
                      <Stack spacing={0.75}>
                        <Typography variant="h6">{panel.title}</Typography>
                        <Typography color="text.secondary" variant="body2">
                          {panel.body}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
