export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface AgentEvent {
  type: "thinking" | "tool_call" | "file_change" | "error";
  name?: string;
  args?: Record<string, unknown>;
  action?: "Created" | "Modified" | "Deleted";
  path?: string;
  added?: number;
  removed?: number;
  message?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "complete";
  events?: AgentEvent[];
  reaction?: "up" | "down";
}

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export interface DiffModalState {
  filePath: string;
  before: string;
  after: string;
}

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: string;
  section: "actions";
  action: () => void;
}
