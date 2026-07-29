import React from "react";

interface FileIconResult {
  color: string;
  icon: React.ReactNode;
}

// Monochrome icon set. Instead of per-language colours (which fight the
// black/white theme) files are distinguished by icon *shape* and brightness:
// the active file is bright, recognised source files are mid-grey, everything
// else is muted.
const CODE_EXT = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "php", "c", "cpp", "cs"]);
const STYLE_EXT = new Set(["css", "scss", "sass", "less"]);
const DATA_EXT = new Set(["json", "jsonc", "yml", "yaml", "toml", "env", "example", "prisma", "sql"]);
const DOC_EXT = new Set(["md", "mdx", "txt"]);
const MEDIA_EXT = new Set(["svg", "png", "jpg", "jpeg", "gif", "ico", "webp"]);
const MARKUP_EXT = new Set(["html", "htm", "xml"]);

const wrap = (stroke: string, children: React.ReactNode) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export function getFileIcon(name: string, isActive = false): FileIconResult {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const stroke = isActive ? "var(--text-bright)" : "var(--text-muted)";

  // Code — angle brackets
  if (CODE_EXT.has(ext)) {
    return {
      color: stroke,
      icon: wrap(stroke, <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>),
    };
  }

  // Stylesheets — brush
  if (STYLE_EXT.has(ext)) {
    return {
      color: stroke,
      icon: wrap(stroke, <><path d="M19 11H5m14 0a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-4v2a3 3 0 1 1-6 0v-2H5a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2m14 0V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4" /></>),
    };
  }

  // Structured data / config — braces
  if (DATA_EXT.has(ext)) {
    return {
      color: stroke,
      icon: wrap(stroke, <><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" /><path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1" /></>),
    };
  }

  // Markup — tag
  if (MARKUP_EXT.has(ext)) {
    return {
      color: stroke,
      icon: wrap(stroke, <><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></>),
    };
  }

  // Docs — lines of text
  if (DOC_EXT.has(ext)) {
    return {
      color: stroke,
      icon: wrap(stroke, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></>),
    };
  }

  // Media — image
  if (MEDIA_EXT.has(ext)) {
    return {
      color: stroke,
      icon: wrap(stroke, <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>),
    };
  }

  // Everything else — plain document
  return {
    color: stroke,
    icon: wrap(stroke, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>),
  };
}

export function getFolderIcon(isOpen: boolean): React.ReactNode {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke={isOpen ? "var(--text-secondary)" : "var(--text-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}
