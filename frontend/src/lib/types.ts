export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStats extends Project {
  files: number;
  directories: number;
  bytes: number;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  children?: FileNode[];
}

export interface FileContent {
  path: string;
  content: string;
  isBinary: boolean;
  size: number;
  truncated: boolean;
}

export type FileChangeAction = "created" | "modified" | "deleted";

export interface FileChange {
  action: FileChangeAction;
  path: string;
  added: number;
  removed: number;
}

/** Events persisted with a message and replayed when a chat is reopened. */
export type MessageEvent =
  | ({ type: "file_change" } & FileChange)
  | { type: "notice"; level: "info" | "warning"; message: string }
  | { type: "error"; message: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  events: MessageEvent[];
  createdAt: string;
  status?: "streaming" | "complete";
  /** Present when this turn can be rolled back. */
  checkpointId?: string | null;
}

export interface ChatCheckpoint {
  id: string;
  messageId: string | null;
  label: string;
  createdAt: string;
  fileCount: number;
}

export interface ChatSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatDetail extends ChatSummary {
  messages: ChatMessage[];
  checkpoints: ChatCheckpoint[];
}

export interface AiModel {
  id: string;
  label: string;
  tagline: string;
  contextWindow: number;
  recommended?: boolean;
}

/** Wire events from POST /api/agent/stream. */
export type AgentEvent =
  | { type: "start"; chatId: string; messageId: string; model: string }
  | { type: "step"; step: number; maxSteps: number }
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_end"; id: string; name: string; ok: boolean; error?: string }
  | ({ type: "file_change" } & FileChange)
  | { type: "notice"; level: "info" | "warning"; message: string }
  | { type: "error"; message: string }
  | {
      type: "done";
      messageId?: string;
      chatId?: string;
      stopReason: "complete" | "aborted" | "error" | "max_steps" | "truncated";
      checkpointId?: string | null;
      fileChanges: FileChange[];
      persisted?: boolean;
    };

/** Live progress for the tool timeline, derived from tool_start/tool_end. */
export interface ToolActivity {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "done" | "failed";
  error?: string;
}
