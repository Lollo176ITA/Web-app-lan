import type { ReactNode } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

interface QrCodeDialogProps {
  actionHref?: string;
  actionIcon?: ReactNode;
  actionLabel?: string;
  copyLabel?: string;
  description: string;
  onAction?: () => void;
  onClose: () => void;
  onCopy?: () => void;
  open: boolean;
  qrCodeAlt: string;
  qrCodeDataUrl: string;
  subject?: string;
  title: string;
  url?: string | null;
}

export function QrCodeDialog({
  actionHref,
  actionIcon,
  actionLabel,
  copyLabel = "Copia link",
  description,
  onAction,
  onClose,
  onCopy,
  open,
  qrCodeAlt,
  qrCodeDataUrl,
  subject,
  title,
  url
}: QrCodeDialogProps) {
  const theme = useTheme();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1, alignItems: "center" }}>
          <Typography color="text.secondary" variant="body2" sx={{ alignSelf: "stretch" }}>
            {description}
          </Typography>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: "#ffffff",
              border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
              boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.08)}`
            }}
          >
            {qrCodeDataUrl ? (
              <Box
                component="img"
                src={qrCodeDataUrl}
                alt={qrCodeAlt}
                sx={{ width: 224, height: 224, display: "block" }}
              />
            ) : (
              <Box
                sx={{
                  width: 224,
                  height: 224,
                  display: "grid",
                  placeItems: "center"
                }}
              >
                <Typography color="text.secondary" variant="body2">
                  Generazione QR code...
                </Typography>
              </Box>
            )}
          </Box>

          {subject ? (
            <Typography variant="subtitle1" sx={{ alignSelf: "stretch", wordBreak: "break-word" }}>
              {subject}
            </Typography>
          ) : null}

          {url ? (
            <Typography
              color="text.secondary"
              variant="body2"
              sx={{ alignSelf: "stretch", wordBreak: "break-word" }}
            >
              {url}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Chiudi</Button>
        {onCopy ? <Button onClick={onCopy}>{copyLabel}</Button> : null}
        {actionHref && actionLabel ? (
          <Button
            href={actionHref}
            variant="contained"
            startIcon={actionIcon}
            rel="noreferrer"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
