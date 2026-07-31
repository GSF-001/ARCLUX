"use client";

import { useEffect, useRef, useState } from "react";
import { Focus, Copy, X } from "lucide-react";
import { useGraphContext } from "./GraphProvider";

export function GraphContextMenu() {
  const { graph, contextMenuNodeId, setContextMenuNodeId, selectNode, setTransform, positions, dimensions } =
    useGraphContext();
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenuNodeId) return;

    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuNodeId(null);
      }
    }

    function handleMove(e: PointerEvent) {
      setMenuPos({ x: e.clientX, y: e.clientY });
      window.removeEventListener("pointermove", handleMove);
    }

    window.addEventListener("pointermove", handleMove, { once: true });
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [contextMenuNodeId, setContextMenuNodeId]);

  if (!contextMenuNodeId || !graph) return null;

  const node = graph.nodes.find((n) => n.id === contextMenuNodeId);
  if (!node) return null;

  function focusNode() {
    if (!contextMenuNodeId) return
    const pos = positions.get(contextMenuNodeId)
    selectNode(contextMenuNodeId)
    if (pos) {
      setTransform({
        x: dimensions.width / 2 - pos.x * 2,
        y: dimensions.height / 2 - pos.y * 2,
        scale: 2,
      })
    }
    setContextMenuNodeId(null)
  }

  function copyPath() {
    if (node?.filePath) {
      navigator.clipboard?.writeText(node.filePath)
    }
    setContextMenuNodeId(null)
  }

  return (
    <div
      ref={menuRef}
      style={{ left: menuPos.x, top: menuPos.y }}
      className="fixed z-50 w-44 overflow-hidden rounded-md border bg-popover py-1 text-sm shadow-md"
    >
      <button
        onClick={focusNode}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
      >
        <Focus className="h-3.5 w-3.5" />
        Focus node
      </button>
      {node.filePath && (
        <button
          onClick={copyPath}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy path
        </button>
      )}
      <button
        onClick={() => setContextMenuNodeId(null)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-muted-foreground hover:bg-accent"
      >
        <X className="h-3.5 w-3.5" />
        Close
      </button>
    </div>
  )
}
