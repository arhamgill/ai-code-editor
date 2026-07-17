"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth, useUser, UserButton } from "@clerk/nextjs";
import Editor from "@monaco-editor/react";

interface Project {
  id: string;
  name: string;
  createdAt: string;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "complete";
}

export default function EditorPage() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  // Lobby States
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Active Workspace States
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Tabs & File Editor States
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState<string>("");
  const [tempContent, setTempContent] = useState<string>("");
  const [tabContents, setTabContents] = useState<Record<string, string>>({});
  const [tabOriginalContents, setTabOriginalContents] = useState<Record<string, string>>({});
  const [unsavedChanges, setUnsavedChanges] = useState<Record<string, boolean>>({});
  const [savingFile, setSavingFile] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // AI Assistant Chat Panel States
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hello! I am your AuraEdit AI assistant. Ask me anything about your project workspace, code files, or database snippets!",
      status: "complete"
    }
  ]);
  const [streamingActive, setStreamingActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat panel to bottom
  const scrollToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Fetch user projects
  const fetchProjects = async () => {
    if (!isSignedIn) return;
    try {
      setLoadingProjects(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoadingProjects(false);
    }
  };

  // 2. Fetch file tree for active project
  const fetchFileTree = async (projectId: string) => {
    try {
      setLoadingTree(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const tree = await res.json();
        setFileTree(tree);
      }
    } catch (err) {
      console.error("Failed to fetch file tree:", err);
    } finally {
      setLoadingTree(false);
    }
  };

  // 3. Open a file in Monaco Editor (Handles Multi-Tabs)
  const openFile = async (filePath: string) => {
    if (!activeProject) return;

    // If file is already open in a tab, just switch to it
    if (openTabs.includes(filePath)) {
      switchActiveTab(filePath);
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/projects/${activeProject.id}/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ path: filePath })
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.content;

        // Save current active tab content state before switching
        if (activeFilePath) {
          setTabContents(prev => ({ ...prev, [activeFilePath]: tempContent }));
        }

        // Initialize new tab states
        setOpenTabs(prev => [...prev, filePath]);
        setTabOriginalContents(prev => ({ ...prev, [filePath]: content }));
        setTabContents(prev => ({ ...prev, [filePath]: content }));

        setActiveFilePath(filePath);
        setActiveFileContent(content);
        setTempContent(content);
      }
    } catch (err) {
      console.error("Failed to read file:", err);
    }
  };

  // 4. Switch between open tabs
  const switchActiveTab = (newPath: string) => {
    if (newPath === activeFilePath) return;

    // Save current active tab content state
    if (activeFilePath) {
      setTabContents(prev => ({ ...prev, [activeFilePath]: tempContent }));
    }

    // Load new active tab contents
    const savedContent = tabContents[newPath] !== undefined ? tabContents[newPath] : "";
    const originalContent = tabOriginalContents[newPath] !== undefined ? tabOriginalContents[newPath] : "";

    setActiveFilePath(newPath);
    setActiveFileContent(originalContent);
    setTempContent(savedContent);
  };

  // 5. Close a tab (Prompts if dirty)
  const closeTab = (path: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const isDirty = unsavedChanges[path];
    if (isDirty) {
      const confirmClose = window.confirm(`File "${path.split("/").pop()}" has unsaved changes. Close anyway?`);
      if (!confirmClose) return;
    }

    // Remove tab
    const nextTabs = openTabs.filter(t => t !== path);
    setOpenTabs(nextTabs);

    // Clean states
    setTabContents(prev => {
      const copy = { ...prev };
      delete copy[path];
      return copy;
    });
    setTabOriginalContents(prev => {
      const copy = { ...prev };
      delete copy[path];
      return copy;
    });
    setUnsavedChanges(prev => {
      const copy = { ...prev };
      delete copy[path];
      return copy;
    });

    // Handle active tab focus shift
    if (activeFilePath === path) {
      if (nextTabs.length > 0) {
        // Focus the last tab in the list
        const nextActive = nextTabs[nextTabs.length - 1];
        const savedContent = tabContents[nextActive] !== undefined ? tabContents[nextActive] : "";
        const originalContent = tabOriginalContents[nextActive] !== undefined ? tabOriginalContents[nextActive] : "";

        setActiveFilePath(nextActive);
        setActiveFileContent(originalContent);
        setTempContent(savedContent);
      } else {
        // No tabs left open
        setActiveFilePath(null);
        setActiveFileContent("");
        setTempContent("");
      }
    }
  };

  // 6. Save current active file
  const saveFile = async () => {
    if (!activeProject || !activeFilePath || !unsavedChanges[activeFilePath]) return;

    try {
      setSavingFile(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/projects/${activeProject.id}/write`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          path: activeFilePath,
          content: tempContent
        })
      });

      if (res.ok) {
        setTabOriginalContents(prev => ({ ...prev, [activeFilePath]: tempContent }));
        setTabContents(prev => ({ ...prev, [activeFilePath]: tempContent }));
        setUnsavedChanges(prev => ({ ...prev, [activeFilePath]: false }));
      }
    } catch (err) {
      console.error("Failed to save file:", err);
    } finally {
      setSavingFile(false);
    }
  };

  // Create a new empty file in the workspace
  const handleNewFile = async () => {
    if (!activeProject) return;
    const name = prompt("Enter new file path (e.g. src/components/Card.tsx):");
    if (!name || !name.trim()) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/projects/${activeProject.id}/write`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          path: name.trim(),
          content: ""
        })
      });

      if (res.ok) {
        await fetchFileTree(activeProject.id);
        await openFile(name.trim());
      }
    } catch (err) {
      console.error("Failed to create file:", err);
    }
  };

  // Create a new folder in the workspace
  const handleNewFolder = async () => {
    if (!activeProject) return;
    const name = prompt("Enter new folder path (e.g. src/components):");
    if (!name || !name.trim()) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/projects/${activeProject.id}/mkdir`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          path: name.trim()
        })
      });

      if (res.ok) {
        await fetchFileTree(activeProject.id);
      }
    } catch (err) {
      console.error("Failed to create directory:", err);
    }
  };

  // Delete a file or folder on disk
  const handleDeleteFile = async (filePath: string, type: "file" | "directory") => {
    if (!activeProject) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete this ${type} and all its contents: "${filePath}"?`);
    if (!confirmDelete) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/projects/${activeProject.id}/file`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          path: filePath
        })
      });

      if (res.ok) {
        // If file, close its tab. If folder, close any tab starting with the folder path
        if (type === "file") {
          if (openTabs.includes(filePath)) {
            // Force close without dirty check since it's deleted
            setOpenTabs(prev => prev.filter(t => t !== filePath));
            if (activeFilePath === filePath) {
              setActiveFilePath(null);
              setActiveFileContent("");
              setTempContent("");
            }
          }
        } else {
          const folderPrefix = filePath + "/";
          setOpenTabs(prev => prev.filter(t => !t.startsWith(folderPrefix)));
          if (activeFilePath && activeFilePath.startsWith(folderPrefix)) {
            setActiveFilePath(null);
            setActiveFileContent("");
            setTempContent("");
          }
        }
        await fetchFileTree(activeProject.id);
      }
    } catch (err) {
      console.error("Failed to delete file item:", err);
    }
  };

  // 7. Send chat prompt to backend and stream response chunk-by-chunk
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || streamingActive) return;

    const userPrompt = chatInput.trim();
    setChatInput("");
    setStreamingActive(true);

    // Add user message to history
    setMessages(prev => [...prev, { role: "user", content: userPrompt }]);
    // Add temporary empty assistant message with streaming state
    setMessages(prev => [...prev, { role: "assistant", content: "", status: "streaming" }]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = await getToken();
      const response = await fetch(`${apiUrl}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: userPrompt })
      });

      if (!response.ok) {
        throw new Error("Server responded with error status");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantReply = "";

      if (!reader) {
        throw new Error("Response body reader not accessible");
      }

      // Read SSE stream chunks continuously
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        // SSE blocks are separated by double newlines \n\n
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                assistantReply += parsed.text;
                // Update active streaming message in chat state
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIndex = updated.length - 1;
                  if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
                    updated[lastIndex].content = assistantReply;
                  }
                  return updated;
                });
              }
            } catch (err) {
              // Ignore partial JSON parsing errors
            }
          }
        }
      }

      // Mark streaming completed
      setMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
          updated[lastIndex].status = "complete";
        }
        return updated;
      });

    } catch (err) {
      console.error("Streaming chat failed:", err);
      setMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
          updated[lastIndex].content = "Sorry, an error occurred while connecting to the AI helper.";
          updated[lastIndex].status = "complete";
        }
        return updated;
      });
    } finally {
      setStreamingActive(false);
    }
  };

  // 8. Folder upload handler (reads folder, filters blacklist, uploads tree)
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Prompt user for project name
    const projectName = prompt("Enter a name for this workspace project:", "my-app");
    if (!projectName || !projectName.trim()) return;

    try {
      setUploading(true);
      const payloadFiles: Array<{ path: string; content: string }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Relative path (e.g. "my-folder/src/App.js")
        // We drop the top-level folder name to upload clean sub-paths
        const pathParts = file.webkitRelativePath.split("/");
        const relativePath = pathParts.slice(1).join("/");

        if (!relativePath) continue;

        // Frontend Blacklist filtering
        if (pathParts.some(part => ["node_modules", "dist", ".next", ".git", ".turbo", "build", "out"].includes(part))) {
          continue;
        }

        // Check file extension (skip binary formats)
        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if ([".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".tar", ".gz", ".dll", ".exe", ".tmp"].includes(ext)) {
          continue;
        }

        // Read content as text string
        const content = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string || "");
          reader.readAsText(file);
        });

        payloadFiles.push({ path: relativePath, content });
      }

      // Upload JSON array payload to backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/projects/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: projectName.trim(),
          files: payloadFiles
        })
      });

      if (res.ok) {
        await fetchProjects();
      } else {
        const errorData = await res.json();
        alert(errorData.message || "Failed to upload project folder.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error occurred while reading and uploading folder.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // clear input
      }
    }
  };

  // 9. Delete a project
  const deleteProject = async (projectId: string, name: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete project "${name}" from the cloud and disk?`);
    if (!confirmDelete) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        // If deleting active project, close workspace
        if (activeProject?.id === projectId) {
          closeWorkspace();
        }
        await fetchProjects();
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  const closeWorkspace = () => {
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
    setSearchQuery("");
  };

  const openWorkspace = (project: Project) => {
    setActiveProject(project);
    fetchFileTree(project.id);
  };

  // Keyboard shortcut listener (Ctrl + S to save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeProject, activeFilePath, tempContent, unsavedChanges]);

  // Load projects on initial sign in
  useEffect(() => {
    if (isSignedIn) {
      fetchProjects();
    } else {
      closeWorkspace();
      setProjects([]);
    }
  }, [isSignedIn]);

  // Sync unsaved changes (dirty) status automatically for active tab
  useEffect(() => {
    if (!activeFilePath) return;
    const original = tabOriginalContents[activeFilePath] !== undefined ? tabOriginalContents[activeFilePath] : "";
    const current = tempContent;
    const isDirty = current !== original;

    setUnsavedChanges(prev => {
      if (prev[activeFilePath] === isDirty) return prev;
      return { ...prev, [activeFilePath]: isDirty };
    });
  }, [tempContent, activeFilePath, tabOriginalContents]);

  // Auto-expand folder tree nodes when performing searches
  useEffect(() => {
    if (searchQuery.trim() && fileTree.length > 0) {
      const expands: Record<string, boolean> = {};
      const traverse = (node: FileNode) => {
        if (node.type === "directory") {
          expands[node.path] = true;
          node.children?.forEach(traverse);
        }
      };
      const filtered = filterFileTree(fileTree, searchQuery);
      filtered.forEach(traverse);
      setExpandedFolders(prev => ({ ...prev, ...expands }));
    }
  }, [searchQuery, fileTree]);

  // Monaco language selector mapping
  const detectLanguage = (filePath: string | null) => {
    if (!filePath) return "plaintext";
    const ext = filePath.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "js":
      case "jsx":
        return "javascript";
      case "ts":
      case "tsx":
        return "typescript";
      case "json":
        return "json";
      case "css":
        return "css";
      case "html":
        return "html";
      case "md":
        return "markdown";
      default:
        return "plaintext";
    }
  };

  // Toggle Folder Collapse/Expand
  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  // Recursive search filter on the file tree structure
  const filterFileTree = (nodes: FileNode[], query: string): FileNode[] => {
    if (!query.trim()) return nodes;
    const lowerQuery = query.toLowerCase();

    return nodes
      .map(node => {
        if (node.type === "directory") {
          const filteredChildren = filterFileTree(node.children || [], query);
          if (filteredChildren.length > 0 || node.name.toLowerCase().includes(lowerQuery)) {
            return { ...node, children: filteredChildren };
          }
        } else {
          if (node.name.toLowerCase().includes(lowerQuery)) {
            return node;
          }
        }
        return null;
      })
      .filter(Boolean) as FileNode[];
  };

  // Recursive File Tree Node Renderer
  const renderFileTreeNode = (node: FileNode, depth = 0) => {
    const isFolder = node.type === "directory";
    const isExpanded = expandedFolders[node.path];
    const indentStyle = { paddingLeft: `${depth * 0.85 + 0.5}rem` };

    if (isFolder) {
      return (
        <div key={node.path}>
          <div
            className="tree-node-item"
            style={{ ...indentStyle, color: "#fff", fontWeight: 600 }}
            onClick={() => toggleFolder(node.path)}
          >
            {/* Folder Arrow */}
            <span style={{ fontSize: "0.65rem", color: "var(--color-cyan)" }}>
              {isExpanded ? "▼" : "▶"}
            </span>
            {/* Folder Icon */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--color-cyan)" }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>{node.name}</span>

            {/* Folder delete trigger */}
            <span
              className="node-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFile(node.path, "directory");
              }}
              title="Delete folder"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </span>
          </div>
          {isExpanded && node.children?.map(child => renderFileTreeNode(child, depth + 1))}
        </div>
      );
    }

    const isActive = activeFilePath === node.path;

    return (
      <div
        key={node.path}
        className={`tree-node-item ${isActive ? "active" : ""}`}
        style={indentStyle}
        onClick={() => openFile(node.path)}
      >
        {/* File Icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: isActive ? "#a5b4fc" : "var(--text-muted)" }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>

        {/* File delete trigger */}
        <span
          className="node-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteFile(node.path, "file");
          }}
          title="Delete file"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </span>
      </div>
    );
  };

  const handleEditorWillMount = (monaco: any) => {
    // Configure Monaco compiler options to enable React JSX/TSX syntax parsing
    const compilerOptions = {
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowNonTsExtensions: true,
      target: monaco.languages.typescript.ScriptTarget.Latest,
    };
    
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);

    // Disable semantic validation warnings (like missing node_modules)
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
  };

  // 10. Protect Page: Display Login overlay if signed out
  if (!isSignedIn) {
    return (
      <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div className="locked-overlay" style={{ maxWidth: "480px" }}>
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--color-purple)" }}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <h2 style={{ color: "#fff", fontWeight: 800 }}>AuraEdit AI Workspace</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.5 }}>
            You must be logged into your account to access the cloud file editor. Open, edit, and save full workspace folders synced directly inside PostgreSQL.
          </p>
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
            <Link href="/" className="btn btn-secondary">Back Home</Link>
            <Link href="/sign-in" className="btn btn-primary">Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  // 11. If Active Project Selected, display Monaco Code Workspace
  if (activeProject) {
    return (
      <div className="workspace-container">
        
        {/* Left Side: Sidebar Explorer */}
        <aside className="sidebar-explorer">
          <div className="sidebar-header">
            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
              <div className="sidebar-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                Workspace
              </div>

              {/* Sidebar Action Buttons */}
              <div className="sidebar-actions-row">
                <button className="sidebar-action-btn" onClick={handleNewFile} title="New File">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </button>
                <button className="sidebar-action-btn" onClick={handleNewFolder} title="New Folder">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div style={{ fontSize: "0.8rem", color: "#a5b4fc", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Project: {activeProject.name}
            </div>
            <button className="btn btn-secondary" onClick={closeWorkspace} style={{ fontSize: "0.75rem", padding: "0.4rem 0.75rem" }}>
              Close Project
            </button>
          </div>

          {/* Search box filter */}
          <input
            type="text"
            className="sidebar-search-box"
            placeholder="Filter files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="sidebar-content">
            {loadingTree ? (
              <div style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.8rem", fontStyle: "italic" }}>
                Scanning directory structure...
              </div>
            ) : fileTree.length === 0 ? (
              <div style={{ padding: "1.5rem", color: "var(--text-muted)", fontSize: "0.8rem", lineHeight: 1.4, textAlign: "center" }}>
                Empty project workspace. Create a file or folder to get started.
              </div>
            ) : (
              filterFileTree(fileTree, searchQuery).map(node => renderFileTreeNode(node))
            )}
          </div>
        </aside>

        {/* Middle Area: Main Editor Panel */}
        <main className="editor-panel">
          
          {/* Header Bar */}
          <div className="editor-header-bar">
            <div className="active-file-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--color-cyan)" }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>{activeFilePath || "No Active File Open"}</span>
              {activeFilePath && unsavedChanges[activeFilePath] && (
                <div className="save-indicator-dot" title="Unsaved changes"></div>
              )}
            </div>

            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              {activeFilePath && unsavedChanges[activeFilePath] && (
                <button
                  className="btn btn-primary"
                  disabled={savingFile}
                  onClick={saveFile}
                  style={{ fontSize: "0.75rem", padding: "0.4rem 1rem" }}
                >
                  {savingFile ? "Saving..." : "Save File (Ctrl+S)"}
                </button>
              )}

              <button
                className={`btn ${showChat ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setShowChat(!showChat)}
                style={{ fontSize: "0.75rem", padding: "0.4rem 1rem", display: "flex", alignItems: "center", gap: "0.35rem" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {showChat ? "Hide Chat" : "AI Chat"}
              </button>
            </div>
          </div>

          {/* Horizontal Tabs Bar */}
          {openTabs.length > 0 && (
            <div className="tabs-container">
              {openTabs.map((tabPath) => {
                const isActive = activeFilePath === tabPath;
                const filename = tabPath.split("/").pop() || tabPath;
                const isDirty = unsavedChanges[tabPath];

                return (
                  <div
                    key={tabPath}
                    className={`tab-item ${isActive ? "active" : ""}`}
                    onClick={() => switchActiveTab(tabPath)}
                  >
                    <span>{filename}</span>
                    {isDirty && (
                      <span className="save-indicator-dot" style={{ width: "6px", height: "6px" }} />
                    )}
                    <span 
                      className="tab-close-btn" 
                      onClick={(e) => closeTab(tabPath, e)}
                      title="Close file"
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Monaco Editor Container */}
          <div className="editor-monaco-wrapper">
            {activeFilePath ? (
              <Editor
                height="100%"
                width="100%"
                theme="vs-dark"
                path={activeFilePath}
                language={detectLanguage(activeFilePath)}
                value={activeFileContent}
                onChange={(value) => setTempContent(value || "")}
                beforeMount={handleEditorWillMount}
                options={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  lineHeight: 22,
                  minimap: { enabled: true },
                  scrollbar: { vertical: "visible", horizontal: "visible" },
                  automaticLayout: true,
                  padding: { top: 10 }
                }}
              />
            ) : (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
                gap: "1rem"
              }}>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                <div style={{ fontSize: "0.95rem" }}>Select a file from the explorer sidebar to begin coding.</div>
              </div>
            )}
          </div>

          {/* Status Bar */}
          <footer className="workspace-footer">
            <div>
              <span>Connected to Express & Postgres</span>
            </div>
            <div>
              <span>{detectLanguage(activeFilePath).toUpperCase()}</span>
            </div>
          </footer>

        </main>

        {/* Right Side: AI Assistant Chat Sidebar */}
        {showChat && (
          <aside className="chat-sidebar">
            <div className="chat-header">
              <div className="chat-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--color-purple)" }}>
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                AuraEdit AI Assistant
              </div>
              <button 
                className="btn-danger-icon" 
                onClick={() => setShowChat(false)}
                title="Close chat"
                style={{ padding: "0.35rem", borderRadius: "0.25rem" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Message Bubble List */}
            <div className="chat-messages">
              {messages.map((msg, index) => (
                <div key={index} className={`chat-message ${msg.role}`}>
                  <div className="message-bubble">
                    {/* Render message formatting */}
                    <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                    {msg.role === "assistant" && msg.status === "streaming" && (
                      <span className="animate-pulse" style={{ color: "var(--color-purple)", marginLeft: "2px", fontWeight: "bold" }}>▍</span>
                    )}
                  </div>
                  <span className="message-meta">
                    {msg.role === "user" ? user?.firstName || "You" : "AuraEdit AI"}
                  </span>
                </div>
              ))}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* Input Form Area */}
            <div className="chat-input-area">
              <form onSubmit={handleSendChat} className="chat-input-form">
                <textarea
                  className="chat-textarea"
                  placeholder="Ask a question or request code..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat(e);
                    }
                  }}
                  disabled={streamingActive}
                />
                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={!chatInput.trim() || streamingActive}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            </div>
          </aside>
        )}

      </div>
    );
  }

  // 12. Otherwise, render Project selection Lobby
  return (
    <div className="app-container" style={{ minHeight: "100vh" }}>
      
      {/* Navbar header */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <span>AuraEdit AI</span>
        </div>
        <div className="nav-actions">
          <Link href="/" className="btn btn-secondary">Home</Link>
          <UserButton afterSignOutUrl="/" appearance={{
            elements: {
              userButtonAvatarBox: {
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color)'
              }
            }
          }} />
        </div>
      </header>

      {/* Lobby Selection Zone */}
      <div className="lobby-container">
        
        <div className="lobby-header">
          <h1 className="lobby-title">Your Developer Cloud Workspaces</h1>
          <p className="lobby-subtitle">Provision a new editor session or load an existing project folder from PostgreSQL storage.</p>
        </div>

        <div className="lobby-grid">
          
          {/* Upload Folder Trigger Card */}
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFolderUpload}
              multiple
              // @ts-ignore - directory and webkitdirectory allow folder selection
              directory=""
              webkitdirectory=""
            />
            <div className="upload-zone-icon">
              {uploading ? (
                <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="16 16 12 12 8 16" />
                  <line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                </svg>
              )}
            </div>
            <span className="upload-zone-title">
              {uploading ? "Analyzing Files..." : "Upload Project Folder"}
            </span>
            <p className="upload-zone-desc">
              Upload local code directories. Auto-filters out node_modules, build targets, and binaries.
            </p>
          </div>

          {/* List of user projects */}
          {loadingProjects ? (
            <div style={{ gridColumn: "1 / -1", color: "var(--text-secondary)", fontStyle: "italic", padding: "3rem" }}>
              Loading cloud project directories...
            </div>
          ) : projects.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", color: "var(--text-muted)", fontStyle: "italic", padding: "3rem 1rem", border: "1px dashed var(--border-color)", borderRadius: "1rem" }}>
              No projects stored in your cloud vault. Select "Upload Project Folder" to upload your first directory.
            </div>
          ) : (
            projects.map((proj) => (
              <div key={proj.id} className="lobby-card">
                <div className="lobby-card-meta">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--color-cyan)", marginBottom: "0.5rem" }}>
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="lobby-card-title" title={proj.name}>{proj.name}</span>
                  <span className="lobby-card-date">
                    Created: {new Date(proj.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </span>
                </div>
                
                <div className="lobby-card-actions">
                  <button className="btn btn-primary" onClick={() => openWorkspace(proj)} style={{ fontSize: "0.8rem", padding: "0.5rem 1.25rem" }}>
                    Open Editor
                  </button>
                  <button className="btn-danger-icon" onClick={() => deleteProject(proj.id, proj.name)} title="Delete project">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}

        </div>

      </div>

    </div>
  );
}
