import LockRoundedIcon from "@mui/icons-material/LockRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import { PageHeader } from "./PageHeader";
import { pageCardSx } from "../lib/surfaces";

interface FeatureDisabledPageProps {
  actionLabel: string;
  actionTo: string;
  title: string;
}

export function FeatureDisabledPage({ actionLabel, actionTo, title }: FeatureDisabledPageProps) {
  const theme = useTheme();

  return (
    <Box sx={{ pb: 7 }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 2, md: 3 } }}>
        <PageHeader title={title} subtitle="Disponibilita gestita dall'host" />

        <Card sx={{ mt: 3, ...pageCardSx }}>
          <CardContent>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.warning.main, 0.14),
                    color: "warning.main"
                  }}
                >
                  <LockRoundedIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5">Funzione disattivata dall'host</Typography>
                </Box>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                <Button component={RouterLink} to="/settings" variant="contained">
                  Vai a Impostazioni
                </Button>
                <Button component={RouterLink} to={actionTo} variant="outlined">
                  {actionLabel}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
