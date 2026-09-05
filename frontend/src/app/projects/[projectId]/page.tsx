"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FilePlus2,
  FileCode2,
  FolderPlus,
  FolderTree,
  MessageSquare,
  PanelLeft,
  Play,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";

import { ApiError } from "@/lib/api";
import { useApi, useAuthGate, useBeforeUnload, useHotkeys, useMediaQuery } from "@/lib/hooks";
import { useAgentChat } from "@/lib/use-agent-chat";
import { previewSession } from "@/lib/webcontainer";
import {
  CHAT_MAX, CHAT_MIN, EXPLORER_MAX, EXPLORER_MIN, PREVIEW_MAX, PREVIEW_MIN, usePreferences,
} from "@/lib/store/preferences";
import { useWorkspace } from "@/lib/store/workspace";
import type { AiModel, FileChange, Project } from "@/lib/types";
import { cn, fileName, flattenFiles } from "@/lib/utils";

import { AuthPending } from "@/components/auth-pending";
import { Button } from "@/components/ui/button";
import { EmptyState, Segmented, Spinner } from "@/components/ui/primitives";
import { useDialogs } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

import { Explorer } from "@/components/workspace/explorer";
import { TabBar } from "@/components/workspace/tab-bar";
import { CodePane } from "@/components/workspace/code-pane";
import { ChatPane } from "@/components/workspace/chat-pane";
import { PreviewPane } from "@/components/workspace/preview-pane";
import { StatusBar } from "@/components/workspace/status-bar";
import { CommandPalette, type Command } from "@/components/workspace/command-palette";
import { DiffModal, type DiffTarget } from "@/components/workspace/diff-modal";
import {
  ResizeHandle, ShortcutsModal, WelcomePane, WorkspaceHeader,
} from "@/components/workspace/chrome";

type CompactPane = "files" | "editor" | "preview" | "chat";

export default function WorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { isLoaded, isSignedIn, timedOut } = useAuthGate();
  const router = useRouter();
  const api = useApi();
  const toast = useToast();
  const { prompt, confirm, dialogs } = useDialogs();

  const prefs = usePreferences();
  const {
    tree, tabs, activePath, recent, changed, attachments,
    setTree, setTreeLoading, openTab, activate, closeTab,
    syncFromServer, markSaved, renameTab, revealPath, reset,
    noteChange, clearChanges, attach, detach, clearAttachments,
  } = useWorkspace();

  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState<AiModel[]>([]);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [selection, setSelection] = useState<{ characters: number; lines: number } | null>(null);

  const [palette, setPalette] = useState<null | "all" | "files">(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [diff, setDiff] = useState<DiffTarget | null>(null);

  // Two breakpoints: below 1100px there isn't room for three panels side by
  // side; below 820px there isn't room for two, so panes take turns instead.
  const isNarrow = useMediaQuery("(max-width: 1100px)");
  const isCompact = useMediaQuery("(max-width: 820px)");
  const [compactPane, setCompactPane] = useState<CompactPane>("editor");
  const activeTab = tabs.find((t) => t.path === activePath) ?? null;
  const dirtyPaths = useMemo(() => tabs.filter((t) => t.draft !== t.saved).map((t) => t.path), [tabs]);

  /* ── Auth guard ─────────────────────────────────────────────── */

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  /* ── Load the project ───────────────────────────────────────── */

  const refreshTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      setTree(await api.projects.tree(projectId));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) setLoadError("not-found");
    } finally {
      setTreeLoading(false);
    }
  }, [api, projectId, setTree, setTreeLoading]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;

    // A fresh workspace must not inherit the previous project's tabs, badges or
    // pinned context. One external-store write, so no cascading re-render.
    reset();

    (async () => {
      try {
        const [stats, modelList] = await Promise.all([
          api.projects.stats(projectId),
          api.agent.models().catch(() => ({ models: [] as AiModel[], default: "" })),
        ]);
        if (cancelled) return;

        setProject(stats);
        setModels(modelList.models);
        // A stale saved model (Groq retires them) would 404 on every send.
        if (modelList.models.length && !modelList.models.some((m) => m.id === prefs.model)) {
          usePreferences.getState().set("model", modelList.default || modelList.models[0].id);
        }
        await refreshTree();
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiError && error.status === 404
            ? "not-found"
            : error instanceof ApiError
              ? error.userMessage
              : "Could not open this project."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // prefs.model is read once at load; adding it would re-fetch on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, projectId, isSignedIn, refreshTree, reset]);

  // Tear the preview down when leaving the workspace, but not on a re-render.
  useEffect(() => {
    return () => {
      if (previewSession.getState().projectId !== projectId) return;
      previewSession.teardown();
    };
  }, [projectId]);

  /* ── File operations ────────────────────────────────────────── */

  const openFile = useCallback(
    async (path: string) => {
      const existing = tabs.find((t) => t.path === path);
      if (existing) {
        activate(path);
        revealPath(path);
        return;
      }

      try {
        const file = await api.projects.readFile(projectId, path);
        openTab({
          path,
          saved: file.content,
          draft: file.content,
          isBinary: file.isBinary,
          truncated: file.truncated,
        });
        revealPath(path);
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.userMessage : `Could not open ${fileName(path)}.`
        );
      }
    },
    [api, projectId, tabs, activate, openTab, revealPath, toast]
  );

  const saveFile = useCallback(
    async (path: string, { silent = false } = {}) => {
      const tab = useWorkspace.getState().tabs.find((t) => t.path === path);
      if (!tab || tab.draft === tab.saved || tab.isBinary || tab.truncated) return true;

      try {
        await api.projects.writeFile(projectId, path, tab.draft);
        markSaved(path);
        previewSession.writeFile(projectId, path, tab.draft);
        if (!silent) toast.success(`Saved ${fileName(path)}`);
        return true;
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.userMessage : `Could not save ${fileName(path)}.`
        );
        return false;
      }
    },
    [api, projectId, markSaved, toast]
  );

  const saveActive = useCallback(async () => {
    if (!activePath) return;
    setSaving(true);
    await saveFile(activePath);
    setSaving(false);
  }, [activePath, saveFile]);

  const saveAll = useCallback(async () => {
    const paths = useWorkspace.getState().tabs.filter((t) => t.draft !== t.saved).map((t) => t.path);
    if (!paths.length) return;

    setSaving(true);
    const results = await Promise.all(paths.map((path) => saveFile(path, { silent: true })));
    setSaving(false);

    const saved = results.filter(Boolean).length;
    if (saved) toast.success(`Saved ${saved} file${saved === 1 ? "" : "s"}`);
  }, [saveFile, toast]);

  const closeTabSafely = useCallback(
    async (path: string) => {
      const tab = useWorkspace.getState().tabs.find((t) => t.path === path);
      if (tab && tab.draft !== tab.saved) {
        const ok = await confirm({
          title: `Discard changes to ${fileName(path)}?`,
          description: "This file has unsaved edits that will be lost.",
          confirmLabel: "Discard",
          danger: true,
        });
        if (!ok) return;
      }
      closeTab(path);
    },
    [closeTab, confirm]
  );

  const createFile = useCallback(
    async (parentDir?: string) => {
      const path = await prompt({
        title: "New file",
        description: parentDir ? `Created inside ${parentDir}/` : "Path relative to the project root.",
        placeholder: "app/about/page.tsx",
        confirmLabel: "Create",
        validate: (value) =>
          value.startsWith("/") || value.includes("..") ? "Use a path relative to the project root." : null,
      });
      if (!path) return;

      const full = parentDir ? `${parentDir}/${path}` : path;
      try {
        await api.projects.writeFile(projectId, full, "");
        await refreshTree();
        await openFile(full);
        toast.success(`Created ${fileName(full)}`);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.userMessage : "Could not create the file.");
      }
    },
    [api, projectId, prompt, refreshTree, openFile, toast]
  );

  const createFolder = useCallback(
    async (parentDir?: string) => {
      const path = await prompt({
        title: "New folder",
        description: parentDir ? `Created inside ${parentDir}/` : "Path relative to the project root.",
        placeholder: "components/ui",
        confirmLabel: "Create",
      });
      if (!path) return;

      const full = parentDir ? `${parentDir}/${path}` : path;
      try {
        await api.projects.createFolder(projectId, full);
        await refreshTree();
        toast.success(`Created ${full}`);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.userMessage : "Could not create the folder.");
      }
    },
    [api, projectId, prompt, refreshTree, toast]
  );

  const renameEntry = useCallback(
    async (path: string, nextName: string) => {
      const segments = path.split("/");
      segments[segments.length - 1] = nextName;
      const next = segments.join("/");
      if (next === path) return true;

      try {
        await api.projects.rename_(projectId, path, next);
        renameTab(path, next);
        await refreshTree();
        return true;
      } catch (error) {
        toast.error(error instanceof ApiError ? error.userMessage : "Could not rename.");
        return false;
      }
    },
    [api, projectId, renameTab, refreshTree, toast]
  );

  const deleteEntry = useCallback(
    async (path: string, type: "file" | "directory") => {
      const ok = await confirm({
        title: `Delete ${type === "directory" ? "folder" : "file"} "${fileName(path)}"?`,
        description:
          type === "directory"
            ? "Everything inside this folder will be permanently removed."
            : "This file will be permanently removed.",
        confirmLabel: "Delete",
        danger: true,
      });
      if (!ok) return;

      try {
        await api.projects.deleteFile(projectId, path);
        // Close any tab under the deleted path.
        for (const tab of useWorkspace.getState().tabs) {
          if (tab.path === path || tab.path.startsWith(`${path}/`)) closeTab(tab.path);
        }
        previewSession.removeFile(projectId, path);
        await refreshTree();
        toast.success(`Deleted ${fileName(path)}`);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.userMessage : "Could not delete.");
      }
    },
    [api, projectId, confirm, closeTab, refreshTree, toast]
  );

  /* ── Agent ──────────────────────────────────────────────────── */

  /** Pull a file the agent just wrote back into the tab and the preview. */
  const adoptAgentChange = useCallback(
    async (change: FileChange) => {
      noteChange(change.path, change.action);

      if (change.action === "deleted") {
        closeTab(change.path);
        previewSession.removeFile(projectId, change.path);
        return;
      }

      try {
        const file = await api.projects.readFile(projectId, change.path);
        if (!file.isBinary) previewSession.writeFile(projectId, change.path, file.content);

        const isOpen = useWorkspace.getState().tabs.some((t) => t.path === change.path);
        if (isOpen) syncFromServer(change.path, file.content);
      } catch {
        /* the tree refresh below will still reflect it */
      }
    },
    [api, projectId, closeTab, syncFromServer, noteChange]
  );

  const chat = useAgentChat({
    projectId,
    api,
    model: prefs.model,
    onFileChange: adoptAgentChange,
    onTurnComplete: useCallback(
      (changes: FileChange[]) => {
        refreshTree();
        toast.success(
          `Applied ${changes.length} file change${changes.length === 1 ? "" : "s"}`,
          { description: "Review the diffs in the chat, or undo the whole turn." }
        );
      },
      [refreshTree, toast]
    ),
    onError: useCallback((message: string) => toast.error(message), [toast]),
  });

  const restoreCheckpoint = useCallback(
    async (checkpoint: { id: string; fileCount: number }) => {
      const ok = await confirm({
        title: "Undo this change?",
        description: `${checkpoint.fileCount} file${checkpoint.fileCount === 1 ? "" : "s"} will be rolled back to their state before this message. Unsaved edits in those files will be lost.`,
        confirmLabel: "Undo",
        danger: true,
      });
      if (!ok) return;

      const result = await chat.restore(checkpoint.id);
      if (!result) return;

      // Re-sync every open tab that was affected.
      for (const path of result.restored) {
        if (useWorkspace.getState().tabs.some((t) => t.path === path)) {
          try {
            const file = await api.projects.readFile(projectId, path);
            syncFromServer(path, file.content);
            previewSession.writeFile(projectId, path, file.content);
          } catch {
            /* ignore */
          }
        }
      }
      for (const path of result.deleted) {
        closeTab(path);
        previewSession.removeFile(projectId, path);
      }

      clearChanges();
      await refreshTree();
      toast.success("Change undone", {
        description: `${result.restored.length} restored, ${result.deleted.length} removed.`,
      });
    },
    [api, chat, confirm, projectId, syncFromServer, closeTab, refreshTree, toast, clearChanges]
  );

  /** Show the diff between the on-disk file and its pre-turn snapshot. */
  const viewDiff = useCallback(
    async (change: FileChange) => {
      setDiff({ path: change.path, before: "", after: "", loading: true });
      try {
        const file = await api.projects.readFile(projectId, change.path);
        // The pre-edit content lives in the checkpoint; when the file is open we
        // can also diff against the buffer. Reconstruct "before" from the change
        // counts is impossible, so use the saved tab content when available.
        const tab = useWorkspace.getState().tabs.find((t) => t.path === change.path);
        setDiff({
          path: change.path,
          before: change.action === "created" ? "" : (tab?.saved ?? ""),
          after: file.content,
          unavailable:
            change.action !== "created" && !tab
              ? "Open this file first to compare it against your last saved version. To undo the whole turn, use “Undo this change” under the message."
              : undefined,
        });
      } catch (error) {
        setDiff({
          path: change.path,
          before: "",
          after: "",
          unavailable: error instanceof ApiError ? error.userMessage : "Could not load the file.",
        });
      }
    },
    [api, projectId]
  );

  /* ── Commands & shortcuts ───────────────────────────────────── */

  const files = useMemo(() => flattenFiles(tree as never), [tree]);

  const commands = useMemo<Command[]>(
    () => [
      { id: "new-file", label: "New file", shortcut: "Mod+N", icon: <FilePlus2 className="size-4" />, run: () => createFile() },
      { id: "new-folder", label: "New folder", icon: <FolderPlus className="size-4" />, run: () => createFolder() },
      { id: "save", label: "Save file", shortcut: "Mod+S", icon: <Save className="size-4" />, run: saveActive, enabled: !!activePath },
      { id: "save-all", label: "Save all files", shortcut: "Mod+Shift+S", icon: <Save className="size-4" />, run: saveAll, enabled: dirtyPaths.length > 0 },
      { id: "go-to-file", label: "Go to file", shortcut: "Mod+P", icon: <Search className="size-4" />, run: () => setPalette("files") },
      { id: "toggle-explorer", label: prefs.explorerOpen ? "Hide explorer" : "Show explorer", shortcut: "Mod+B", icon: <PanelLeft className="size-4" />, run: () => prefs.toggle("explorerOpen") },
      { id: "toggle-chat", label: prefs.chatOpen ? "Hide assistant" : "Show assistant", shortcut: "Mod+I", icon: <MessageSquare className="size-4" />, run: () => prefs.toggle("chatOpen") },
      { id: "toggle-preview", label: prefs.previewOpen ? "Hide live preview" : "Show live preview", shortcut: "Mod+Shift+P", icon: <Play className="size-4" />, run: () => prefs.toggle("previewOpen") },
      { id: "run-preview", label: "Run the dev server", icon: <Play className="size-4" />, run: () => { prefs.set("previewOpen", true); previewSession.run({ projectId, tree, drafts: {}, api }); } },
      { id: "new-chat", label: "New chat", icon: <Sparkles className="size-4" />, run: () => { prefs.set("chatOpen", true); chat.newChat(); }, enabled: !chat.streaming },
      { id: "refresh", label: "Refresh file tree", icon: <RefreshCw className="size-4" />, run: refreshTree },
      { id: "close-tab", label: "Close tab", shortcut: "Mod+W", icon: <X className="size-4" />, run: () => activePath && closeTabSafely(activePath), enabled: !!activePath },
      { id: "shortcuts", label: "Keyboard shortcuts", shortcut: "Mod+/", icon: <Undo2 className="size-4" />, run: () => setShortcutsOpen(true) },
    ],
    [activePath, api, chat, createFile, createFolder, dirtyPaths.length, prefs, projectId, refreshTree, saveActive, saveAll, closeTabSafely, tree]
  );

  const cycleTab = useCallback(
    (delta: number) => {
      const current = useWorkspace.getState();
      if (current.tabs.length < 2) return;
      const index = current.tabs.findIndex((t) => t.path === current.activePath);
      const next = (index + delta + current.tabs.length) % current.tabs.length;
      activate(current.tabs[next].path);
    },
    [activate]
  );

  useHotkeys(
    {
      "mod+s": saveActive,
      "mod+shift+s": saveAll,
      "mod+k": () => setPalette((p) => (p === "all" ? null : "all")),
      "mod+p": () => setPalette((p) => (p === "files" ? null : "files")),
      "mod+b": () => prefs.toggle("explorerOpen"),
      "mod+i": () => prefs.toggle("chatOpen"),
      "mod+shift+p": () => prefs.toggle("previewOpen"),
      "mod+n": () => createFile(),
      "mod+w": () => activePath && closeTabSafely(activePath),
      "mod+/": () => setShortcutsOpen((open) => !open),
      "mod+shift+]": () => cycleTab(1),
      "mod+shift+[": () => cycleTab(-1),
    },
    { enabled: !loadError }
  );

  useBeforeUnload(() => useWorkspace.getState().tabs.some((t) => t.draft !== t.saved));

  /* ── Render ─────────────────────────────────────────────────── */

  /** Shared by the desktop side panel and the compact single-pane layout. */
  const chatPaneProps = {
    messages: chat.messages,
    checkpoints: chat.checkpoints,
    activity: chat.activity,
    step: chat.step,
    streaming: chat.streaming,
    loadingChat: chat.loadingChat,
    chats: chat.chats,
    chatId: chat.chatId,
    models,
    model: prefs.model,
    attachments,
    activeFilePath: activePath,
    onSend: (text: string) => {
      chat.send(text, attachments);
      clearAttachments();
    },
    onStop: chat.stop,
    onNewChat: chat.newChat,
    onOpenChat: chat.openChat,
    onDeleteChat: chat.deleteChat,
    onModelChange: (model: string) => prefs.set("model", model),
    onAttach: attach,
    onDetach: detach,
    onRestore: restoreCheckpoint,
    onOpenFile: openFile,
    onViewDiff: viewDiff,
  };

  if (!isLoaded) return <AuthPending timedOut={timedOut} />;

  if (!project && !loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Spinner className="size-5 text-muted" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas p-6">
        <EmptyState
          icon={<X className="size-5 text-danger" />}
          title={loadError === "not-found" ? "That project doesn't exist" : "Couldn't open this project"}
          description={
            loadError === "not-found"
              ? "It may have been deleted, or the link points at someone else's workspace."
              : loadError
          }
          action={
            <Button size="sm" variant="primary" onClick={() => router.push("/projects")}>
              Back to projects
            </Button>
          }
        />
      </div>
    );
  }

  const showPreview = !isCompact && prefs.previewOpen;
  const showChat = !isCompact && prefs.chatOpen && !(isNarrow && showPreview);
  const showExplorer = !isCompact && prefs.explorerOpen && !isNarrow;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <WorkspaceHeader
        projectName={project!.name}
        dirtyCount={dirtyPaths.length}
        saving={saving}
        onSave={saveAll}
      />

      {isCompact && (
        <div className="flex shrink-0 items-center justify-center border-b border-border bg-surface px-2 py-1.5">
          <Segmented<CompactPane>
            value={compactPane}
            onChange={setCompactPane}
            options={[
              { value: "files", label: <><FolderTree className="size-3.5" /> Files</> },
              { value: "editor", label: <><FileCode2 className="size-3.5" /> Editor</> },
              { value: "preview", label: <><Play className="size-3.5" /> Preview</> },
              { value: "chat", label: <><MessageSquare className="size-3.5" /> Chat</> },
            ]}
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {isCompact && (
          <div className="min-w-0 flex-1">
            {compactPane === "files" ? (
              <Explorer
                changed={changed}
                onOpenFile={(path) => {
                  openFile(path);
                  setCompactPane("editor");
                }}
                onNewFile={createFile}
                onNewFolder={createFolder}
                onRename={renameEntry}
                onDelete={deleteEntry}
                onRefresh={refreshTree}
                onCollapse={() => setCompactPane("editor")}
              />
            ) : compactPane === "preview" ? (
              <PreviewPane projectId={projectId} api={api} onClose={() => setCompactPane("editor")} />
            ) : compactPane === "chat" ? (
              <ChatPane {...chatPaneProps} onClose={() => setCompactPane("editor")} />
            ) : (
              <main className="flex h-full min-w-0 flex-col">
                <TabBar onClose={closeTabSafely} />
                <div className="min-h-0 flex-1">
                  {activeTab ? (
                    <CodePane
                      tab={activeTab}
                      onCursorChange={setCursor}
                      onSelectionChange={setSelection}
                      onSave={saveActive}
                    />
                  ) : (
                    <WelcomePane
                      recent={recent}
                      onOpenFile={openFile}
                      onOpenChat={() => setCompactPane("chat")}
                      onShowShortcuts={() => setShortcutsOpen(true)}
                    />
                  )}
                </div>
              </main>
            )}
          </div>
        )}

        {showExplorer && (
          <>
            <div style={{ width: prefs.explorerWidth }} className="shrink-0">
              <Explorer
                changed={changed}
                onOpenFile={openFile}
                onNewFile={createFile}
                onNewFolder={createFolder}
                onRename={renameEntry}
                onDelete={deleteEntry}
                onRefresh={refreshTree}
                onCollapse={() => prefs.set("explorerOpen", false)}
              />
            </div>
            <ResizeHandle
              value={prefs.explorerWidth}
              min={EXPLORER_MIN}
              max={EXPLORER_MAX}
              direction="right"
              onChange={(next) => prefs.set("explorerWidth", next)}
            />
          </>
        )}

        {/* Editor */}
        <main className={cn("flex min-w-0 flex-1 flex-col", isCompact && "hidden")}>
          <TabBar onClose={closeTabSafely} />
          <div className="min-h-0 flex-1">
            {activeTab ? (
              <CodePane
                tab={activeTab}
                onCursorChange={setCursor}
                onSelectionChange={setSelection}
                onSave={saveActive}
              />
            ) : (
              <WelcomePane
                recent={recent}
                onOpenFile={openFile}
                onOpenChat={() => prefs.set("chatOpen", true)}
                onShowShortcuts={() => setShortcutsOpen(true)}
              />
            )}
          </div>
        </main>

        {showPreview && (
          <>
            <ResizeHandle
              value={prefs.previewWidth}
              min={PREVIEW_MIN}
              max={PREVIEW_MAX}
              direction="left"
              onChange={(next) => prefs.set("previewWidth", next)}
            />
            <div style={{ width: prefs.previewWidth }} className="shrink-0">
              <PreviewPane projectId={projectId} api={api} onClose={() => prefs.set("previewOpen", false)} />
            </div>
          </>
        )}

        {showChat && (
          <>
            <ResizeHandle
              value={prefs.chatWidth}
              min={CHAT_MIN}
              max={CHAT_MAX}
              direction="left"
              onChange={(next) => prefs.set("chatWidth", next)}
            />
            <div style={{ width: prefs.chatWidth }} className="shrink-0">
              <ChatPane {...chatPaneProps} onClose={() => prefs.set("chatOpen", false)} />
            </div>
          </>
        )}
      </div>

      {!isCompact && (
      <StatusBar
        cursor={cursor}
        selection={selection}
        modelLabel={models.find((m) => m.id === prefs.model)?.label ?? "Model"}
        saving={saving}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />
      )}

      <CommandPalette
        open={palette !== null}
        mode={palette ?? "all"}
        onClose={() => setPalette(null)}
        commands={commands}
        files={files}
        onOpenFile={openFile}
      />

      <DiffModal
        target={diff}
        onClose={() => setDiff(null)}
        onRevert={async (path, content) => {
          try {
            await api.projects.writeFile(projectId, path, content);
            syncFromServer(path, content);
            previewSession.writeFile(projectId, path, content);
            toast.success(`Reverted ${fileName(path)}`);
          } catch (error) {
            toast.error(error instanceof ApiError ? error.userMessage : "Could not revert the file.");
          }
        }}
      />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {dialogs}
    </div>
  );
}
