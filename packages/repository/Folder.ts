import { posix } from "node:path";
import type { FileInfo, FolderInfo } from "../shared/types";

/**
 * Derives the full folder hierarchy implied by a list of files' relativePaths.
 * Used by graph/buildFolderGraph.ts to render folder nodes without needing a
 * separate filesystem walk.
 */
export function buildFolderTree(files: FileInfo[]): FolderInfo[] {
  const foldersByPath = new Map<string, FolderInfo>();

  function ensureFolder(path: string): FolderInfo {
    const existing = foldersByPath.get(path);
    if (existing) return existing;

    const folder: FolderInfo = {
      path,
      name: path === "" ? "/" : posix.basename(path),
      fileIds: [],
      childFolderPaths: [],
    };
    foldersByPath.set(path, folder);

    if (path !== "") {
      const parentPath = posix.dirname(path);
      const normalizedParent = parentPath === "." ? "" : parentPath;
      const parent = ensureFolder(normalizedParent);
      if (!parent.childFolderPaths.includes(path)) {
        parent.childFolderPaths.push(path);
      }
    }

    return folder;
  }

  ensureFolder("");

  for (const file of files) {
    const dir = posix.dirname(file.relativePath);
    const normalizedDir = dir === "." ? "" : dir;
    const folder = ensureFolder(normalizedDir);
    folder.fileIds.push(file.relativePath);
  }

  return Array.from(foldersByPath.values());
}

export function findFolder(folders: FolderInfo[], path: string): FolderInfo | undefined {
  return folders.find((f) => f.path === path);
}
