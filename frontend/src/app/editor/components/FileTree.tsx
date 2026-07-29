"use client";

import React from "react";
import { FileNode, Project } from "../types";
import { getFileIcon, getFolderIcon } from "../utils/fileIcons";

interface FileTreeProps {
  fileTree: FileNode[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  openFile: (path: string) => void;
  activeFilePath: string | null;
  expandedFolders: Record<string, boolean>;
  toggleFolder: (path: string) => void;
  renamingPath: string | null;
  setRenamingPath: (path: string | null) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  handleRename: (oldPath: string, newName: string) => Promise<void>;
  handleDeleteFile: (filePath: string, type: "file" | "directory") => Promise<void>;
  handleNewFile: () => Promise<void>;
  handleNewFolder: () => Promise<void>;
  loadingTree: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  sidebarWidth: number;
  handleSidebarMouseDown: (e: React.MouseEvent) => void;
  activeProject: Project;
  closeWorkspace: () => void;
  filterFileTree: (nodes: FileNode[], query: string) => FileNode[];
}

function TreeNode({
  node,
  depth,
  openFile,
  activeFilePath,
  expandedFolders,
  toggleFolder,
  renamingPath,
  setRenamingPath,
  renameValue,
  setRenameValue,
  handleRename,
  handleDeleteFile,
}: {
  node: FileNode;
  depth: number;
  openFile: (path: string) => void;
  activeFilePath: string | null;
  expandedFolders: Record<string, boolean>;
  toggleFolder: (path: string) => void;
  renamingPath: string | null;
  setRenamingPath: (path: string | null) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  handleRename: (oldPath: string, newName: string) => Promise<void>;
  handleDeleteFile: (filePath: string, type: "file" | "directory") => Promise<void>;
}) {
  const indent = { paddingLeft: `${depth * 0.85 + 0.5}rem` };
  const isExpanded = expandedFolders[node.path];
  const isRenaming = renamingPath === node.path;
  const isActive = activeFilePath === node.path;

  const RenameInput = (
    <input
      type="text"
      className="sidebar-rename-input"
      value={renameValue}
      autoFocus
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setRenameValue(e.target.value)}
      onBlur={() => setRenamingPath(null)}
      onKeyDown={async (e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          await handleRename(node.path, renameValue);
          setRenamingPath(null);
        }
        if (e.key === "Escape") setRenamingPath(null);
      }}
    />
  );

  if (node.type === "directory") {
    return (
      <div key={node.path}>
        <div
          className="tree-node-item"
          style={{ ...indent, color: "#fff", fontWeight: 600 }}
          onClick={() => toggleFolder(node.path)}
        >
          <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", flexShrink: 0 }}>
            {isExpanded ? "▼" : "▶"}
          </span>
          {getFolderIcon(isExpanded)}
          {isRenaming ? RenameInput : <span>{node.name}</span>}

          {!isRenaming && (
            <span
              className="node-rename-btn"
              onClick={(e) => { e.stopPropagation(); setRenamingPath(node.path); setRenameValue(node.name); }}
              title="Rename"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
              </svg>
            </span>
          )}
          <span
            className="node-delete-btn"
            onClick={(e) => { e.stopPropagation(); handleDeleteFile(node.path, "directory"); }}
            title="Delete"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </span>
        </div>
        {isExpanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
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
            />
          ))}
      </div>
    );
  }

  // File node
  const { icon } = getFileIcon(node.name, isActive);

  return (
    <div
      key={node.path}
      className={`tree-node-item ${isActive ? "active" : ""}`}
      style={indent}
      onClick={() => openFile(node.path)}
    >
      {icon}
      {isRenaming ? (
        RenameInput
      ) : (
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.name}
        </span>
      )}
      {!isRenaming && (
        <span
          className="node-rename-btn"
          onClick={(e) => { e.stopPropagation(); setRenamingPath(node.path); setRenameValue(node.name); }}
          title="Rename"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
          </svg>
        </span>
      )}
      <span
        className="node-delete-btn"
        onClick={(e) => { e.stopPropagation(); handleDeleteFile(node.path, "file"); }}
        title="Delete"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </span>
    </div>
  );
}

export function FileTree({
  fileTree,
  searchQuery,
  setSearchQuery,
  openFile,
  activeFilePath,
  expandedFolders,
  toggleFolder,
  renamingPath,
  setRenamingPath,
  renameValue,
  setRenameValue,
  handleRename,
  handleDeleteFile,
  handleNewFile,
  handleNewFolder,
  loadingTree,
  sidebarCollapsed,
  setSidebarCollapsed,
  sidebarWidth,
  handleSidebarMouseDown,
  activeProject,
  closeWorkspace,
  filterFileTree,
}: FileTreeProps) {
  const displayTree = filterFileTree(fileTree, searchQuery);

  return (
    <>
      <aside
        className="sidebar-explorer"
        style={{
          width: sidebarCollapsed ? 0 : sidebarWidth,
          minWidth: sidebarCollapsed ? 0 : 160,
          opacity: sidebarCollapsed ? 0 : 1,
          pointerEvents: sidebarCollapsed ? "none" : "auto",
          transition: sidebarCollapsed ? "width 0.2s, opacity 0.2s" : "none",
        }}
      >
        <div className="sidebar-header">
          <button className="sidebar-back-btn" onClick={closeWorkspace} title="Back to projects">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>

          <span className="sidebar-project-name" title={activeProject.name}>
            {activeProject.name}
          </span>

          <div className="sidebar-actions-row">
            <button className="sidebar-action-btn" onClick={handleNewFile} title="New file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </button>
            <button className="sidebar-action-btn" onClick={handleNewFolder} title="New folder">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </button>
            <button className="sidebar-action-btn" onClick={() => setSidebarCollapsed(true)} title="Collapse sidebar (Ctrl+B)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          className="sidebar-search-box"
          placeholder="Filter files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ margin: "0.5rem 0.75rem", width: "calc(100% - 1.5rem)" }}
        />

        <div className="sidebar-content">
          {loadingTree ? (
            <div style={{ padding: "0.5rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {[92, 70, 80, 60, 74, 50].map((w, i) => (
                <div key={i} className="skeleton-line" style={{ width: `${w}%`, marginLeft: i % 3 === 2 ? "1rem" : 0 }} />
              ))}
            </div>
          ) : displayTree.length === 0 ? (
            <div style={{ padding: "1.5rem", color: "var(--text-muted)", fontSize: "0.8rem", lineHeight: 1.4, textAlign: "center" }}>
              {searchQuery ? `No files matching "${searchQuery}"` : "Empty project. Create a file to get started."}
            </div>
          ) : (
            displayTree.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
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
              />
            ))
          )}
        </div>
      </aside>

      {/* Drag resize divider */}
      {!sidebarCollapsed && (
        <div className="resize-divider" onMouseDown={handleSidebarMouseDown} />
      )}

      {/* Expand button when collapsed */}
      {sidebarCollapsed && (
        <button
          className="sidebar-expand-btn"
          onClick={() => setSidebarCollapsed(false)}
          title="Expand Sidebar (Ctrl+B)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </>
  );
}
