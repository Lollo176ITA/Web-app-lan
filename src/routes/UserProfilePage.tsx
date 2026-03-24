import { useEffect, useState } from "react";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Snackbar,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Navigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { fetchClientProfile } from "../lib/api";
import { normalizeNickname } from "../lib/identity";
import { useIdentity } from "../lib/identity-context";
import { cardRadii, pageCardSx } from "../lib/surfaces";
import { useLanLiveState } from "../lib/useLanLiveState";

interface ProfileMeta {
  clientIp: string | null;
  userAgent: string | null;
}

export function UserProfilePage() {
  const { userId } = useParams();
  const theme = useTheme();
  const { identity, setIdentity } = useIdentity();
  const [nicknameDraft, setNicknameDraft] = useState(identity?.nickname ?? "");
  const [profileMeta, setProfileMeta] = useState<ProfileMeta | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const liveState = useLanLiveState();

  useEffect(() => {
    setNicknameDraft(identity?.nickname ?? "");
  }, [identity?.nickname]);

  useEffect(() => {
    void fetchClientProfile()
      .then(setProfileMeta)
      .catch(() => {
        setProfileMeta({ clientIp: null, userAgent: null });
      });
  }, []);

  if (!identity) {
    return null;
  }

  if (!userId || userId !== identity.id) {
    return <Navigate to={`/utente/${identity.id}`} replace />;
  }

  const normalizedNickname = normalizeNickname(nicknameDraft);
  const hasNicknameChanges = normalizedNickname.length > 0 && normalizedNickname !== identity.nickname;

  return (
    <Box sx={{ pb: 8 }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title="Il tuo profilo" subtitle="Identita locale" networkState={liveState} />

        <Stack spacing={3} sx={{ mt: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2.5}>
            <Card sx={{ flex: 1, ...pageCardSx }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
                      <ManageAccountsRoundedIcon />
                    </Avatar>
                    <Typography variant="h5">Modificabili</Typography>
                  </Stack>

                  <TextField
                    fullWidth
                    label="Nickname"
                    value={nicknameDraft}
                    onChange={(event) => {
                      setNicknameDraft(event.target.value);
                    }}
                    helperText="Puoi cambiarlo qui. L'identificatore utente resta invariato."
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: cardRadii.panel
                      }
                    }}
                  />

                  <Button
                    variant="contained"
                    startIcon={<SaveRoundedIcon />}
                    disabled={!hasNicknameChanges}
                    onClick={() => {
                      if (!normalizedNickname) {
                        return;
                      }

                      setIdentity({
                        ...identity,
                        nickname: normalizedNickname
                      });
                      setSnackbar("Profilo aggiornato.");
                    }}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Salva modifiche
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ flex: 1, ...pageCardSx }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Avatar sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.12), color: "secondary.main" }}>
                      <BadgeRoundedIcon />
                    </Avatar>
                    <Typography variant="h5">Identita</Typography>
                  </Stack>

                  <Box>
                    <Typography variant="overline" color="secondary.main">
                      ID utente
                    </Typography>
                    <Typography sx={{ wordBreak: "break-all" }}>{identity.id}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          <Card sx={pageCardSx}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
                    <LanRoundedIcon />
                  </Avatar>
                  <Typography variant="h5">Rete</Typography>
                </Stack>

                {profileMeta?.clientIp ? null : (
                  <Alert severity="info">Non sono riuscito a leggere l'IP client dalla richiesta corrente.</Alert>
                )}
                
                <Box>
                  <Typography variant="overline" color="secondary.main">
                    User agent
                  </Typography>
                  <Typography sx={{ wordBreak: "break-word" }}>{profileMeta?.userAgent ?? "Non disponibile"}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={2400}
        onClose={() => {
          setSnackbar(null);
        }}
        message={snackbar}
      />
    </Box>
  );
}
