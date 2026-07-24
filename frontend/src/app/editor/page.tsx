"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser, UserButton } from "@clerk/nextjs";
import Editor from "@monaco-editor/react";
import { motion, AnimatePresence } from "framer-motion";

import { Project, FileNode, ChatMessage, ToastItem, DiffModalState, CommandAction } from "./types";
import { detectLanguage } from "./utils/languageDetector";
import { getFileIcon } from "./utils/fileIcons";
import { formatFriendlyErrorMessage } from "./utils/formatters";
import { previewSession } from "./utils/webcontainerSession";

import { FileTree } from "./components/FileTree";
import { ChatPanel } from "./components/ChatPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { CommandPalette } from "./components/CommandPalette";
import { DiffModal } from "./components/DiffModal";
import { HistoryPanel } from "./components/HistoryPanel";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { StatusBar } from "./components/StatusBar";
import { ProjectTemplates } from "./components/ProjectTemplates";
import { PendingChangesBanner, PendingChangeItem } from "./components/PendingChangesBanner";

// ─────────────────────────────────────────────────────────────
// Helper: filter file tree by query string
// ─────────────────────────────────────────────────────────────
function filterFileTree(nodes: FileNode[], query: string): FileNode[] {
  if (!query.trim()) return nodes;
  const lq = query.toLowerCase();
  return nodes
    .map((node) => {
      if (node.type === "directory") {
        const filteredChildren = filterFileTree(node.children || [], query);
        if (filteredChildren.length > 0 || node.name.toLowerCase().includes(lq)) {
          return { ...node, children: filteredChildren };
        }
        return null;
      }
      return node.name.toLowerCase().includes(lq) ? node : null;
    })
    .filter(Boolean) as FileNode[];
}

function EditorContent() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // ── Lobby ────────────────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // ── Active Workspace ──────────────────────────────────────
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Tabs & File Editor ────────────────────────────────────
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState<string>("");
  const [tempContent, setTempContent] = useState<string>("");
  const [tabContents, setTabContents] = useState<Record<string, string>>({});
  const [tabOriginalContents, setTabOriginalContents] = useState<Record<string, string>>({});
  const [unsavedChanges, setUnsavedChanges] = useState<Record<string, boolean>>({});
  const [savingFile, setSavingFile] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [tabBinaryStatus, setTabBinaryStatus] = useState<Record<string, boolean>>({});
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ── Editor UX ─────────────────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [chatWidth, setChatWidth] = useState(350);
  const [previewWidth, setPreviewWidth] = useState(420);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [wordWrap, setWordWrap] = useState<"on" | "off">("off");
  const [minimapOn, setMinimapOn] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [editorMode, setEditorMode] = useState<"code" | "preview">("code");
  const [recentFiles, setRecentFiles] = useState<string[]>([]);

  // ── Panels ────────────────────────────────────────────────
  const [showChat, setShowChat] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showFuzzyPicker, setShowFuzzyPicker] = useState(false);
  const [fuzzySearchQuery, setFuzzySearchQuery] = useState("");
  const [diffModal, setDiffModal] = useState<DiffModalState | null>(null);

  // ── Chat ─────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingActive, setStreamingActive] = useState(false);
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("llama-3.3-70b-versatile");

  // ── AI Safety ────────────────────────────────────────────
  const [fileSnapshotsBefore, setFileSnapshotsBefore] = useState<Record<string, string>>({});
  const [checkpoints, setCheckpoints] = useState<Record<number, Record<string, string>>>({});
  const [pendingAIChanges, setPendingAIChanges] = useState<{ msgIndex: number; changes: PendingChangeItem[] } | null>(null);

  // ── Toast System ─────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addToast = useCallback((message: string, type: ToastItem["type"]) => {
    setToasts((prev) => [...prev, { id: Date.now(), message, type }]);
  }, []);

  // ─────────────────────────────────────────────────────────
  // Data Fetching
  // ─────────────────────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      setLoadingProjects(true);
      const token = await getToken();
      const res = await fetch(`${API}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setProjects(await res.json());
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoadingProjects(false);
    }
  }, [isSignedIn, getToken, API]);

  const fetchFileTree = useCallback(async (projectId: string) => {
    try {
      setLoadingTree(true);
      const token = await getToken();
      const res = await fetch(`${API}/api/projects/${projectId}/files`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setFileTree(await res.json());
    } catch (err) {
      console.error("Failed to fetch file tree:", err);
    } finally {
      setLoadingTree(false);
    }
  }, [getToken, API]);

  // ─────────────────────────────────────────────────────────
  // File Operations
  // ─────────────────────────────────────────────────────────
  const openFile = useCallback(async (filePath: string) => {
    if (!activeProject) return;

    if (openTabs.includes(filePath)) {
      // Already open — just switch
      if (activeFilePath) setTabContents((prev) => ({ ...prev, [activeFilePath]: tempContent }));
      const saved = tabContents[filePath] ?? "";
      const original = tabOriginalContents[filePath] ?? "";
      setActiveFilePath(filePath);
      setActiveFileContent(original);
      setTempContent(saved);

      // Update recent files
      setRecentFiles((prev) => {
        const updated = [filePath, ...prev.filter((f) => f !== filePath)].slice(0, 10);
        localStorage.setItem(`forge_recent_${activeProject.id}`, JSON.stringify(updated));
        return updated;
      });
      return;
    }

    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/projects/${activeProject.id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ path: filePath }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.content;
        const isBinary = !!data.isBinary;

        if (activeFilePath) setTabContents((prev) => ({ ...prev, [activeFilePath]: tempContent }));

        setOpenTabs((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
        setTabOriginalContents((prev) => ({ ...prev, [filePath]: content }));
        setTabContents((prev) => ({ ...prev, [filePath]: content }));
        setTabBinaryStatus((prev) => ({ ...prev, [filePath]: isBinary }));
        setActiveFilePath(filePath);
        setActiveFileContent(content);
        setTempContent(content);
        setEditorMode("code");

        // Update recent files
        setRecentFiles((prev) => {
          const updated = [filePath, ...prev.filter((f) => f !== filePath)].slice(0, 10);
          localStorage.setItem(`forge_recent_${activeProject.id}`, JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err) {
      console.error("Failed to read file:", err);
    }
  }, [activeProject, openTabs, activeFilePath, tempContent, tabContents, tabOriginalContents, getToken, API]);

  const switchActiveTab = useCallback((newPath: string) => {
    if (newPath === activeFilePath) return;
    if (activeFilePath) setTabContents((prev) => ({ ...prev, [activeFilePath]: tempContent }));
    setActiveFilePath(newPath);
    setActiveFileContent(tabOriginalContents[newPath] ?? "");
    setTempContent(tabContents[newPath] ?? "");
  }, [activeFilePath, tempContent, tabContents, tabOriginalContents]);

  const closeTab = useCallback((path: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (unsavedChanges[path] && !window.confirm(`"${path.split("/").pop()}" has unsaved changes. Close anyway?`)) return;

    const nextTabs = openTabs.filter((t) => t !== path);
    setOpenTabs(nextTabs);
    setTabContents((prev) => { const c = { ...prev }; delete c[path]; return c; });
    setTabOriginalContents((prev) => { const c = { ...prev }; delete c[path]; return c; });
    setUnsavedChanges((prev) => { const c = { ...prev }; delete c[path]; return c; });

    if (activeFilePath === path) {
      if (nextTabs.length > 0) {
        const next = nextTabs[nextTabs.length - 1];
        setActiveFilePath(next);
        setActiveFileContent(tabOriginalContents[next] ?? "");
        setTempContent(tabContents[next] ?? "");
      } else {
        setActiveFilePath(null);
        setActiveFileContent("");
        setTempContent("");
      }
    }
  }, [openTabs, activeFilePath, unsavedChanges, tabContents, tabOriginalContents]);

  const saveFile = useCallback(async () => {
    if (!activeProject || !activeFilePath || !unsavedChanges[activeFilePath]) return;
    try {
      setSavingFile(true);
      const token = await getToken();
      const res = await fetch(`${API}/api/projects/${activeProject.id}/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ path: activeFilePath, content: tempContent }),
      });
      if (res.ok) {
        setTabOriginalContents((prev) => ({ ...prev, [activeFilePath]: tempContent }));
        setTabContents((prev) => ({ ...prev, [activeFilePath]: tempContent }));
        setUnsavedChanges((prev) => ({ ...prev, [activeFilePath]: false }));
        // Mirror into the running preview so Next.js hot-reloads the change.
        previewSession.syncFile(activeProject.id, activeFilePath, tempContent);
        addToast(`Saved ${activeFilePath.split("/").pop()}!`, "success");
      }
    } catch (err: unknown) {
      addToast(`Save failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setSavingFile(false);
    }
  }, [activeProject, activeFilePath, unsavedChanges, tempContent, getToken, API, addToast]);

  const handleNewFile = useCallback(async () => {
    if (!activeProject) return;
    const name = prompt("Enter new file path (e.g. src/components/Card.tsx):");
    if (!name?.trim()) return;
    const token = await getToken();
    const res = await fetch(`${API}/api/projects/${activeProject.id}/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path: name.trim(), content: "" }),
    });
    if (res.ok) { await fetchFileTree(activeProject.id); await openFile(name.trim()); }
  }, [activeProject, getToken, API, fetchFileTree, openFile]);

  const handleNewFolder = useCallback(async () => {
    if (!activeProject) return;
    const name = prompt("Enter new folder path:");
    if (!name?.trim()) return;
    const token = await getToken();
    const res = await fetch(`${API}/api/projects/${activeProject.id}/mkdir`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path: name.trim() }),
    });
    if (res.ok) await fetchFileTree(activeProject.id);
  }, [activeProject, getToken, API, fetchFileTree]);

  const handleDeleteFile = useCallback(async (filePath: string, type: "file" | "directory") => {
    if (!activeProject || !window.confirm(`Delete "${filePath}"?`)) return;
    const token = await getToken();
    const res = await fetch(`${API}/api/projects/${activeProject.id}/file`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path: filePath }),
    });
    if (res.ok) {
      if (type === "file" && openTabs.includes(filePath)) {
        closeTab(filePath);
      } else if (type === "directory") {
        const prefix = filePath + "/";
        openTabs.filter((t) => t.startsWith(prefix)).forEach((t) => closeTab(t));
      }
      await fetchFileTree(activeProject.id);
    }
  }, [activeProject, getToken, API, openTabs, closeTab, fetchFileTree]);

  const handleRename = useCallback(async (oldPath: string, newName: string) => {
    if (!activeProject || !newName.trim()) return;
    const parts = oldPath.split("/");
    parts[parts.length - 1] = newName.trim();
    const newPath = parts.join("/");
    if (oldPath === newPath) return;
    const token = await getToken();
    const res = await fetch(`${API}/api/projects/${activeProject.id}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ oldPath, newPath }),
    });
    if (res.ok) {
      setOpenTabs((prev) => prev.map((t) => (t === oldPath ? newPath : t)));
      if (activeFilePath === oldPath) setActiveFilePath(newPath);
      if (tabContents[oldPath] !== undefined) {
        setTabContents((prev) => { const u = { ...prev }; u[newPath] = u[oldPath]; delete u[oldPath]; return u; });
        setTabOriginalContents((prev) => { const u = { ...prev }; u[newPath] = u[oldPath]; delete u[oldPath]; return u; });
      }
      await fetchFileTree(activeProject.id);
      addToast("Renamed successfully!", "success");
    }
  }, [activeProject, getToken, API, activeFilePath, tabContents, fetchFileTree, addToast]);

  const revertFile = useCallback(async (filePath: string, oldContent: string) => {
    if (!activeProject) return;
    addToast(`Reverting ${filePath.split("/").pop()}...`, "info");
    const token = await getToken();
    const res = await fetch(`${API}/api/projects/${activeProject.id}/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path: filePath, content: oldContent }),
    });
    if (res.ok) {
      setTabOriginalContents((prev) => ({ ...prev, [filePath]: oldContent }));
      setTabContents((prev) => ({ ...prev, [filePath]: oldContent }));
      if (activeFilePath === filePath) { setActiveFileContent(oldContent); setTempContent(oldContent); }
      await fetchFileTree(activeProject.id);
      addToast(`Reverted ${filePath.split("/").pop()}!`, "success");
    }
  }, [activeProject, activeFilePath, getToken, API, fetchFileTree, addToast]);

  const restoreCheckpoint = useCallback(async (msgIndex: number) => {
    const snapshot = checkpoints[msgIndex];
    if (!snapshot || !activeProject) return;
    addToast("Restoring checkpoint...", "info");
    const token = await getToken();
    for (const [filePath, content] of Object.entries(snapshot)) {
      await fetch(`${API}/api/projects/${activeProject.id}/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ path: filePath, content }),
      });
      setTabOriginalContents((prev) => ({ ...prev, [filePath]: content }));
      setTabContents((prev) => ({ ...prev, [filePath]: content }));
      if (activeFilePath === filePath) { setActiveFileContent(content); setTempContent(content); }
    }
    await fetchFileTree(activeProject.id);
    addToast("Checkpoint restored!", "success");
    setShowHistory(false);
  }, [checkpoints, activeProject, activeFilePath, getToken, API, fetchFileTree, addToast]);

  // ─────────────────────────────────────────────────────────
  // Workspace lifecycle
  // ─────────────────────────────────────────────────────────
  const openWorkspace = useCallback((project: Project) => {
    setActiveProject(project);
    fetchFileTree(project.id);
    router.replace(`/editor?projectId=${project.id}`);

    // Load recent files
    try {
      const saved = localStorage.getItem(`forge_recent_${project.id}`);
      if (saved) setRecentFiles(JSON.parse(saved));
    } catch (_) {}
  }, [fetchFileTree, router]);

  const closeWorkspace = useCallback(() => {
    previewSession.teardown();
    setActiveProject(null);
    setFileTree([]);
    setActiveFilePath(null);
    setActiveFileContent("");
    setTempContent("");
    setOpenTabs([]);
    setTabContents({});
    setTabOriginalContents({});
    setUnsavedChanges({});
    setShowChat(false);
    setShowPreview(false);
    setSearchQuery("");
    setRecentFiles([]);
    router.replace("/editor");
  }, [router]);

  // ─────────────────────────────────────────────────────────
  // Upload / Template / Delete project
  // ─────────────────────────────────────────────────────────
  const handleFolderUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const projectName = prompt("Enter a name for this workspace project:", "my-app");
    if (!projectName?.trim()) return;
    try {
      setUploading(true);
      const payloadFiles: Array<{ path: string; content: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const pathParts = file.webkitRelativePath.split("/");
        const relativePath = pathParts.slice(1).join("/");
        if (!relativePath) continue;
        if (pathParts.some((p) => ["node_modules", "dist", ".next", ".git", ".turbo", "build", "out"].includes(p))) continue;
        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if ([".tar", ".gz", ".dll", ".exe"].includes(ext)) continue;

        const isBinary = [".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".pdf", ".zip"].includes(ext);

        const content = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string) || "");
          if (isBinary) {
            reader.readAsDataURL(file);
          } else {
            reader.readAsText(file);
          }
        });
        payloadFiles.push({ path: relativePath, content });
      }
      const token = await getToken();
      const res = await fetch(`${API}/api/projects/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: projectName.trim(), files: payloadFiles }),
      });
      if (res.ok) {
        await fetchProjects();
        addToast(`Imported "${projectName.trim()}"!`, "success");
      } else {
        const d = await res.json().catch(() => ({}));
        addToast(d.message || "Import failed.", "error");
      }
    } catch (err) {
      console.error("Upload error:", err);
      addToast("Error importing folder.", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [getToken, API, fetchProjects, addToast]);

  const handleCreateTemplate = useCallback(async (name: string, files: Array<{ path: string; content: string }>) => {
    setCreatingTemplate(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/projects/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, files }),
      });
      if (res.ok) {
        await fetchProjects();
        addToast(`Project "${name}" created!`, "success");
      }
    } catch (err) {
      console.error("Template create error:", err);
    } finally {
      setCreatingTemplate(false);
    }
  }, [getToken, API, fetchProjects, addToast]);

  const deleteProject = useCallback(async (projectId: string, name: string) => {
    if (!window.confirm(`Delete project "${name}"?`)) return;
    const token = await getToken();
    const res = await fetch(`${API}/api/projects/${projectId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      if (activeProject?.id === projectId) closeWorkspace();
      await fetchProjects();
    }
  }, [getToken, API, activeProject, closeWorkspace, fetchProjects]);

  // ─────────────────────────────────────────────────────────
  // Chat / AI Agent
  // ─────────────────────────────────────────────────────────
  const attachActiveFile = useCallback(() => {
    if (activeFilePath) setAttachedFile(activeFilePath);
  }, [activeFilePath]);

  const handleClearChat = useCallback(() => {
    if (activeProject) localStorage.removeItem(`forge_chat_${activeProject.id}`);
    setMessages([]);
  }, [activeProject]);

  const applyCodeBlock = useCallback((code: string) => {
    if (!activeFilePath) { addToast("No active file to apply code to.", "error"); return; }
    setTempContent(code);
    setUnsavedChanges((prev) => ({ ...prev, [activeFilePath]: true }));
    addToast(`Code applied to ${activeFilePath.split("/").pop()}!`, "success");
  }, [activeFilePath, addToast]);

  const handleViewDiff = useCallback((filePath: string) => {
    const before = fileSnapshotsBefore[filePath] ?? "";
    const after = tabContents[filePath] ?? "";
    setDiffModal({ filePath, before, after });
  }, [fileSnapshotsBefore, tabContents]);

  const handleSendChat = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || streamingActive || !activeProject) return;

    const userPromptText = chatInput.trim();
    const userPrompt = attachedFile ? `[Context File: ${attachedFile}]\n${userPromptText}` : userPromptText;

    setChatInput("");
    setAttachedFile(null);
    setStreamingActive(true);

    const chatHistory = messages
      .filter((m) => m.content?.trim())
      .map((m) => ({ role: m.role, content: m.content }));

    // Snapshot current file contents for revert
    setFileSnapshotsBefore((prev) => {
      const updated = { ...prev };
      Object.keys(tabContents).forEach((path) => { updated[path] = tabContents[path]; });
      return updated;
    });

    const nextAssistantIndex = messages.length + 1;
    setCheckpoints((prev) => ({ ...prev, [nextAssistantIndex]: { ...tabContents } }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userPromptText },
      { role: "assistant", content: "", status: "streaming", events: [] },
    ]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const token = await getToken();
      const response = await fetch(`${API}/api/agent/stream`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: activeProject.id, prompt: userPrompt, history: chatHistory, model: selectedModel }),
      });

      if (!response.ok) throw new Error("Server error");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      if (!reader) throw new Error("No reader");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === "[DONE]") break;

          try {
            const event = JSON.parse(dataStr);

            if (event.type === "thinking") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated.length - 1;
                if (last >= 0 && updated[last].role === "assistant") {
                  updated[last] = { ...updated[last], content: updated[last].content + event.text };
                }
                return updated;
              });
            } else if (event.type === "tool_call") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated.length - 1;
                if (last >= 0 && updated[last].role === "assistant") {
                  const evts = [...(updated[last].events ?? [])];
                  const exists = evts.some((ev) => ev.type === "tool_call" && ev.name === event.name && JSON.stringify(ev.args) === JSON.stringify(event.args));
                  if (!exists) {
                    evts.push({ type: "tool_call", name: event.name, args: event.args });
                    updated[last] = { ...updated[last], events: evts };
                  }
                }
                return updated;
              });
            } else if (event.type === "file_change") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated.length - 1;
                if (last >= 0 && updated[last].role === "assistant") {
                  let evts = [...(updated[last].events ?? [])];
                  evts = evts.filter((ev) => !(ev.type === "tool_call" && ev.args?.path === event.path));
                  evts.push({ type: "file_change", action: event.action, path: event.path, added: event.added, removed: event.removed });
                  updated[last] = { ...updated[last], events: evts };
                }
                return updated;
              });

              // Auto-refresh + mirror into the running preview for live HMR
              const updatedPath = event.path;
              (async () => {
                await fetchFileTree(activeProject.id);
                if (event.action === "Deleted") {
                  previewSession.removeFile(activeProject.id, updatedPath);
                  if (openTabs.includes(updatedPath)) closeTab(updatedPath);
                  return;
                }
                const t = await getToken();
                const r = await fetch(`${API}/api/projects/${activeProject.id}/read`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
                  body: JSON.stringify({ path: updatedPath }),
                });
                if (r.ok) {
                  const d = await r.json();
                  const newContent = d.content;
                  if (!d.isBinary) previewSession.syncFile(activeProject.id, updatedPath, newContent);
                  if (openTabs.includes(updatedPath)) {
                    setTabOriginalContents((prev) => ({ ...prev, [updatedPath]: newContent }));
                    setTabContents((prev) => ({ ...prev, [updatedPath]: newContent }));
                    setUnsavedChanges((prev) => ({ ...prev, [updatedPath]: false }));
                    if (activeFilePath === updatedPath) { setActiveFileContent(newContent); setTempContent(newContent); }
                  }
                }
              })();
            } else if (event.type === "error") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated.length - 1;
                if (last >= 0 && updated[last].role === "assistant") {
                  updated[last] = { ...updated[last], content: updated[last].content + formatFriendlyErrorMessage(event.message) };
                }
                return updated;
              });
            }
          } catch (_) { /* partial JSON */ }
        }
      }

      // Mark complete
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
          const events = updated[lastIndex].events ?? [];
          const fileChanges = events.filter((e) => e.type === "file_change");
          if (fileChanges.length > 0) {
            setPendingAIChanges({
              msgIndex: nextAssistantIndex,
              changes: fileChanges.map((e) => ({
                path: e.path || "",
                action: e.action || "Modified",
                added: e.added,
                removed: e.removed,
              })),
            });
          }
          updated[lastIndex] = {
            ...updated[lastIndex],
            status: "complete",
            events: events.filter((e) => e.type !== "tool_call"),
          };
        }
        return updated;
      });
    } catch (err: unknown) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated.length - 1;
        if (last >= 0 && updated[last].role === "assistant") {
          updated[last] = aborted
            ? {
                ...updated[last],
                content: updated[last].content + (updated[last].content ? "\n\n_(stopped)_" : "_(stopped)_"),
                status: "complete",
                events: (updated[last].events ?? []).filter((e) => e.type !== "tool_call"),
              }
            : {
                ...updated[last],
                content: `Sorry, an error occurred:\n\n${formatFriendlyErrorMessage(err instanceof Error ? err.message : String(err))}`,
                status: "complete",
              };
        }
        return updated;
      });
    } finally {
      abortControllerRef.current = null;
      setStreamingActive(false);
    }
  }, [chatInput, streamingActive, activeProject, attachedFile, messages, tabContents, selectedModel, getToken, API, fetchFileTree, openTabs, closeTab, activeFilePath]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // ─────────────────────────────────────────────────────────
  // Drag resize handlers
  // ─────────────────────────────────────────────────────────
  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const w = startWidth + (ev.clientX - startX);
      if (w >= 160 && w <= 500) { setSidebarWidth(w); localStorage.setItem("forge_sidebar_width", w.toString()); }
    };
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  const handleChatMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = chatWidth;
    const onMove = (ev: MouseEvent) => {
      const w = startWidth - (ev.clientX - startX);
      if (w >= 250 && w <= 650) { setChatWidth(w); localStorage.setItem("forge_chat_width", w.toString()); }
    };
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [chatWidth]);

  const handlePreviewMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = previewWidth;
    const onMove = (ev: MouseEvent) => {
      const w = startWidth - (ev.clientX - startX);
      if (w >= 280 && w <= 700) { setPreviewWidth(w); localStorage.setItem("forge_preview_width", w.toString()); }
    };
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [previewWidth]);

  // ─────────────────────────────────────────────────────────
  // Monaco Editor callbacks
  // ─────────────────────────────────────────────────────────
  const handleEditorWillMount = (monaco: unknown) => {
    const m = monaco as {
      editor: { defineTheme: (name: string, theme: object) => void };
      languages: {
        typescript: {
          JsxEmit: { React: number };
          ScriptTarget: { Latest: number };
          typescriptDefaults: { setCompilerOptions: (o: object) => void; setDiagnosticsOptions: (o: object) => void };
          javascriptDefaults: { setCompilerOptions: (o: object) => void; setDiagnosticsOptions: (o: object) => void };
        };
      };
    };
    const opts = {
      jsx: m.languages.typescript.JsxEmit.React,
      allowNonTsExtensions: true,
      target: m.languages.typescript.ScriptTarget.Latest,
    };
    m.languages.typescript.typescriptDefaults.setCompilerOptions(opts);
    m.languages.typescript.javascriptDefaults.setCompilerOptions(opts);
    m.languages.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
    m.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });

    // Monochrome "Forge" editor theme — near-greyscale, tuned to the black/white UI.
    m.editor.defineTheme("forge-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: "ededed" },
        { token: "comment", foreground: "5f5f5f", fontStyle: "italic" },
        { token: "keyword", foreground: "ffffff", fontStyle: "bold" },
        { token: "string", foreground: "a8a8a8" },
        { token: "number", foreground: "cfcfcf" },
        { token: "type", foreground: "ffffff" },
        { token: "delimiter", foreground: "8f8f8f" },
        { token: "tag", foreground: "ffffff" },
        { token: "attribute.name", foreground: "b8b8b8" },
        { token: "attribute.value", foreground: "9a9a9a" },
      ],
      colors: {
        "editor.background": "#000000",
        "editor.foreground": "#ededed",
        "editorLineNumber.foreground": "#3a3a3a",
        "editorLineNumber.activeForeground": "#a1a1a1",
        "editorCursor.foreground": "#ffffff",
        "editor.selectionBackground": "#ffffff22",
        "editor.inactiveSelectionBackground": "#ffffff14",
        "editor.lineHighlightBackground": "#0c0c0c",
        "editor.lineHighlightBorder": "#00000000",
        "editorIndentGuide.background1": "#1a1a1a",
        "editorIndentGuide.activeBackground1": "#333333",
        "editorWhitespace.foreground": "#222222",
        "editorGutter.background": "#000000",
        "editorWidget.background": "#0f0f0f",
        "editorWidget.border": "#262626",
        "editorSuggestWidget.background": "#0f0f0f",
        "editorSuggestWidget.selectedBackground": "#1e1e1e",
        "editorBracketMatch.background": "#ffffff1a",
        "editorBracketMatch.border": "#3a3a3a",
        "minimap.background": "#000000",
        "scrollbarSlider.background": "#ffffff14",
        "scrollbarSlider.hoverBackground": "#ffffff22",
      },
    });
  };

  const handleEditorDidMount = (editor: unknown) => {
    (editor as { onDidChangeCursorPosition: (cb: (e: { position: { lineNumber: number; column: number } }) => void) => void })
      .onDidChangeCursorPosition((e) => setCursorPosition({ line: e.position.lineNumber, column: e.position.column }));
  };

  // ─────────────────────────────────────────────────────────
  // Command Palette actions
  // ─────────────────────────────────────────────────────────
  const commandActions: CommandAction[] = [
    { id: "new-file", label: "New File", icon: "📄", description: "Create a new file in the workspace", section: "actions", action: handleNewFile },
    { id: "new-folder", label: "New Folder", icon: "📁", description: "Create a new folder", section: "actions", action: handleNewFolder },
    { id: "toggle-chat", label: "Toggle AI Chat", icon: "🤖", description: "Show or hide the AI assistant", section: "actions", action: () => setShowChat((p) => !p) },
    { id: "toggle-preview", label: "Toggle Preview", icon: "▶", description: "Show or hide the live preview panel", section: "actions", action: () => setShowPreview((p) => !p) },
    { id: "toggle-sidebar", label: "Toggle Sidebar", icon: "◀", section: "actions", action: () => setSidebarCollapsed((p) => !p) },
    { id: "save-file", label: "Save File", icon: "💾", description: "Save the currently active file", section: "actions", action: saveFile },
    { id: "clear-chat", label: "Clear Chat History", icon: "🗑️", section: "actions", action: handleClearChat },
    { id: "history", label: "View AI History", icon: "🕐", description: "See all AI file changes", section: "actions", action: () => setShowHistory(true) },
    { id: "close-project", label: "Close Project", icon: "✕", section: "actions", action: closeWorkspace },
    { id: "word-wrap", label: "Toggle Word Wrap", icon: "↵", section: "actions", action: () => setWordWrap((p) => (p === "on" ? "off" : "on")) },
    { id: "shortcuts", label: "Keyboard Shortcuts", icon: "⌨️", section: "actions", action: () => setShowShortcuts(true) },
  ];

  // ─────────────────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────────────────
  // Load projects on sign-in
  useEffect(() => {
    if (isSignedIn) fetchProjects();
    else { closeWorkspace(); setProjects([]); }
  }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore chat history per project
  useEffect(() => {
    if (activeProject) {
      try {
        const saved = localStorage.getItem(`forge_chat_${activeProject.id}`);
        setMessages(saved ? JSON.parse(saved) : []);
      } catch (_) { setMessages([]); }
    }
  }, [activeProject]);

  // Persist chat history
  useEffect(() => {
    if (activeProject && messages.length > 0) {
      localStorage.setItem(`forge_chat_${activeProject.id}`, JSON.stringify(messages));
    }
  }, [messages, activeProject]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toasts.length > 0) {
      const t = setTimeout(() => setToasts((prev) => prev.slice(1)), 4000);
      return () => clearTimeout(t);
    }
  }, [toasts]);

  // Restore panel widths
  useEffect(() => {
    const s = localStorage.getItem("forge_sidebar_width");
    const c = localStorage.getItem("forge_chat_width");
    const pv = localStorage.getItem("forge_preview_width");
    if (s) setSidebarWidth(parseInt(s, 10));
    if (c) setChatWidth(parseInt(c, 10));
    if (pv) setPreviewWidth(parseInt(pv, 10));
  }, []);

  // Rehydrate project from URL
  useEffect(() => {
    if (isSignedIn && projects.length > 0) {
      const projectId = searchParams.get("projectId");
      if (projectId && (!activeProject || activeProject.id !== projectId)) {
        const found = projects.find((p) => p.id === projectId);
        if (found) openWorkspace(found);
      }
    }
  }, [isSignedIn, projects, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync unsaved changes
  useEffect(() => {
    if (!activeFilePath) return;
    const original = tabOriginalContents[activeFilePath] ?? "";
    const isDirty = tempContent !== original;
    setUnsavedChanges((prev) => (prev[activeFilePath] === isDirty ? prev : { ...prev, [activeFilePath]: isDirty }));
  }, [tempContent, activeFilePath, tabOriginalContents]);

  // Auto-expand folders on search
  useEffect(() => {
    if (searchQuery.trim() && fileTree.length > 0) {
      const expands: Record<string, boolean> = {};
      const traverse = (node: FileNode) => {
        if (node.type === "directory") { expands[node.path] = true; node.children?.forEach(traverse); }
      };
      filterFileTree(fileTree, searchQuery).forEach(traverse);
      setExpandedFolders((prev) => ({ ...prev, ...expands }));
    }
  }, [searchQuery, fileTree]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "s") { e.preventDefault(); saveFile(); }
      if (mod && e.key === "b") { e.preventDefault(); setSidebarCollapsed((p) => !p); }
      if (mod && e.key === "`") { e.preventDefault(); setShowChat((p) => !p); }
      if (mod && e.key === "p") { e.preventDefault(); setShowFuzzyPicker((p) => !p); setFuzzySearchQuery(""); }
      if (mod && e.key === "k") { e.preventDefault(); setShowCommandPalette((p) => !p); }
      if (e.key === "Escape") {
        setShowFuzzyPicker(false);
        setShowShortcuts(false);
        setShowCommandPalette(false);
        setShowHistory(false);
        setDiffModal(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle folder
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  // Fuzzy file list
  function getFlatFileList(nodes: FileNode[]): string[] {
    let list: string[] = [];
    nodes.forEach((node) => {
      if (node.type === "file") list.push(node.path);
      else if (node.children) list = list.concat(getFlatFileList(node.children));
    });
    return list;
  }
  const flatFileList = getFlatFileList(fileTree);
  const filteredFuzzyFiles = flatFileList.filter((p) => p.toLowerCase().includes(fuzzySearchQuery.toLowerCase())).slice(0, 10);

  // ─────────────────────────────────────────────────────────
  // Auth loading screen
  // ─────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="page-loading-screen">
        <div className="page-loading-logo">
          <div className="logo-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          Forge
        </div>
        <div className="loading-bar-container"><div className="loading-bar-fill" /></div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Signed-out guard
  // ─────────────────────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <motion.div className="locked-overlay" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <h2 style={{ color: "#fff", fontWeight: 800, fontSize: "1.5rem", letterSpacing: "-0.03em" }}>Sign in to continue</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", lineHeight: 1.6, maxWidth: 340, textAlign: "center" }}>
            Forge requires authentication. Sign in to access your workspace.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
            <Link href="/" className="btn btn-secondary">Back Home</Link>
            <Link href="/sign-in" className="btn btn-primary">Sign In</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Active Workspace view
  // ─────────────────────────────────────────────────────────
  if (activeProject) {
    return (
      <div className="workspace-container">

        {/* File Tree Sidebar */}
        <FileTree
          fileTree={fileTree}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          openFile={openFile}
          activeFilePath={activeFilePath}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
          renamingPath={renamingPath}
          setRenamingPath={setRenamingPath}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          handleRename={handleRename}
          handleDeleteFile={handleDeleteFile}
          handleNewFile={handleNewFile}
          handleNewFolder={handleNewFolder}
          loadingTree={loadingTree}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          sidebarWidth={sidebarWidth}
          handleSidebarMouseDown={handleSidebarMouseDown}
          activeProject={activeProject}
          closeWorkspace={closeWorkspace}
          filterFileTree={filterFileTree}
        />

        {/* Main Editor Panel */}
        <main className="editor-panel">
          {/* Pending AI Changes Banner */}
          {pendingAIChanges && (
            <PendingChangesBanner
              changes={pendingAIChanges.changes}
              onAccept={() => setPendingAIChanges(null)}
              onReject={async () => {
                await restoreCheckpoint(pendingAIChanges.msgIndex);
                setPendingAIChanges(null);
              }}
              onViewDiff={(filePath) => handleViewDiff(filePath)}
            />
          )}

          {/* Header Bar */}
          <div className="editor-header-bar">
            <div className="active-file-title">
              {activeFilePath ? (
                <>
                  {getFileIcon(activeFilePath.split("/").pop() ?? "", true).icon}
                  <span>{activeFilePath}</span>
                  {unsavedChanges[activeFilePath] && <div className="save-indicator-dot" title="Unsaved changes" />}
                </>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>No file open</span>
              )}
            </div>

            {/* SVG preview toggle */}
            {activeFilePath?.endsWith(".svg") && (
              <div className="tab-mode-selector" style={{ marginRight: "auto", marginLeft: "1rem" }}>
                <button className={`mode-btn ${editorMode === "code" ? "active" : ""}`} onClick={() => setEditorMode("code")}>Code</button>
                <button className={`mode-btn ${editorMode === "preview" ? "active" : ""}`} onClick={() => setEditorMode("preview")}>Preview</button>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {activeFilePath && !tabBinaryStatus[activeFilePath] && (
                <>
                  <button className="sidebar-action-btn" onClick={() => setWordWrap((p) => (p === "on" ? "off" : "on"))} title="Toggle Word Wrap" style={{ color: wordWrap === "on" ? "var(--text-bright)" : "inherit", fontSize: "0.75rem", padding: "0.2rem 0.4rem" }}>Wrap</button>
                  <button className="sidebar-action-btn" onClick={() => setMinimapOn((p) => !p)} title="Toggle Minimap" style={{ color: minimapOn ? "var(--text-bright)" : "inherit", fontSize: "0.75rem", padding: "0.2rem 0.4rem" }}>Map</button>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.15rem", borderRight: "1px solid var(--border-color)", paddingRight: "0.5rem" }}>
                    <button className="sidebar-action-btn" onClick={() => setFontSize((p) => Math.max(10, p - 1))} style={{ padding: "0.15rem 0.3rem" }}>A-</button>
                    <span style={{ fontSize: "0.75rem", minWidth: "1.2rem", textAlign: "center" }}>{fontSize}</span>
                    <button className="sidebar-action-btn" onClick={() => setFontSize((p) => Math.min(24, p + 1))} style={{ padding: "0.15rem 0.3rem" }}>A+</button>
                  </div>
                </>
              )}

              {/* History button */}
              <button className="sidebar-action-btn" onClick={() => setShowHistory(true)} title="AI Change History" style={{ padding: "0.4rem" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              </button>

              {/* Shortcuts */}
              <button className="sidebar-action-btn" onClick={() => setShowShortcuts(true)} title="Keyboard Shortcuts" style={{ padding: "0.4rem" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </button>

              {/* Save button */}
              {activeFilePath && unsavedChanges[activeFilePath] && (
                <button className="btn btn-primary" disabled={savingFile} onClick={saveFile} style={{ fontSize: "0.75rem", padding: "0.4rem 1rem" }}>
                  {savingFile ? "Saving..." : "Save (Ctrl+S)"}
                </button>
              )}

              {/* Preview toggle */}
              <button className={`btn ${showPreview ? "btn-primary" : "btn-secondary"}`} onClick={() => setShowPreview((p) => !p)} style={{ fontSize: "0.75rem", padding: "0.4rem 0.75rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Preview
              </button>

              {/* Chat toggle */}
              <button className={`btn ${showChat ? "btn-primary" : "btn-secondary"}`} onClick={() => setShowChat((p) => !p)} style={{ fontSize: "0.75rem", padding: "0.4rem 1rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {showChat ? "Hide Chat" : "AI Chat"}
              </button>
            </div>
          </div>

          {/* Tabs Bar */}
          {openTabs.length > 0 && (
            <div className="tabs-container">
              {openTabs.map((tabPath) => {
                const isActive = activeFilePath === tabPath;
                const filename = tabPath.split("/").pop() || tabPath;
                const isDirty = unsavedChanges[tabPath];
                const { icon } = getFileIcon(filename, isActive);
                return (
                  <div key={tabPath} className={`tab-item ${isActive ? "active" : ""}`} onClick={() => switchActiveTab(tabPath)}>
                    <span style={{ flexShrink: 0 }}>{icon}</span>
                    <span>{filename}</span>
                    {isDirty && <span className="save-indicator-dot tab-dirty-dot" />}
                    <span className="tab-close-btn" onClick={(e) => closeTab(tabPath, e)} title="Close">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Breadcrumbs */}
          {activeFilePath && (
            <div className="editor-breadcrumb">
              <span>{activeProject.name}</span>
              <span className="separator">&gt;</span>
              {activeFilePath.split("/").map((part, i, arr) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                  <span>{part}</span>
                  {i < arr.length - 1 && <span className="separator">&gt;</span>}
                </span>
              ))}
            </div>
          )}

          {/* Monaco Editor Area */}
          <div className="editor-monaco-wrapper" style={{ position: "relative" }}>
            {activeFilePath ? (
              tabBinaryStatus[activeFilePath] || (activeFilePath.endsWith(".svg") && editorMode === "preview") ? (
                <div className="binary-preview-container">
                  {activeFilePath.endsWith(".svg") ? (
                    <div className="svg-preview" dangerouslySetInnerHTML={{ __html: tabContents[activeFilePath] || "" }} />
                  ) : (
                    <img src={tabContents[activeFilePath] || ""} alt={activeFilePath.split("/").pop()} className="image-preview" />
                  )}
                </div>
              ) : (
                <Editor
                  height="100%"
                  width="100%"
                  theme="forge-dark"
                  path={activeFilePath}
                  language={detectLanguage(activeFilePath)}
                  value={tempContent}
                  onChange={(v) => setTempContent(v || "")}
                  beforeMount={handleEditorWillMount}
                  onMount={handleEditorDidMount}
                  options={{
                    fontFamily: "var(--font-mono)",
                    fontSize,
                    lineHeight: fontSize + 8,
                    fontLigatures: true,
                    minimap: { enabled: minimapOn, renderCharacters: false },
                    scrollbar: { vertical: "visible", horizontal: "visible", verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
                    automaticLayout: true,
                    padding: { top: 14, bottom: 14 },
                    wordWrap,
                    cursorBlinking: "smooth",
                    cursorSmoothCaretAnimation: "on",
                    smoothScrolling: true,
                    bracketPairColorization: { enabled: true },
                    guides: { bracketPairs: true, indentation: true },
                    stickyScroll: { enabled: true },
                    renderWhitespace: "selection",
                    renderLineHighlight: "all",
                    formatOnPaste: true,
                    formatOnType: true,
                    tabSize: 2,
                    scrollBeyondLastLine: false,
                    roundedSelection: true,
                    suggestSelection: "first",
                    quickSuggestions: { other: true, comments: false, strings: false },
                  }}
                />
              )
            ) : (
              <WelcomeScreen
                activeProject={activeProject}
                setChatInput={setChatInput}
                setShowChat={setShowChat}
                recentFiles={recentFiles}
                openFile={openFile}
              />
            )}
          </div>

          {/* Status Bar */}
          <StatusBar
            cursorPosition={cursorPosition}
            activeFilePath={activeFilePath}
            selectedModel={selectedModel}
          />
        </main>

        {/* Preview Panel — kept mounted (hidden via CSS when closed) so the
            WebContainer dev server survives and reopening is instant. */}
        <PreviewPanel
          show={showPreview}
          onClose={() => setShowPreview(false)}
          activeProject={activeProject}
          fileTree={fileTree}
          tabContents={tabContents}
          previewWidth={previewWidth}
          handlePreviewMouseDown={handlePreviewMouseDown}
          getToken={getToken}
        />

        {/* Chat Panel */}
        {showChat && (
          <ChatPanel
            messages={messages}
            setMessages={setMessages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleSendChat={handleSendChat}
            stopStreaming={stopStreaming}
            streamingActive={streamingActive}
            attachedFile={attachedFile}
            setAttachedFile={setAttachedFile}
            attachActiveFile={attachActiveFile}
            activeFilePath={activeFilePath}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            handleClearChat={handleClearChat}
            checkpoints={checkpoints}
            restoreCheckpoint={restoreCheckpoint}
            fileSnapshotsBefore={fileSnapshotsBefore}
            revertFile={revertFile}
            chatWidth={chatWidth}
            handleChatMouseDown={handleChatMouseDown}
            setShowChat={setShowChat}
            userName={user?.firstName ?? undefined}
            onViewDiff={handleViewDiff}
            onApplyCode={applyCodeBlock}
          />
        )}

        {/* Toast Notifications */}
        {toasts.length > 0 && (
          <div className="toast-container">
            {toasts.map((t) => (
              <div key={t.id} className={`toast-item ${t.type}`}>
                {t.type === "success" && "✓"}
                {t.type === "error" && "⚠️"}
                {t.type === "info" && "ℹ"}
                <span>{t.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Command Palette (Ctrl+K) */}
        <CommandPalette
          show={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          fileTree={fileTree}
          openFile={openFile}
          actions={commandActions}
        />

        {/* Fuzzy File Picker (Ctrl+P) */}
        <AnimatePresence>
          {showFuzzyPicker && (
            <motion.div className="spotlight-overlay" onClick={() => setShowFuzzyPicker(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              <motion.div className="spotlight-modal" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.97, y: -8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: -8 }} transition={{ type: "spring", damping: 25, stiffness: 350 }}>
                <input type="text" className="spotlight-input" placeholder="Search files (Ctrl+P)..." autoFocus value={fuzzySearchQuery} onChange={(e) => setFuzzySearchQuery(e.target.value)} />
                <div className="spotlight-results">
                  {filteredFuzzyFiles.length === 0 ? (
                    <div className="spotlight-no-results">No files found</div>
                  ) : (
                    filteredFuzzyFiles.map((path) => (
                      <div key={path} className="spotlight-result-item" onClick={() => { openFile(path); setShowFuzzyPicker(false); }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan)" strokeWidth="2.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        </svg>
                        <span>{path}</span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keyboard Shortcuts Modal */}
        <AnimatePresence>
          {showShortcuts && (
            <motion.div className="shortcuts-overlay" onClick={() => setShowShortcuts(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              <motion.div className="shortcuts-modal" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.97, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 8 }} transition={{ type: "spring", damping: 25, stiffness: 350 }}>
                <div className="shortcuts-header"><h3>Keyboard Shortcuts</h3><button className="close-btn" onClick={() => setShowShortcuts(false)}>&times;</button></div>
                <div className="shortcuts-body">
                  {[
                    { keys: "Ctrl+S", desc: "Save active file" },
                    { keys: "Ctrl+P", desc: "Quick file search" },
                    { keys: "Ctrl+K", desc: "Command palette" },
                    { keys: "Ctrl+`", desc: "Toggle AI chat" },
                    { keys: "Ctrl+B", desc: "Toggle sidebar" },
                    { keys: "Esc", desc: "Close modals" },
                  ].map((s) => (
                    <div key={s.keys} className="shortcut-row">
                      <span className="shortcut-keys">{s.keys}</span>
                      <span className="shortcut-desc">{s.desc}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Diff Modal */}
        <DiffModal
          show={!!diffModal}
          onClose={() => setDiffModal(null)}
          filePath={diffModal?.filePath ?? ""}
          before={diffModal?.before ?? ""}
          after={diffModal?.after ?? ""}
        />

        {/* History Panel */}
        <HistoryPanel
          show={showHistory}
          onClose={() => setShowHistory(false)}
          messages={messages}
          checkpoints={checkpoints}
          restoreCheckpoint={restoreCheckpoint}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Lobby (Project Selection)
  // ─────────────────────────────────────────────────────────
  return (
    <div className="app-container" style={{ minHeight: "100vh" }}>
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <span>Forge</span>
        </div>
        <div className="nav-actions">
          <Link href="/" className="btn btn-secondary">Home</Link>
          <UserButton appearance={{ elements: { userButtonAvatarBox: { width: "2.25rem", height: "2.25rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)" } } }} />
        </div>
      </header>

      <div className="lobby-container">
        <div className="lobby-header">
          <h1 className="lobby-title">Your Developer Cloud Workspaces</h1>
          <p className="lobby-subtitle">Provision a new editor session or load an existing project from cloud storage.</p>
        </div>

        {/* Templates section */}
        <ProjectTemplates onCreate={handleCreateTemplate} loading={creatingTemplate} />

        <div className="lobby-divider">
          <span>or import an existing Next.js project</span>
        </div>

        <div className="lobby-grid">
          {/* Upload Zone */}
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFolderUpload} multiple
              // @ts-ignore
              directory="" webkitdirectory=""
            />
            <div className="upload-zone-icon">
              {uploading ? (
                <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                </svg>
              )}
            </div>
            <span className="upload-zone-title">{uploading ? "Analyzing Files..." : "Import a Next.js Project"}</span>
            <p className="upload-zone-desc">Only Next.js projects are supported. Auto-filters node_modules & build output.</p>
          </div>

          {/* Project list */}
          {loadingProjects ? (
            <>
              {[70, 80, 60].map((w, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-line skeleton-line-lg" style={{ width: `${w}%`, marginBottom: "1rem" }} />
                  <div className="skeleton-line" style={{ width: "40%", marginBottom: "1.5rem" }} />
                  <div className="skeleton-line skeleton-line-sm" style={{ width: "30%" }} />
                </div>
              ))}
            </>
          ) : projects.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", color: "var(--text-muted)", fontStyle: "italic", padding: "3rem 1rem", border: "1px dashed var(--border-color)", borderRadius: "1rem", textAlign: "center" }}>
              No projects yet. Create a new Next.js app or import one above.
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {projects.map((proj, idx) => (
                <motion.div key={proj.id} className="lobby-card" initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, delay: idx * 0.04 }} layout>
                  <div className="lobby-card-meta">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan)" strokeWidth="2" style={{ marginBottom: "0.5rem" }}>
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="lobby-card-title" title={proj.name}>{proj.name}</span>
                    <span className="lobby-card-date">Created: {new Date(proj.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                  </div>
                  <div className="lobby-card-actions">
                    <button className="btn btn-primary" onClick={() => openWorkspace(proj)} style={{ fontSize: "0.8rem", padding: "0.5rem 1.25rem" }}>Open Editor</button>
                    <button className="btn-danger-icon" onClick={() => deleteProject(proj.id, proj.name)} title="Delete project">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="page-loading-screen">
          <div className="page-loading-logo">
            <div className="logo-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            Forge
          </div>
          <div className="loading-bar-container">
            <div className="loading-bar-fill" />
          </div>
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
