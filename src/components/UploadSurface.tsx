import { useEffect, useId, useRef, useState } from "react";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import FlashOnRoundedIcon from "@mui/icons-material/FlashOnRounded";
import FolderZipRoundedIcon from "@mui/icons-material/FolderZipRounded";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";

interface UploadSurfaceProps {
  onUpload: (files: File[]) => Promise<void>;
  targetLabel?: string;
  uploading: boolean;
}

export function UploadSurface({ onUpload, targetLabel, uploading }: UploadSurfaceProps) {
  const inputId = useId();
  const directoryInputRef = useRef<HTMLInputElement | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    directoryInputRef.current?.setAttribute("webkitdirectory", "");
    directoryInputRef.current?.setAttribute("directory", "");
  }, []);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    await onUpload(Array.from(fileList));
  }

  return (
    <Card
      variant="outlined"
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
        borderStyle: "dashed",
        borderWidth: 2,
        borderColor: isActive ? "secondary.main" : alpha("#1769aa", 0.18),
        bgcolor: isActive ? "rgba(15, 157, 148, 0.08)" : "rgba(23, 105, 170, 0.03)"
      }}
    >
      <CardContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems={{ xs: "flex-start", md: "center" }}>
          <Avatar
            sx={{
              width: 72,
              height: 72,
              bgcolor: "primary.main",
              color: "common.white",
              boxShadow: "0 12px 30px rgba(23, 105, 170, 0.24)"
            }}
          >
            {uploading ? <CircularProgress color="inherit" size={30} /> : <CloudUploadRoundedIcon sx={{ fontSize: 34 }} />}
          </Avatar>

          <Stack spacing={1.5} sx={{ flex: 1 }}>
            <Typography variant="h5">Trascina qui i tuoi file LAN</Typography>
            <Typography color="text.secondary">
              Video, immagini, audio, documenti e archivi finiscono subito nella libreria condivisa del device host.
              {targetLabel ? ` Cartella corrente: ${targetLabel}.` : ""}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip icon={<FolderZipRoundedIcon />} label="Upload multiplo" />
              <Chip label="Cartelle complete" variant="outlined" />
              <Chip icon={<FlashOnRoundedIcon />} label="Aggiornamento live" variant="outlined" />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
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
              <Button
                variant="outlined"
                size="large"
                onClick={() => {
                  directoryInputRef.current?.click();
                }}
              >
                Carica cartella
              </Button>
              <input
                ref={directoryInputRef}
                hidden
                multiple
                type="file"
                onChange={(event) => {
                  void handleFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
              <Button component="a" href="#libreria" variant="text" size="large">
                Vai alla libreria
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
