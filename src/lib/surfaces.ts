import type { Theme } from "@mui/material/styles";
import type { SxProps } from "@mui/material";

export const cardRadii = {
  page: "20px",
  inset: "16px",
  panel: "14px"
} as const;

export const pageCardSx: SxProps<Theme> = {
  minWidth: 0,
  borderRadius: cardRadii.page
};

export const insetCardSx: SxProps<Theme> = {
  minWidth: 0,
  borderRadius: cardRadii.inset
};
