"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, File } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileTreeNode } from "@/packages/graph/buildFolderGraph";

export interface ProjectStructureProps {
  tree: FileTreeNode;
  selectedPath?: string | null;
  onSelectFile?: (path: string) => void;
  className?: string;
}

export function ProjectStructure({ tree, selectedPath, onSelectFile, className }: ProjectStructureProps) {
  return (
    <div className={cn("select-none text-sm text-neutral-300", className)}>
      {(tree.children ?? []).map((child) => (
        <TreeRow key={child.path} node={child} depth={0} selectedPath={selectedPath} onSelectFile={onSelectFile} />
      ))}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  selectedPath,
  onSelectFile,
}: {
  node: FileTreeNode;
  depth: number;
  selectedPath?: string | null;
  onSelectFile?: (path: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const isFolder = node.type === "folder";
  const isSelected = node.path === selectedPath;

  function handleClick() {
    if (isFolder) {
      setIsOpen((prev) => !prev);
    } else {
      onSelectFile?.(node.path);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        className={cn(
          "flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left transition-colors hover:bg-neutral-800/60",
          isSelected && "bg-blue-500/15 text-blue-300"
        )}
      >
        {isFolder ? (
          <>
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
            )}
            <Folder className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            <File className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {isFolder && isOpen && (
        <div>
          {(node.children ?? []).map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
