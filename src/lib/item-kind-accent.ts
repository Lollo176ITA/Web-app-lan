import type { Theme } from "@mui/material/styles";
import type { LibraryItem } from "../../shared/types";

export function getItemKindAccent(theme: Theme, kind: LibraryItem["kind"]) {
  switch (kind) {
    case "folder":
    case "video":
      return theme.palette.primary.main;
    case "image":
      return theme.palette.secondary.main;
    case "audio":
      return theme.palette.info.main;
    case "document":
      return theme.palette.warning.main;
    case "archive":
      return theme.palette.mode === "dark" ? theme.palette.secondary.light : theme.palette.primary.light;
    default:
      return theme.palette.text.secondary;
  }
}
