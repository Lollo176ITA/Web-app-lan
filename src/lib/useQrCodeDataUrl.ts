import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface UseQrCodeDataUrlOptions {
  width?: number;
}

const qrCodeColors = {
  dark: "#10273a",
  light: "#ffffff"
};

export function useQrCodeDataUrl(value: string | null, options: UseQrCodeDataUrlOptions = {}) {
  const { width = 256 } = options;
  const [dataUrl, setDataUrl] = useState("");

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
  }, [value, width]);

  return dataUrl;
}
