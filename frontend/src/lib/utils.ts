import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  // One decimal only when it carries information: "1.5 KB" is useful,
  // "1.0 KB" is just noise.
  const rounded = value >= 10 || i === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[i]}`;
}

export function relativeTime(input: string | number | Date): string {
  const then = new Date(input).getTime();
  const diff = Date.now() - then;

  if (diff < 45_000) return "just now";

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function fileName(path: string): string {
  return path.split("/").pop() || path;
}

export function dirName(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

/** Uses the platform's modifier symbol so shortcut hints read natively. */
export const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");

export function modKey(): string {
  return isMac ? "⌘" : "Ctrl";
}

/**
 * Subsequence fuzzy match with a relevance score.
 *
 * The old picker used `path.includes(query)`, so "apg" found nothing and
 * results were in tree order rather than by relevance.
 */
export function fuzzyScore(text: string, query: string): number | null {
  if (!query) return 0;

  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();

  let score = 0;
  let textIndex = 0;
  let lastMatch = -1;

  for (const char of needle) {
    const found = haystack.indexOf(char, textIndex);
    if (found === -1) return null;

    // Consecutive characters and matches right after a separator are the
    // strongest signals that this is the file the user meant.
    if (found === lastMatch + 1) score += 8;
    if (found === 0 || "/-_. ".includes(haystack[found - 1])) score += 6;
    score += Math.max(0, 4 - (found - textIndex));

    lastMatch = found;
    textIndex = found + 1;
  }

  // Prefer matches in the file name over ones buried in a directory path.
  const base = fileName(haystack);
  if (base.includes(needle)) score += 20;
  if (base.startsWith(needle)) score += 15;

  // Shorter paths win ties.
  return score - haystack.length * 0.05;
}

export function fuzzyFilter<T>(items: T[], query: string, key: (item: T) => string, limit = 50): T[] {
  if (!query.trim()) return items.slice(0, limit);
  return items
    .map((item) => ({ item, score: fuzzyScore(key(item), query.trim()) }))
    .filter((r): r is { item: T; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.item);
}

/** Flatten a file tree to the list of file paths. */
export function flattenFiles(nodes: { type: string; path: string; children?: never[] }[]): string[] {
  const out: string[] = [];
  const walk = (list: { type: string; path: string; children?: unknown }[]) => {
    for (const node of list) {
      if (node.type === "file") out.push(node.path);
      else if (Array.isArray(node.children)) walk(node.children as typeof list);
    }
  };
  walk(nodes as never);
  return out;
}

export function languageForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript", mts: "typescript",
    json: "json", jsonc: "json",
    css: "css", scss: "scss", less: "less",
    html: "html", htm: "html",
    md: "markdown", mdx: "markdown",
    yml: "yaml", yaml: "yaml",
    sh: "shell", bash: "shell", zsh: "shell",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    sql: "sql", graphql: "graphql", gql: "graphql",
    svg: "xml", xml: "xml",
    toml: "ini", ini: "ini", env: "ini",
    prisma: "prisma", dockerfile: "dockerfile",
  };
  if (fileName(path).toLowerCase() === "dockerfile") return "dockerfile";
  return map[ext] ?? "plaintext";
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "ico", "avif", "bmp"]);

export function isImageFile(path: string): boolean {
  return IMAGE_EXTS.has(path.split(".").pop()?.toLowerCase() ?? "");
}
