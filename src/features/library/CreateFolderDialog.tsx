import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from "@mui/material";

interface CreateFolderDialogProps {
  currentFolderName: string;
  folderName: string;
  onClose: () => void;
  onFolderNameChange: (value: string) => void;
  onSubmit: () => void;
  open: boolean;
}

export function CreateFolderDialog({
  currentFolderName,
  folderName,
  onClose,
  onFolderNameChange,
  onSubmit,
  open
}: CreateFolderDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Nuova cartella</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography color="text.secondary" variant="body2">
            La cartella verra creata in {currentFolderName}.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Nome cartella"
            value={folderName}
            onChange={(event) => {
              onFolderNameChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmit();
              }
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annulla</Button>
        <Button variant="contained" onClick={onSubmit}>
          Crea
        </Button>
      </DialogActions>
    </Dialog>
  );
}
