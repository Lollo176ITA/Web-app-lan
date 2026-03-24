import type { ComponentProps } from "react";
import { useState } from "react";
import { QrCodeDialog } from "../components/QrCodeDialog";
import { useQrCodeDataUrl } from "./useQrCodeDataUrl";

interface UseQrDialogOptions {
  width?: number;
}

type QrDialogControlProps = Pick<ComponentProps<typeof QrCodeDialog>, "onClose" | "open" | "qrCodeDataUrl">;

export function useQrDialog(value: string | null, options: UseQrDialogOptions = {}) {
  const [open, setOpen] = useState(false);
  const qrCodeDataUrl = useQrCodeDataUrl(value, { width: options.width });

  return {
    closeDialog: () => {
      setOpen(false);
    },
    dialogProps: {
      onClose: () => {
        setOpen(false);
      },
      open,
      qrCodeDataUrl
    } satisfies QrDialogControlProps,
    open,
    openDialog: () => {
      setOpen(true);
    },
    qrCodeDataUrl
  };
}
