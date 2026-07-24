export function detectLanguage(filePath: string | null): string {
  if (!filePath) return "plaintext";
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "json":
    case "jsonc":
      return "json";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "html":
    case "htm":
      return "html";
    case "md":
    case "mdx":
      return "markdown";
    case "py":
      return "python";
    case "sh":
    case "bash":
    case "zsh":
      return "shell";
    case "yml":
    case "yaml":
      return "yaml";
    case "sql":
      return "sql";
    case "prisma":
      return "prisma";
    case "svg":
      return "xml";
    case "xml":
      return "xml";
    default:
      return "plaintext";
  }
}
