import type { LibraryKind } from "../../../shared/types";

export type FilterValue = "all" | Exclude<LibraryKind, "folder">;

export const libraryFilters: Array<{ label: string; value: FilterValue }> = [
  { label: "Tutti", value: "all" },
  { label: "Video", value: "video" },
  { label: "Immagini", value: "image" },
  { label: "Audio", value: "audio" },
  { label: "Documenti", value: "document" },
  { label: "Archivi", value: "archive" },
  { label: "Altro", value: "other" }
];
