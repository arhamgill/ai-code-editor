"use client";

import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage } from "../types";
import { MessageContent } from "./MessageContent";

const MODEL_OPTIONS = [
  {
    group: "Google Gemini (Recommended)",
    models: [
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", badge: "⚡ Fastest & Best Tool Calling ⭐" },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", badge: "🧠 Smartest" },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", badge: "💡 Balanced" },
    ],
  },
  {
    group: "Groq Models",
    models: [
      { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", badge: "⚡ Fast 70B" },
      { value: "llama-3.1-70b-versatile", label: "Llama 3.1 70B", badge: "🆓 Free" },
      { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B", badge: "⚡ Instant" },
      { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B", badge: "🆓 Free" },
      { value: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 70B", badge: "🧠 Reasoning" },
    ],
  },
];

interface ChatPanelProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  chatInput: string;
  setChatInput: (v: string) => void;
  handleSendChat: (e: React.FormEvent) => Promise<void>;
  stopStreaming: () => void;
  streamingActive: boolean;
  attachedFile: string | null;
  setAttachedFile: (v: string | null) => void;
  attachActiveFile: () => void;
  activeFilePath: string | null;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  handleClearChat: () => void;
  checkpoints: Record<number, Record<string, string>>;
  restoreCheckpoint: (msgIndex: number) => Promise<void>;
  fileSnapshotsBefore: Record<string, string>;
  revertFile: (filePath: string, oldContent: string) => Promise<void>;
  chatWidth: number;
  handleChatMouseDown: (e: React.MouseEvent) => void;
  setShowChat: (v: boolean) => void;
  userName?: string;
  onViewDiff: (filePath: string) => void;
  onApplyCode: (code: string) => void;
}

export function ChatPanel({
  messages,
  setMessages,
  chatInput,
  setChatInput,
  handleSendChat,
  stopStreaming,
  streamingActive,
  attachedFile,
  setAttachedFile,
  attachActiveFile,
  activeFilePath,
  selectedModel,
  setSelectedModel,
  handleClearChat,
  checkpoints,
  restoreCheckpoint,
  fileSnapshotsBefore,
  revertFile,
  chatWidth,
  handleChatMouseDown,
  setShowChat,
  userName,
  onViewDiff,
  onApplyCode,
}: ChatPanelProps) {
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom on new messages
  React.useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-grow the textarea up to a max height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [chatInput]);

  const handleReaction = (msgIndex: number, reaction: "up" | "down") => {
    setMessages((prev) => {
      const updated = [...prev];
      const msg = updated[msgIndex];
      updated[msgIndex] = {
        ...msg,
        reaction: msg.reaction === reaction ? undefined : reaction,
      };
      return updated;
    });
  };

  return (
    <>
      {/* Drag resize divider */}
      <div className="resize-divider" onMouseDown={handleChatMouseDown} />

      <aside className="chat-sidebar" style={{ width: chatWidth, minWidth: 250 }}>
        {/* Header */}
        <div className="chat-header">
          <div className="chat-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            AI Assistant
          </div>
          <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
            {/* Enhanced model selector */}
            <select
              className="model-selector"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              title="Select AI Model"
            >
              {MODEL_OPTIONS.map((group) => (
                <optgroup key={group.group} label={group.group} style={{ background: "#111", color: "#aaa" }}>
                  {group.models.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} — {m.badge}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <button className="sidebar-action-btn" onClick={handleClearChat} title="Clear Chat History" style={{ padding: "0.3rem" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
            <button className="sidebar-action-btn" onClick={() => setShowChat(false)} title="Close chat" style={{ padding: "0.3rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty-state">
              <div style={{ fontSize: "2rem" }}>✨</div>
              <h4 style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>Forge Helper</h4>
              <p style={{ fontSize: "0.8rem", lineHeight: 1.45, color: "var(--text-muted)", textAlign: "center" }}>
                Ask questions, request file changes, or ask for code explanations in this workspace project.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", marginTop: "1rem" }}>
                {[
                  { icon: "➕", label: "Add an /about page", prompt: "Add an /about route with a link to it from the homepage." },
                  { icon: "🎨", label: "Build a pricing section", prompt: "Add a responsive pricing section to the homepage using Tailwind." },
                  { icon: "🧩", label: "Add a client component", prompt: "Create an interactive counter as a client component and use it on the homepage." },
                ].map((chip) => (
                  <button
                    key={chip.prompt}
                    className="btn btn-secondary"
                    onClick={() => setChatInput(chip.prompt)}
                    style={{ fontSize: "0.75rem", padding: "0.45rem", justifyContent: "flex-start", width: "100%" }}
                  >
                    {chip.icon} {chip.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => (
                <motion.div
                  key={index}
                  className={`chat-message ${msg.role}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Message header */}
                  <div className="message-header">
                    <span>{msg.role === "user" ? userName || "You" : "AI"}</span>
                    {msg.role === "assistant" && checkpoints[index] && (
                      <button
                        className="restore-checkpoint-btn"
                        onClick={() => restoreCheckpoint(index)}
                        title="Restore all project files to before this message"
                      >
                        ↩ Restore
                      </button>
                    )}
                  </div>

                  {/* Bubble */}
                  <div className="message-bubble" style={{ maxWidth: "100%" }}>
                    {/* Typing indicator */}
                    {msg.role === "assistant" && !msg.content && streamingActive && index === messages.length - 1 ? (
                      <div className="typing-indicator">
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                      </div>
                    ) : (
                      msg.content && (
                        <MessageContent
                          content={msg.content}
                          onApplyCode={msg.role === "assistant" ? onApplyCode : undefined}
                        />
                      )
                    )}

                    {/* Streaming cursor */}
                    {msg.role === "assistant" && msg.status === "streaming" && msg.content && (
                      <span className="streaming-cursor">▋</span>
                    )}

                    {/* Events: tool calls + file changes */}
                    {msg.role === "assistant" && msg.events && msg.events.length > 0 && (
                      <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        {msg.events.map((evt, idx) => {
                          if (evt.type === "tool_call") {
                            return (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.15 }}
                                style={{ display: "flex", gap: "0.35rem", alignItems: "center", fontSize: "0.73rem", color: "var(--text-muted)", fontStyle: "italic", padding: "0.15rem 0" }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1.5s linear infinite", flexShrink: 0 }}>
                                  <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
                                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                                  <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
                                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                                </svg>
                                <span>
                                  {evt.name === "list_files" && "📁 Listing workspace files..."}
                                  {evt.name === "read_file" && `📖 Reading ${evt.args?.path}...`}
                                  {evt.name === "write_file" && `✏️ Modifying ${evt.args?.path}...`}
                                  {evt.name === "create_file" && `➕ Creating ${evt.args?.path}...`}
                                  {evt.name === "delete_file" && `🗑️ Deleting ${evt.args?.path}...`}
                                  {evt.name === "search_in_files" && `🔍 Searching for "${evt.args?.query}"...`}
                                </span>
                              </motion.div>
                            );
                          }

                          if (evt.type === "file_change") {
                            return (
                              <div
                                key={idx}
                                className="file-change-card"
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflow: "hidden" }}>
                                  <span className={`file-change-badge file-change-badge-${evt.action?.toLowerCase()}`}>
                                    {evt.action}
                                  </span>
                                  <span
                                    style={{ textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden", color: "var(--text-bright)", fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}
                                    title={evt.path}
                                  >
                                    {evt.path}
                                  </span>
                                </div>

                                <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexShrink: 0 }}>
                                  {evt.action !== "Deleted" && ((evt.added ?? 0) > 0 || (evt.removed ?? 0) > 0) && (
                                    <div style={{ display: "flex", gap: "0.25rem", fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: "bold" }}>
                                      {(evt.added ?? 0) > 0 && <span style={{ color: "#34d399" }}>+{evt.added}</span>}
                                      {(evt.removed ?? 0) > 0 && <span style={{ color: "#f87171" }}>-{evt.removed}</span>}
                                    </div>
                                  )}
                                  {evt.action === "Modified" && evt.path && (
                                    <button
                                      className="code-block-copy-btn"
                                      onClick={() => evt.path && onViewDiff(evt.path)}
                                      title="View diff"
                                      style={{ fontSize: "0.65rem" }}
                                    >
                                      Diff
                                    </button>
                                  )}
                                  {evt.action === "Modified" && evt.path && fileSnapshotsBefore[evt.path] !== undefined && (
                                    <button
                                      className="revert-btn"
                                      onClick={() => evt.path && revertFile(evt.path, fileSnapshotsBefore[evt.path])}
                                      title="Revert this file"
                                    >
                                      Revert
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    )}

                    {/* 👍 👎 reaction buttons for completed assistant messages */}
                    {msg.role === "assistant" && msg.status === "complete" && msg.content && (
                      <div className="message-reactions">
                        <button
                          className={`reaction-btn ${msg.reaction === "up" ? "active-up" : ""}`}
                          onClick={() => handleReaction(index, "up")}
                          title="Helpful"
                        >
                          👍
                        </button>
                        <button
                          className={`reaction-btn ${msg.reaction === "down" ? "active-down" : ""}`}
                          onClick={() => handleReaction(index, "down")}
                          title="Not helpful"
                        >
                          👎
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          <div ref={chatMessagesEndRef} />
        </div>

        {/* Input area */}
        <div className="chat-input-area">
          {/* Explicit File Context Attachment Bar */}
          <div className="chat-attachment-bar">
            {attachedFile ? (
              <div className="chat-attachment-pill active">
                <span>📎 Attached as context: <strong>{attachedFile.split("/").pop()}</strong></span>
                <button
                  type="button"
                  className="chat-attachment-remove"
                  onClick={() => setAttachedFile(null)}
                  title="Remove attached file context"
                >
                  ✕ Remove
                </button>
              </div>
            ) : activeFilePath ? (
              <button
                type="button"
                className="chat-attachment-pill attach-btn"
                onClick={attachActiveFile}
                title={`Attach ${activeFilePath} as prompt context`}
              >
                <span>📎 Attach active file: <strong>{activeFilePath.split("/").pop()}</strong></span>
              </button>
            ) : (
              <div className="chat-attachment-pill disabled">
                <span>📎 Open a file in editor to attach as context</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSendChat} className="chat-input-form">
            <textarea
              ref={textareaRef}
              rows={1}
              className="chat-textarea"
              placeholder="Ask a question or request code changes..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!streamingActive && chatInput.trim()) handleSendChat(e);
                }
              }}
            />
            {streamingActive ? (
              <button
                type="button"
                className="chat-send-btn chat-stop-btn"
                onClick={stopStreaming}
                title="Stop generating"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="5" y="5" width="14" height="14" rx="2.5" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                className="chat-send-btn"
                disabled={!chatInput.trim()}
                title="Send (Enter)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </form>
        </div>
      </aside>
    </>
  );
}
