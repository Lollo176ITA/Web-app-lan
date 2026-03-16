import { Avatar, Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DataGrid, type GridColDef, type GridRenderCellParams, type GridRowParams } from "@mui/x-data-grid";
import type { ArchiveFormat, LibraryItem } from "../../shared/types";
import { formatBytes, formatDate } from "../lib/format";
import { getLibraryItemMeta } from "../lib/library-item-meta";
import { ItemActionsMenu } from "./ItemActionsMenu";
import { EmptyState } from "./ui/EmptyState";
import { SurfaceCard } from "./ui/SurfaceCard";

interface LibraryItemsDataGridProps {
  availableArchiveFormats: ArchiveFormat[];
  items: LibraryItem[];
  selectedId: string | null;
  onCreateArchive: (item: LibraryItem, format: ArchiveFormat) => void | Promise<void>;
  onDelete: (item: LibraryItem) => void | Promise<void>;
  onDownload: (item: LibraryItem, format?: ArchiveFormat) => void;
  onOpenFolder: (folderId: string) => void;
  onSelect: (itemId: string) => void;
  onShowQrCode: (item: LibraryItem) => void | Promise<void>;
}

function PreviewCell({ item }: { item: LibraryItem }) {
  const meta = getLibraryItemMeta(useTheme(), item.kind);
  const Icon = meta.icon;

  if (item.kind === "image" && item.contentUrl) {
    return (
      <Avatar
        variant="rounded"
        src={item.contentUrl}
        alt={item.name}
        sx={{ width: 52, height: 52, borderRadius: 2.5 }}
      />
    );
  }

  return (
    <Avatar
      variant="rounded"
      sx={{
        width: 52,
        height: 52,
        borderRadius: 2.5,
        bgcolor: meta.tone.soft,
        color: meta.tone.main
      }}
    >
      <Icon />
    </Avatar>
  );
}

export function LibraryItemsDataGrid({
  availableArchiveFormats,
  items,
  selectedId,
  onCreateArchive,
  onDelete,
  onDownload,
  onOpenFolder,
  onSelect,
  onShowQrCode
}: LibraryItemsDataGridProps) {
  const theme = useTheme();

  const columns: GridColDef<LibraryItem>[] = [
    {
      field: "preview",
      headerName: "",
      width: 76,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<LibraryItem>) => <PreviewCell item={params.row} />
    },
    {
      field: "name",
      headerName: "Elemento",
      flex: 1.5,
      minWidth: 240,
      renderCell: (params: GridRenderCellParams<LibraryItem, string>) => {
        const meta = getLibraryItemMeta(theme, params.row.kind);

        return (
          <Stack spacing={0.25} justifyContent="center" sx={{ minWidth: 0 }}>
            <Typography fontWeight={700} noWrap>
              {params.value}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {meta.label}
            </Typography>
          </Stack>
        );
      }
    },
    {
      field: "summary",
      headerName: "Dettaglio",
      minWidth: 180,
      flex: 1,
      sortable: false,
      renderCell: (params: GridRenderCellParams<LibraryItem>) => (
        <Typography variant="body2" color="text.secondary" noWrap>
          {params.row.kind === "folder"
            ? `${params.row.childrenCount ?? 0} elementi`
            : `${params.row.mimeType} · ${formatBytes(params.row.sizeBytes)}`}
        </Typography>
      )
    },
    {
      field: "sizeBytes",
      headerName: "Dimensione",
      width: 140,
      align: "right",
      headerAlign: "right",
      renderCell: (params: GridRenderCellParams<LibraryItem>) => (
        <Typography variant="body2" sx={{ width: "100%", textAlign: "right" }}>
          {params.row.kind === "folder" ? `${params.row.childrenCount ?? 0} elem.` : formatBytes(params.row.sizeBytes)}
        </Typography>
      )
    },
    {
      field: "createdAt",
      headerName: "Creato",
      width: 170,
      renderCell: (params: GridRenderCellParams<LibraryItem>) => (
        <Typography variant="body2">{formatDate(params.row.createdAt)}</Typography>
      )
    },
    {
      field: "actions",
      headerName: "Azioni",
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: "right",
      headerAlign: "right",
      width: 92,
      renderCell: (params: GridRenderCellParams<LibraryItem>) => (
        <ItemActionsMenu
          availableArchiveFormats={availableArchiveFormats}
          item={params.row}
          onCreateArchive={onCreateArchive}
          onDelete={onDelete}
          onDownload={onDownload}
          onShowQrCode={onShowQrCode}
        />
      )
    }
  ];

  return (
    <SurfaceCard tone="sunken" sx={{ height: "100%" }}>
      <Box sx={{ height: 560 }}>
        <DataGrid
          aria-label="Tabella elementi libreria"
          rows={items}
          columns={columns}
          getRowHeight={() => 76}
          hideFooter
          disableColumnMenu
          disableRowSelectionOnClick
          rowSelection={false}
          onRowClick={(params: GridRowParams<LibraryItem>) => {
            if (params.row.kind === "folder") {
              onOpenFolder(params.row.id);
              return;
            }

            onSelect(params.row.id);
          }}
          getRowClassName={(params) => (params.row.id === selectedId ? "app-row-selected" : "")}
          slots={{
            noRowsOverlay: () => (
              <EmptyState
                title="Questa cartella è vuota"
                description="Carica nuovi file o crea una sottocartella per popolare la vista desktop."
              />
            )
          }}
          sx={{
            border: "none",
            "& .app-row-selected": {
              bgcolor: `${theme.app.kind.video.soft} !important`
            }
          }}
        />
      </Box>
    </SurfaceCard>
  );
}
