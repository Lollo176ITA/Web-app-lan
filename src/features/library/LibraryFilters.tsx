import { Box, Tab, Tabs } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { libraryFilters, type FilterValue } from "./constants";

interface LibraryFiltersProps {
  onChange: (value: FilterValue) => void;
  value: FilterValue;
}

export function LibraryFilters({ onChange, value }: LibraryFiltersProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: "1fr",
        alignItems: "center"
      }}
    >
      <Box
        sx={{
          p: 0.75,
          borderRadius: 4,
          bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.05),
          border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)}`
        }}
      >
        <Tabs
          value={value}
          onChange={(_event, nextValue: FilterValue) => {
            onChange(nextValue);
          }}
          variant="scrollable"
          scrollButtons={false}
          sx={{
            minHeight: 0,
            "& .MuiTabs-flexContainer": {
              gap: 0.5
            },
            "& .MuiTab-root": {
              color: "text.secondary"
            },
            "& .MuiTab-root.Mui-selected": {
              bgcolor: "background.paper",
              color: "primary.main",
              boxShadow: isDark
                ? "0 10px 24px rgba(0, 0, 0, 0.3)"
                : "0 8px 18px rgba(16, 39, 58, 0.08)"
            }
          }}
        >
          {libraryFilters.map((entry) => (
            <Tab key={entry.value} label={entry.label} value={entry.value} />
          ))}
        </Tabs>
      </Box>
    </Box>
  );
}
