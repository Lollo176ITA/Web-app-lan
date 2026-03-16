import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import AudiotrackRoundedIcon from "@mui/icons-material/AudiotrackRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import type { Theme } from "@mui/material/styles";
import type { OverridableComponent } from "@mui/material/OverridableComponent";
import type { SvgIconTypeMap } from "@mui/material/SvgIcon";
import type { LibraryItem, LibraryKind } from "../../shared/types";

type LibraryIcon = OverridableComponent<SvgIconTypeMap<{}, "svg">> & {
  muiName: string;
};

const libraryMeta = {
  folder: { label: "Cartella", icon: FolderRoundedIcon },
  video: { label: "Video", icon: MovieRoundedIcon },
  image: { label: "Immagine", icon: ImageRoundedIcon },
  audio: { label: "Audio", icon: AudiotrackRoundedIcon },
  document: { label: "Documento", icon: DescriptionRoundedIcon },
  archive: { label: "Archivio", icon: ArchiveRoundedIcon },
  other: { label: "Altro", icon: MoreHorizRoundedIcon }
} satisfies Record<LibraryKind, { label: string; icon: LibraryIcon }>;

export function getLibraryItemMeta(theme: Theme, kind: LibraryKind) {
  const meta = libraryMeta[kind];

  return {
    ...meta,
    tone: theme.app.kind[kind]
  };
}

export function getLibraryItemLabel(kind: LibraryKind) {
  return libraryMeta[kind].label;
}

export function buildLibraryItemSummary(item: LibraryItem) {
  if (item.kind === "folder") {
    return `${item.childrenCount ?? 0} elementi`;
  }

  return libraryMeta[item.kind].label;
}
