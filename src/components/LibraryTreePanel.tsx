import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import { Box, Stack, Typography } from "@mui/material";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import type { LibraryItem } from "../../shared/types";
import { SurfaceCard } from "./ui/SurfaceCard";
import { SectionHeader } from "./ui/SectionHeader";

interface LibraryTreePanelProps {
  currentFolderId: string | null;
  items: LibraryItem[];
  onOpenFolder: (folderId: string | null) => void;
}

interface FolderTreeNode {
  children?: FolderTreeNode[];
  id: string;
  label: string;
}

const rootId = "__root__";

function sortFolders(items: LibraryItem[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, "it", { sensitivity: "base" }));
}

function buildFolderTree(items: LibraryItem[], parentId: string | null): FolderTreeNode[] {
  return sortFolders(items.filter((item) => item.kind === "folder" && item.parentId === parentId)).map((item) => ({
    id: item.id,
    label: item.name,
    children: buildFolderTree(items, item.id)
  }));
}

function flattenNodeIds(nodes: FolderTreeNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...flattenNodeIds(node.children ?? [])]);
}

export function LibraryTreePanel({ currentFolderId, items, onOpenFolder }: LibraryTreePanelProps) {
  const treeItems: FolderTreeNode[] = [
    {
      id: rootId,
      label: "Radice LAN",
      children: buildFolderTree(items, null)
    }
  ];
  const expandedItems = [rootId, ...flattenNodeIds(treeItems)];

  return (
    <SurfaceCard tone="sunken" sx={{ height: "100%" }}>
      <Box sx={{ p: 2.5, pb: 1.5 }}>
        <SectionHeader
          eyebrow="Esplora"
          title="Cartelle"
          description="Navigazione gerarchica della libreria condivisa."
        />
      </Box>

      <Box sx={{ px: 1.25, pb: 2 }}>
        <RichTreeView
          aria-label="Esplora cartelle"
          items={treeItems}
          defaultExpandedItems={expandedItems}
          selectedItems={currentFolderId ?? rootId}
          onSelectedItemsChange={(_event, nextItemId) => {
            if (typeof nextItemId !== "string") {
              return;
            }

            onOpenFolder(nextItemId === rootId ? null : nextItemId);
          }}
          sx={{
            "& .MuiTreeItem-content": {
              gap: 1
            }
          }}
        />

        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, pt: 1.5, color: "text.secondary" }}>
          {currentFolderId ? <FolderRoundedIcon fontSize="small" /> : <LanRoundedIcon fontSize="small" />}
          <Typography variant="body2">
            {currentFolderId
              ? "La selezione nel tree cambia la cartella attiva della griglia."
              : "Sei nella radice della libreria LAN."}
          </Typography>
        </Stack>
      </Box>
    </SurfaceCard>
  );
}
