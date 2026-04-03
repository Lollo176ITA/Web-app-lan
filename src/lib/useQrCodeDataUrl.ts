import { useEffect, useState } from "react";
import { useTheme } from "@mui/material/styles";
import QRCode from "qrcode";

interface UseQrCodeDataUrlOptions {
  width?: number;
}

export function useQrCodeDataUrl(value: string | null, options: UseQrCodeDataUrlOptions = {}) {
  const theme = useTheme();
  const { width = 256 } = options;
  const [dataUrl, setDataUrl] = useState("");
  const qrCodeColors = {
    dark: theme.palette.mode === "dark" ? theme.palette.secondary.dark : theme.palette.primary.dark,
    light: theme.palette.common.white
  };

  useEffect(() => {
    if (!value) {
      setDataUrl("");
      return;
    }

    let isCurrent = true;

    void QRCode.toDataURL(value, {
      margin: 1,
      width,
      color: qrCodeColors
    })
      .then((nextDataUrl) => {
        if (isCurrent) {
          setDataUrl(nextDataUrl);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setDataUrl("");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [qrCodeColors.dark, qrCodeColors.light, value, width]);

  return dataUrl;
}
