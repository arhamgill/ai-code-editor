import {
  Braces,
  FileCode2,
  FileImage,
  FileJson,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  Hash,
  Palette,
  Settings2,
  Terminal,
  Triangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One icon vocabulary for the whole app.
 *
 * The previous build mixed emoji ("📄", "🤖") with inline SVG, which rendered
 * at inconsistent sizes, ignored the theme, and read out loud as "page facing
 * up" to screen readers.
 */
type IconSpec = { Icon: typeof FileText; className: string };

const BY_NAME: Record<string, IconSpec> = {
  "package.json": { Icon: Braces, className: "text-[#8bc34a]" },
  "package-lock.json": { Icon: Braces, className: "text-[#8bc34a]/60" },
  "tsconfig.json": { Icon: Settings2, className: "text-brand" },
  "next.config.js": { Icon: Triangle, className: "text-fg" },
  "next.config.mjs": { Icon: Triangle, className: "text-fg" },
  "next.config.ts": { Icon: Triangle, className: "text-fg" },
  "tailwind.config.ts": { Icon: Palette, className: "text-[#38bdf8]" },
  "tailwind.config.js": { Icon: Palette, className: "text-[#38bdf8]" },
  "postcss.config.mjs": { Icon: Settings2, className: "text-muted" },
  ".gitignore": { Icon: Hash, className: "text-muted" },
  dockerfile: { Icon: Terminal, className: "text-brand" },
  "readme.md": { Icon: FileText, className: "text-brand" },
};

const BY_EXT: Record<string, IconSpec> = {
  ts: { Icon: FileCode2, className: "text-[#3178c6]" },
  tsx: { Icon: FileCode2, className: "text-[#3178c6]" },
  js: { Icon: FileCode2, className: "text-[#f0db4f]" },
  jsx: { Icon: FileCode2, className: "text-[#f0db4f]" },
  mjs: { Icon: FileCode2, className: "text-[#f0db4f]" },
  cjs: { Icon: FileCode2, className: "text-[#f0db4f]" },
  json: { Icon: FileJson, className: "text-[#cbcb41]" },
  css: { Icon: Palette, className: "text-[#42a5f5]" },
  scss: { Icon: Palette, className: "text-[#cf649a]" },
  html: { Icon: FileType, className: "text-[#e44d26]" },
  md: { Icon: FileText, className: "text-muted" },
  mdx: { Icon: FileText, className: "text-muted" },
  yml: { Icon: Settings2, className: "text-muted" },
  yaml: { Icon: Settings2, className: "text-muted" },
  sh: { Icon: Terminal, className: "text-success" },
  env: { Icon: Settings2, className: "text-warning" },
  svg: { Icon: FileImage, className: "text-[#ffb13b]" },
  png: { Icon: FileImage, className: "text-[#a074c4]" },
  jpg: { Icon: FileImage, className: "text-[#a074c4]" },
  jpeg: { Icon: FileImage, className: "text-[#a074c4]" },
  gif: { Icon: FileImage, className: "text-[#a074c4]" },
  webp: { Icon: FileImage, className: "text-[#a074c4]" },
  ico: { Icon: FileImage, className: "text-[#a074c4]" },
};

export function FileIcon({ name, className }: { name: string; className?: string }) {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  const spec = BY_NAME[lower] ?? BY_EXT[ext] ?? { Icon: FileText, className: "text-subtle" };
  const { Icon } = spec;
  return <Icon className={cn("size-3.5 shrink-0", spec.className, className)} aria-hidden />;
}

export function FolderIcon({ open, className }: { open?: boolean; className?: string }) {
  const Icon = open ? FolderOpen : Folder;
  return <Icon className={cn("size-3.5 shrink-0 text-brand/80", className)} aria-hidden />;
}
