import type { LibraryItem } from "../../../shared/types";

export function sortFolderContents(items: LibraryItem[]) {
  return [...items].sort((left, right) => {
    if (left.kind === "folder" && right.kind !== "folder") {
      return -1;
    }

    if (left.kind !== "folder" && right.kind === "folder") {
      return 1;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

export function buildFolderPath(items: LibraryItem[], currentFolderId: string | null) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const path: LibraryItem[] = [];
  let cursor = currentFolderId ? byId.get(currentFolderId) : undefined;

  while (cursor && cursor.kind === "folder") {
    path.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  return path;
}

export function formatLibraryCount(count: number) {
  return `${count} ${count === 1 ? "elemento" : "elementi"}`;
}
