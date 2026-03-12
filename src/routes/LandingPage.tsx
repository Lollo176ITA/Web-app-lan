import { useState } from "react";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import DevicesRoundedIcon from "@mui/icons-material/DevicesRounded";
import FlashOnRoundedIcon from "@mui/icons-material/FlashOnRounded";
import FolderZipRoundedIcon from "@mui/icons-material/FolderZipRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  CardMedia,
  Container,
  Stack,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useLanLiveState } from "../lib/useLanLiveState";

const featureCards = [
  {
    icon: FlashOnRoundedIcon,
    title: "Velocita della rete locale",
    body: "Upload, download e aggiornamenti passano nella tua LAN. Routy riduce attrito e latenza senza deviare sul cloud."
  },
  {
    icon: DevicesRoundedIcon,
    title: "Una libreria sola, tutti i device",
    body: "L'host centrale espone file, documenti, audio e video con la stessa vista su desktop, tablet e mobile."
  },
  {
    icon: PlayCircleOutlineRoundedIcon,
    title: "Playback e stanze streaming",
    body: "Apri i contenuti nel browser oppure sincronizza una stanza video locale senza installare nulla sugli altri device."
  },
  {
    icon: QrCode2RoundedIcon,
    title: "Link e QR gia pronti",
    body: "Condividi l'URL LAN o mostra un QR code: chi e sulla stessa rete entra subito nella libreria o nel player giusto."
  },
  {
    icon: ShieldRoundedIcon,
    title: "Zero account, zero servizi esterni",
    body: "Routy lavora in locale: apri il server, condividi l'indirizzo della rete e resti operativo anche senza Internet."
  },
  {
    icon: ChatRoundedIcon,
    title: "Chat e presenza in rete",
    body: "La chat globale e le conversazioni dirette restano dentro la LAN, con identita locale e utenti subito visibili."
  },
  {
    icon: FolderZipRoundedIcon,
    title: "Cartelle e archivi al volo",
    body: "Crei cartelle, prepari raccolte e scarichi archivi direttamente dall'host senza passaggi manuali."
  },
  {
    icon: VisibilityRoundedIcon,
    title: "Anteprime immediate",
    body: "Apri un media, lo ispezioni subito e passi dal dettaglio al player locale senza cambiare strumento."
  },
  {
    icon: LanRoundedIcon,
    title: "Host e rete sotto controllo",
    body: "Lo stato LAN resta visibile mentre condividi contenuti, cosi capisci subito se l'host e raggiungibile."
  },
  {
    icon: ArrowOutwardRoundedIcon,
    title: "Condivisione mirata",
    body: "Ogni contenuto puo puntare alla libreria, al player o alla stanza giusta, invece di mandare tutti in una home generica."
  }
];


export function LandingPage() {
  const liveState = useLanLiveState({ source: "library" });
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState(0);
  const selectedFeature = featureCards[selectedFeatureIndex];

  return (
    <Box sx={{ pb: 8 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Routy" subtitle="media relay locale" networkState={liveState} />

        <Card
          sx={{
            mt: 3,
            overflow: "hidden",
            position: "relative",
            background: isDark
              ? "linear-gradient(180deg, rgba(8, 19, 29, 0.96) 0%, rgba(7, 17, 26, 0.98) 100%)"
              : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(246, 251, 255, 0.92) 100%)"
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: isDark
                ? `
                    radial-gradient(circle at 14% 18%, ${alpha(theme.palette.primary.light, 0.24)}, transparent 28%),
                    radial-gradient(circle at 88% 12%, ${alpha(theme.palette.secondary.main, 0.22)}, transparent 24%)
                  `
                : `
                    radial-gradient(circle at 14% 18%, ${alpha(theme.palette.primary.light, 0.18)}, transparent 24%),
                    radial-gradient(circle at 88% 12%, ${alpha(theme.palette.secondary.main, 0.18)}, transparent 22%)
                  `
            }}
          />
          <CardContent sx={{ p: { xs: 2.5, md: 4.5 }, position: "relative" }}>
            <Box
              sx={{
                display: "grid",
                gap: { xs: 4, md: 5 },
                alignItems: { xs: "stretch", lg: "center" },
                gridTemplateColumns: { xs: "1fr", lg: "1.04fr 0.96fr" }
              }}
            >
              <Stack spacing={2.75}>
                <Box
                  component="img"
                  src="/brand/routy-logo.svg"
                  alt="Logo Routy"
                  sx={{
                    width: { xs: 170, sm: 220, md: 250 },
                    maxWidth: "100%",
                    display: "block",
                    filter: isDark ? "drop-shadow(0 22px 40px rgba(0, 0, 0, 0.3))" : "none"
                  }}
                />
                <Typography variant="h1" sx={{ maxWidth: 760 }}>
                 Condividi file, player e streaming in tutta la LAN.
                </Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 700, fontSize: { xs: "1rem", md: "1.1rem" } }}>
                  Routy trasforma un laptop o un desktop in un relay locale per file, video, audio e documenti. Avvii
                  il server, condividi l'URL LAN e gli altri device entrano subito nella stessa esperienza, senza
                  account e senza passaggi cloud.
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
                    Apri la libreria
                  </Button>
                  <Button component={RouterLink} to="/stream" size="large" variant="outlined">
                    Vai allo streaming
                  </Button>
                </Stack>
              </Stack>

              <Stack spacing={2}>
                <Card
                  variant="outlined"
                  sx={{
                    overflow: "hidden",
                    bgcolor: "#08131e",
                    borderColor: alpha(theme.palette.primary.main, isDark ? 0.24 : 0.1)
                  }}
                >
                  <CardMedia
                    component="img"
                    src="/visuals/routy-teaser-poster.svg"
                    alt="Visual Routy con dashboard locale, device e collegamenti di rete"
                    sx={{ display: "block", width: "100%", objectFit: "cover" }}
                  />
                </Card>
              </Stack>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ mt: { xs: 4, md: 5 } }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="overline" color="secondary.main">
                  Perche Routy
                </Typography>
                <Typography variant="h3">10 motivi semplici ma efficaci</Typography>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gap: { xs: 1, md: 1.25 },
                  gridTemplateColumns: { xs: "repeat(5, minmax(0, 1fr))", lg: "repeat(10, minmax(0, 1fr))" },
                  alignItems: "center"
                }}
              >
                {featureCards.map(({ icon: Icon, title }, index) => {
                  const isSelected = index === selectedFeatureIndex;

                  return (
                    <ButtonBase
                      key={title}
                      onClick={() => {
                        setSelectedFeatureIndex(index);
                      }}
                      aria-label={title}
                      aria-pressed={isSelected}
                      sx={{
                        minWidth: 0,
                        p: { xs: 0.4, md: 0.55 },
                        justifyContent: "center",
                        color: isSelected ? "secondary.main" : "text.secondary",
                        opacity: isSelected ? 1 : 0.52,
                        transition: "transform 160ms ease, color 160ms ease, opacity 160ms ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          color: isSelected ? "secondary.main" : "text.primary",
                          opacity: 0.82
                        }
                      }}
                    >
                      <Icon
                        sx={{
                          fontSize: { xs: 28, md: 34 },
                          transform: isSelected ? "scale(1.08)" : "scale(1)",
                          transition: "transform 160ms ease"
                        }}
                      />
                    </ButtonBase>
                  );
                })}
              </Box>

              <Card
                variant="outlined"
                sx={{
                  background: isDark
                    ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.84)} 0%, ${alpha("#08131d", 0.9)} 100%)`
                    : "rgba(255,255,255,0.76)",
                  minHeight: 150
                }}
              >
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Stack spacing={1}>
                    <Typography variant="h5">{selectedFeature.title}</Typography>
                    <Typography color="text.secondary">{selectedFeature.body}</Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
