"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  FilePlus2,
  FolderPlus,
  PanelLeftClose,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import type { FileNode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/store/workspace";
import { IconButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { FileIcon, FolderIcon } from "./file-icon";

interface ExplorerProps {
  onOpenFile: (path: string) => void;
  onNewFile: (parentDir?: string) => void;
  onNewFolder: (parentDir?: string) => void;
  onRename: (path: string, nextName: string) => Promise<boolean>;
  onDelete: (path: string, type: "file" | "directory") => void;
  onRefresh: () => void;
  onCollapse: () => void;
  /** Paths changed by the last agent run, badged in the tree. */
  changed: Map<string, "created" | "modified">;
}

/** Keep only nodes matching the filter, plus the folders leading to them. */
function filterTree(nodes: FileNode[], query: string): FileNode[] {
  const q = query.toLowerCase();

  const walk = (list: FileNode[]): FileNode[] =>
    list.reduce<FileNode[]>((acc, node) => {
      if (node.type === "directory") {
        const children = walk(node.children ?? []);
        if (children.length || node.name.toLowerCase().includes(q)) {
          acc.push({ ...node, children });
        }
      } else if (node.name.toLowerCase().includes(q)) {
        acc.push(node);
      }
      return acc;
    }, []);

  return walk(nodes);
}

function collectDirs(nodes: FileNode[], acc: string[] = []): string[] {
  for (const node of nodes) {
    if (node.type === "directory") {
      acc.push(node.path);
      collectDirs(node.children ?? [], acc);
    }
  }
  return acc;
}

export function Explorer({
  onOpenFile,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onRefresh,
  onCollapse,
  changed,
}: ExplorerProps) {
  const tree = useWorkspace((s) => s.tree);
  const loading = useWorkspace((s) => s.treeLoading);
  const activePath = useWorkspace((s) => s.activePath);
  const expanded = useWorkspace((s) => s.expanded);
  const toggleFolder = useWorkspace((s) => s.toggleFolder);
  const setExpanded = useWorkspace((s) => s.setExpanded);

  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);

  const visible = useMemo(
    () => (query.trim() ? filterTree(tree, query.trim()) : tree),
    [tree, query]
  );

  // A filtered tree is useless collapsed — open everything that survived.
  useEffect(() => {
    if (!query.trim()) return;
    setExpanded(collectDirs(visible), true);
  }, [query, visible, setExpanded]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-(--spacing-titlebar) shrink-0 items-center gap-0.5 border-b border-border px-2">
        <span className="mr-auto pl-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
          Explorer
        </span>
        <IconButton label="New file" size="xs" onClick={() => onNewFile()}>
          <FilePlus2 className="size-3.5" />
        </IconButton>
        <IconButton label="New folder" size="xs" onClick={() => onNewFolder()}>
          <FolderPlus className="size-3.5" />
        </IconButton>
        <IconButton label="Refresh file tree" size="xs" onClick={onRefresh}>
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </IconButton>
        <IconButton label="Hide explorer" size="xs" onClick={onCollapse}>
          <PanelLeftClose className="size-3.5" />
        </IconButton>
      </div>

      <div className="relative shrink-0 px-2 py-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-3 -translate-y-1/2 text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter files"
          aria-label="Filter files"
          spellCheck={false}
          className={cn(
            "h-7 w-full rounded-md border border-border bg-canvas pl-7 pr-7 text-[12px] text-fg",
            "placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
          )}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear filter"
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-0.5 text-subtle hover:text-fg"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-3">
        {loading && tree.length === 0 ? (
          <div className="space-y-2 px-3 py-2">
            {[92, 70, 84, 60, 76, 52, 68].map((width, i) => (
              <Skeleton key={i} className="h-3" style={{ width: `${width}%` }} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] leading-relaxed text-subtle">
            {query ? (
              <>
                No files match <span className="text-fg">{query}</span>
              </>
            ) : (
              "This project is empty. Create a file to get started."
            )}
          </p>
        ) : (
          <div role="tree" aria-label="Project files">
            {visible.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                activePath={activePath}
                expanded={expanded}
                changed={changed}
                renaming={renaming}
                setRenaming={setRenaming}
                onToggle={toggleFolder}
                onOpenFile={onOpenFile}
                onNewFile={onNewFile}
                onNewFolder={onNewFolder}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  activePath: string | null;
  expanded: Record<string, boolean>;
  changed: Map<string, "created" | "modified">;
  renaming: string | null;
  setRenaming: (path: string | null) => void;
  onToggle: (path: string) => void;
  onOpenFile: (path: string) => void;
  onNewFile: (parentDir?: string) => void;
  onNewFolder: (parentDir?: string) => void;
  onRename: (path: string, nextName: string) => Promise<boolean>;
  onDelete: (path: string, type: "file" | "directory") => void;
}

const TreeNode = memo(function TreeNode(props: TreeNodeProps) {
  const {
    node, depth, activePath, expanded, changed, renaming,
    setRenaming, onToggle, onOpenFile, onNewFile, onRename, onDelete,
  } = props;

  const isDirectory = node.type === "directory";
  const isOpen = !!expanded[node.path];
  const isActive = activePath === node.path;
  const isRenaming = renaming === node.path;
  const change = changed.get(node.path);

  const indent = 6 + depth * 11;

  if (isRenaming) {
    return (
      <RenameField
        initial={node.name}
        indent={indent}
        onCancel={() => setRenaming(null)}
        onSubmit={async (next) => {
          const ok = await onRename(node.path, next);
          if (ok) setRenaming(null);
        }}
      />
    );
  }

  return (
    <>
      <div
        role="treeitem"
        aria-selected={isActive}
        aria-expanded={isDirectory ? isOpen : undefined}
        tabIndex={0}
        onClick={() => {
          if (isDirectory) onToggle(node.path);
          else onOpenFile(node.path);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (isDirectory) onToggle(node.path);
            else onOpenFile(node.path);
          }
          if (e.key === "F2") {
            e.preventDefault();
            setRenaming(node.path);
          }
        }}
        style={{ paddingLeft: indent }}
        className={cn(
          "group/row relative flex h-[26px] cursor-pointer items-center gap-1.5 pr-1.5 text-[12.5px]",
          "transition-colors select-none",
          isActive ? "bg-active text-bright" : "text-fg hover:bg-hover"
        )}
      >
        {isActive && <span className="absolute inset-y-0 left-0 w-[2px] bg-brand" aria-hidden />}

        {isDirectory ? (
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-subtle transition-transform duration-150",
              isOpen && "rotate-90"
            )}
            aria-hidden
          />
        ) : (
          <span className="w-3 shrink-0" aria-hidden />
        )}

        {isDirectory ? <FolderIcon open={isOpen} /> : <FileIcon name={node.name} />}

        <span className="min-w-0 flex-1 truncate">{node.name}</span>

        {/* Badge files the agent just touched, so changes are findable in the tree. */}
        {change && (
          <span
            title={change === "created" ? "Created by the assistant" : "Modified by the assistant"}
            className={cn(
              "shrink-0 font-mono text-[10px] font-semibold",
              change === "created" ? "text-success" : "text-warning"
            )}
          >
            {change === "created" ? "A" : "M"}
          </span>
        )}

        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
          {isDirectory && (
            <IconButton
              label={`New file in ${node.name}`}
              size="xs"
              className="size-5"
              onClick={(e) => {
                e.stopPropagation();
                onNewFile(node.path);
              }}
            >
              <FilePlus2 className="size-3" />
            </IconButton>
          )}
          <IconButton
            label={`Rename ${node.name}`}
            size="xs"
            className="size-5"
            onClick={(e) => {
              e.stopPropagation();
              setRenaming(node.path);
            }}
          >
            <Pencil className="size-3" />
          </IconButton>
          <IconButton
            label={`Delete ${node.name}`}
            size="xs"
            className="size-5 hover:text-danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.path, node.type);
            }}
          >
            <Trash2 className="size-3" />
          </IconButton>
        </span>
      </div>

      {isDirectory &&
        isOpen &&
        (node.children ?? []).map((child) => (
          <TreeNode key={child.path} {...props} node={child} depth={depth + 1} />
        ))}
    </>
  );
});

function RenameField({
  initial,
  indent,
  onSubmit,
  onCancel,
}: {
  initial: string;
  indent: number;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    input.focus();
    // Select the base name but not the extension — the common case is
    // renaming "Nav" in "Nav.tsx", not retyping ".tsx".
    const dot = initial.lastIndexOf(".");
    input.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);

  return (
    <div className="flex h-[26px] items-center pr-1.5" style={{ paddingLeft: indent + 18 }}>
      <input
        ref={ref}
        value={value}
        spellCheck={false}
        aria-label={`Rename ${initial}`}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onCancel}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            const next = value.trim();
            if (next && next !== initial) onSubmit(next);
            else onCancel();
          }
          if (e.key === "Escape") onCancel();
        }}
        className="h-[22px] w-full rounded-[4px] border border-brand bg-canvas px-1.5 text-[12.5px] text-fg outline-none"
      />
    </div>
  );
}
