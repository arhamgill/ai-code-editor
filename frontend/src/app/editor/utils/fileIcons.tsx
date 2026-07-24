import React from "react";

interface FileIconResult {
  color: string;
  icon: React.ReactNode;
}

export function getFileIcon(name: string, isActive = false): FileIconResult {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  const fileIcon = (color: string) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );

  switch (ext) {
    case "ts":
    case "tsx":
      return { color: "#60a5fa", icon: fileIcon("#60a5fa") };
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return { color: "#fbbf24", icon: fileIcon("#fbbf24") };
    case "css":
    case "scss":
    case "sass":
    case "less":
      return { color: "#c084fc", icon: fileIcon("#c084fc") };
    case "json":
    case "jsonc":
      return { color: "#fb923c", icon: fileIcon("#fb923c") };
    case "md":
    case "mdx":
      return { color: "#94a3b8", icon: fileIcon("#94a3b8") };
    case "html":
    case "htm":
      return { color: "#f87171", icon: fileIcon("#f87171") };
    case "py":
      return { color: "#34d399", icon: fileIcon("#34d399") };
    case "svg":
      return { color: "#f472b6", icon: fileIcon("#f472b6") };
    case "sh":
    case "bash":
    case "zsh":
      return { color: "#a3e635", icon: fileIcon("#a3e635") };
    case "env":
    case "example":
      return { color: "#facc15", icon: fileIcon("#facc15") };
    case "prisma":
      return { color: "#818cf8", icon: fileIcon("#818cf8") };
    case "yml":
    case "yaml":
      return { color: "#22d3ee", icon: fileIcon("#22d3ee") };
    default:
      return {
        color: isActive ? "#a5b4fc" : "#6b7280",
        icon: fileIcon(isActive ? "#a5b4fc" : "#6b7280"),
      };
  }
}

export function getFolderIcon(isOpen: boolean): React.ReactNode {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-cyan)"
      strokeWidth="2.5"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}
