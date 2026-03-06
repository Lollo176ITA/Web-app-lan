import { useState } from "react";
import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import {
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  type IconButtonProps
} from "@mui/material";
import type { ArchiveFormat, LibraryItem } from "../../shared/types";

interface ItemActionsMenuProps {
  availableArchiveFormats: ArchiveFormat[];
  item: LibraryItem;
  onCreateArchive: (item: LibraryItem, format: ArchiveFormat) => void | Promise<void>;
  onDelete: (item: LibraryItem) => void | Promise<void>;
  onDownload: (item: LibraryItem, format?: ArchiveFormat) => void;
  onShowQrCode: (item: LibraryItem) => void | Promise<void>;
  triggerSx?: IconButtonProps["sx"];
}

const folderArchiveFormats: ArchiveFormat[] = ["zip", "7z", "rar"];
const qrCodeEnabledKinds = new Set<LibraryItem["kind"]>(["video", "image", "audio", "document"]);

function formatLabel(format: ArchiveFormat) {
  return format === "7z" ? "7Z" : format.toUpperCase();
}

export function ItemActionsMenu({
  availableArchiveFormats,
  item,
  onCreateArchive,
  onDelete,
  onDownload,
  onShowQrCode,
  triggerSx
}: ItemActionsMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const defaultDownloadFormat = availableArchiveFormats.includes("zip")
    ? "zip"
    : (availableArchiveFormats[0] ?? null);
  const canShowQrCode = qrCodeEnabledKinds.has(item.kind);

  const closeMenu = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton
        aria-label={`Azioni ${item.name}`}
        onClick={(event) => {
          event.stopPropagation();
          setAnchorEl(event.currentTarget);
        }}
        sx={triggerSx}
      >
        <MoreVertRoundedIcon />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={closeMenu}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {item.kind === "folder"
          ? [
              <MenuItem
                key="download-folder"
                disabled={!defaultDownloadFormat}
                onClick={() => {
                  closeMenu();

                  if (defaultDownloadFormat) {
                    onDownload(item, defaultDownloadFormat);
                  }
                }}
              >
                <ListItemIcon>
                  <DownloadRoundedIcon fontSize="small" />
                </ListItemIcon>
                {`Scarica cartella${defaultDownloadFormat ? ` (${formatLabel(defaultDownloadFormat)})` : ""}`}
              </MenuItem>,
              <Divider key="download-divider" />,
              ...folderArchiveFormats.map((format) => (
                <MenuItem
                  key={format}
                  disabled={!availableArchiveFormats.includes(format)}
                  onClick={() => {
                    closeMenu();
                    void onCreateArchive(item, format);
                  }}
                >
                  <ListItemIcon>
                    <ArchiveRoundedIcon fontSize="small" />
                  </ListItemIcon>
                  {`Crea archivio ${formatLabel(format)}`}
                </MenuItem>
              )),
              <Divider key="delete-divider" />
            ]
          : null}

        {item.kind !== "folder" && item.downloadUrl ? (
          <MenuItem
            onClick={() => {
              closeMenu();
              onDownload(item);
            }}
          >
            <ListItemIcon>
              <DownloadRoundedIcon fontSize="small" />
            </ListItemIcon>
            Scarica file
          </MenuItem>
        ) : null}

        {canShowQrCode ? (
          <MenuItem
            onClick={() => {
              closeMenu();
              void onShowQrCode(item);
            }}
          >
            <ListItemIcon>
              <QrCode2RoundedIcon fontSize="small" />
            </ListItemIcon>
            Mostra QR code
          </MenuItem>
        ) : null}

        <MenuItem
          onClick={() => {
            closeMenu();
            void onDelete(item);
          }}
        >
          <ListItemIcon>
            <DeleteRoundedIcon fontSize="small" />
          </ListItemIcon>
          Elimina
        </MenuItem>
      </Menu>
    </>
  );
}
