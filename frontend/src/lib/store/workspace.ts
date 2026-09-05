"use client";

import { create } from "zustand";
import type { FileNode } from "@/lib/types";
import { dirName } from "@/lib/utils";

export interface OpenTab {
  path: string;
  /** Content as last loaded from or saved to the server. */
  saved: string;
  /** Content currently in the editor buffer. */
  draft: string;
  isBinary: boolean;
  truncated: boolean;
}

interface WorkspaceState {
  tree: FileNode[];
  treeLoading: boolean;
  expanded: Record<string, boolean>;

  tabs: OpenTab[];
  activePath: string | null;

  /** Most-recently-opened files, for the welcome pane and command palette. */
  recent: string[];

  /** Files the most recent agent turn created or modified, badged in the tree. */
  changed: Map<string, "created" | "modified">;
  /** Files pinned as context for the next chat message. */
  attachments: string[];

  setTree: (tree: FileNode[]) => void;
  setTreeLoading: (loading: boolean) => void;
  toggleFolder: (path: string) => void;
  setExpanded: (paths: string[], expanded: boolean) => void;
  /** Expand every ancestor of a path so a revealed file is visible. */
  revealPath: (path: string) => void;

  openTab: (tab: OpenTab) => void;
  activate: (path: string) => void;
  closeTab: (path: string) => void;
  closeOthers: (path: string) => void;
  closeAll: () => void;
  updateDraft: (path: string, draft: string) => void;
  /** Accept new server content for a file, discarding the local draft. */
  syncFromServer: (path: string, content: string) => void;
  markSaved: (path: string) => void;
  renameTab: (from: string, to: string) => void;

  noteChange: (path: string, action: "created" | "modified" | "deleted") => void;
  clearChanges: () => void;
  attach: (path: string) => void;
  detach: (path: string) => void;
  clearAttachments: () => void;

  reset: () => void;

  isDirty: (path: string) => boolean;
  dirtyPaths: () => string[];
  activeTab: () => OpenTab | null;
}

const MAX_RECENT = 12;

/** Ancestors of "app/about/page.tsx" → ["app", "app/about"]. */
function ancestors(path: string): string[] {
  const out: string[] = [];
  let dir = dirName(path);
  while (dir) {
    out.unshift(dir);
    dir = dirName(dir);
  }
  return out;
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  tree: [],
  treeLoading: false,
  expanded: {},
  tabs: [],
  activePath: null,
  recent: [],
  changed: new Map(),
  attachments: [],

  setTree: (tree) => set({ tree }),
  setTreeLoading: (treeLoading) => set({ treeLoading }),

  toggleFolder: (path) =>
    set((state) => ({ expanded: { ...state.expanded, [path]: !state.expanded[path] } })),

  setExpanded: (paths, expanded) =>
    set((state) => {
      const next = { ...state.expanded };
      for (const path of paths) next[path] = expanded;
      return { expanded: next };
    }),

  revealPath: (path) =>
    set((state) => {
      const next = { ...state.expanded };
      for (const dir of ancestors(path)) next[dir] = true;
      return { expanded: next };
    }),

  openTab: (tab) =>
    set((state) => {
      const existing = state.tabs.findIndex((t) => t.path === tab.path);
      const tabs =
        existing === -1
          ? [...state.tabs, tab]
          : state.tabs.map((t, i) => (i === existing ? { ...tab, draft: t.draft } : t));

      return {
        tabs,
        activePath: tab.path,
        recent: [tab.path, ...state.recent.filter((p) => p !== tab.path)].slice(0, MAX_RECENT),
      };
    }),

  activate: (path) =>
    set((state) => ({
      activePath: path,
      recent: [path, ...state.recent.filter((p) => p !== path)].slice(0, MAX_RECENT),
    })),

  closeTab: (path) =>
    set((state) => {
      const index = state.tabs.findIndex((t) => t.path === path);
      if (index === -1) return state;

      const tabs = state.tabs.filter((t) => t.path !== path);
      if (state.activePath !== path) return { tabs };

      // Focus the neighbour, matching what every editor does — the old code
      // always jumped to the last tab, which felt random.
      const neighbour = tabs[index] ?? tabs[index - 1] ?? null;
      return { tabs, activePath: neighbour?.path ?? null };
    }),

  closeOthers: (path) =>
    set((state) => ({ tabs: state.tabs.filter((t) => t.path === path), activePath: path })),

  closeAll: () => set({ tabs: [], activePath: null }),

  updateDraft: (path, draft) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.path === path ? { ...t, draft } : t)),
    })),

  syncFromServer: (path, content) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.path === path ? { ...t, saved: content, draft: content } : t)),
    })),

  markSaved: (path) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.path === path ? { ...t, saved: t.draft } : t)),
    })),

  renameTab: (from, to) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.path === from ? { ...t, path: to } : t)),
      activePath: state.activePath === from ? to : state.activePath,
      recent: state.recent.map((p) => (p === from ? to : p)),
    })),

  noteChange: (path, action) =>
    set((state) => {
      const changed = new Map(state.changed);
      if (action === "deleted") changed.delete(path);
      else changed.set(path, action);
      return { changed };
    }),

  clearChanges: () => set({ changed: new Map() }),

  attach: (path) =>
    set((state) =>
      state.attachments.includes(path) ? state : { attachments: [...state.attachments, path] }
    ),

  detach: (path) =>
    set((state) => ({ attachments: state.attachments.filter((p) => p !== path) })),

  clearAttachments: () => set({ attachments: [] }),

  /**
   * Wipe every trace of the previous project.
   *
   * All of this lives in the store rather than in the page's `useState` so
   * switching projects is a single external-store write, not a burst of
   * synchronous setState calls inside an effect.
   */
  reset: () =>
    set({
      tree: [],
      expanded: {},
      tabs: [],
      activePath: null,
      recent: [],
      treeLoading: false,
      changed: new Map(),
      attachments: [],
    }),

  isDirty: (path) => {
    const tab = get().tabs.find((t) => t.path === path);
    return !!tab && tab.draft !== tab.saved;
  },

  dirtyPaths: () => get().tabs.filter((t) => t.draft !== t.saved).map((t) => t.path),

  activeTab: () => {
    const { tabs, activePath } = get();
    return tabs.find((t) => t.path === activePath) ?? null;
  },
}));
