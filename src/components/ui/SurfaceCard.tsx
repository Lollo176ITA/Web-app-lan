import { Card, type CardProps } from "@mui/material";

type SurfaceTone = "default" | "sunken" | "overlay" | "contrast";

interface SurfaceCardProps extends CardProps {
  tone?: SurfaceTone;
}

export function SurfaceCard({ tone = "default", sx, ...props }: SurfaceCardProps) {
  return (
    <Card
      elevation={0}
      sx={[
        (theme) => ({
          borderRadius: 3,
          backgroundColor:
            tone === "sunken"
              ? theme.app.surfaces.sunken
              : tone === "overlay"
                ? theme.app.surfaces.overlay
                : tone === "contrast"
                  ? theme.app.surfaces.contrast
                  : theme.app.surfaces.raised,
          borderColor: tone === "contrast" ? theme.app.outlines.strong : theme.app.outlines.soft
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
      {...props}
    />
  );
}
