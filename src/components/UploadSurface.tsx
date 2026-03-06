import { useId, useState } from "react";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import FlashOnRoundedIcon from "@mui/icons-material/FlashOnRounded";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";

interface UploadSurfaceProps {
  onUpload: (files: File[]) => Promise<void>;
  uploading: boolean;
}

export function UploadSurface({ onUpload, uploading }: UploadSurfaceProps) {
  const inputId = useId();
  const [isActive, setIsActive] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    await onUpload(Array.from(fileList));
  }

  return (
    <Box
      onDragEnter={(event) => {
        event.preventDefault();
        setIsActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsActive(false);
        void handleFiles(event.dataTransfer.files);
      }}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 6,
        border: "2px dashed",
        borderColor: isActive ? "secondary.main" : "primary.light",
        bgcolor: isActive ? "rgba(15, 157, 148, 0.08)" : "rgba(23, 105, 170, 0.04)",
        p: { xs: 3, md: 4 }
      }}
    >
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems={{ xs: "flex-start", md: "center" }}>
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: 4,
            display: "grid",
            placeItems: "center",
            bgcolor: "primary.main",
            color: "common.white",
            boxShadow: "0 14px 34px rgba(23, 105, 170, 0.28)"
          }}
        >
          {uploading ? <CircularProgress color="inherit" size={30} /> : <CloudUploadRoundedIcon sx={{ fontSize: 34 }} />}
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Trascina qui i tuoi file LAN
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 640 }}>
            Video, immagini, audio, documenti e archivi finiscono subito nella libreria condivisa del device host.
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexWrap: "wrap", rowGap: 1.5 }}>
            <Button component="label" variant="contained" size="large">
              Seleziona file
              <input
                hidden
                id={inputId}
                multiple
                type="file"
                onChange={(event) => {
                  void handleFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </Button>
            <Button component="a" href="#libreria" variant="text" size="large" startIcon={<FlashOnRoundedIcon />}>
              Vai alla libreria
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
