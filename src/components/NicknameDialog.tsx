import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { normalizeNickname } from "../lib/identity";

interface NicknameDialogProps {
  initialValue?: string;
  open: boolean;
  onClose?: () => void;
  onSave: (nickname: string) => void;
}

export function NicknameDialog({ initialValue = "", open, onClose, onSave }: NicknameDialogProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
    }
  }, [initialValue, open]);

  const normalized = normalizeNickname(value);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Nickname LAN</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="Nickname"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && normalized) {
                event.preventDefault();
                onSave(normalized);
              }
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        {onClose ? <Button onClick={onClose}>Annulla</Button> : null}
        <Button
          variant="contained"
          disabled={!normalized}
          onClick={() => {
            onSave(normalized);
          }}
        >
          Salva
        </Button>
      </DialogActions>
    </Dialog>
  );
}
