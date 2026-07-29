"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage, ChatSession } from "../types";
import { MessageContent } from "./MessageContent";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const MODEL_OPTIONS = [
  {
    group: "Groq Models",
    models: [
      { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", badge: "best tool calling" },
      { value: "openai/gpt-oss-120b", label: "GPT-OSS 120B", badge: "reasoning + tools" },
      { value: "openai/gpt-oss-20b", label: "GPT-OSS 20B", badge: "very fast" },
      { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B", badge: "fastest" },
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
  chatSessions: ChatSession[];
  activeChatId: string | null;
  onNewChat: () => void;
  onSwitchChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  checkpoints: Record<number, Record<string, string>>;
  restoreCheckpoint: (msgIndex: number) => Promise<void>;
  fileSnapshotsBefore: Record<string, string>;
  revertFile: (filePath: string, oldContent: string) => Promise<void>;
  chatWidth: number;
  handleChatMouseDown: (e: React.MouseEvent) => void;
  setShowChat: (v: boolean) => void;
  userName?: string;
  onViewDiff: (filePath: string) => void;
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
  chatSessions,
  activeChatId,
  onNewChat,
  onSwitchChat,
  onDeleteChat,
  checkpoints,
  restoreCheckpoint,
  fileSnapshotsBefore,
  revertFile,
  chatWidth,
  handleChatMouseDown,
  setShowChat,
  userName,
  onViewDiff,
}: ChatPanelProps) {
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [showSessions, setShowSessions] = useState(false);

  // Close the history popover on outside click / Escape
  useEffect(() => {
    if (!showSessions) return;
    const onDown = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowSessions(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSessions(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showSessions]);

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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
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
                <optgroup key={group.group} label={group.group} style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>
                  {group.models.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} ({m.badge})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* New chat */}
            <button
              className="sidebar-action-btn"
              onClick={onNewChat}
              disabled={streamingActive}
              title="New chat"
              style={{ padding: "0.3rem" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Chat history */}
            <div className="chat-history-wrap" ref={historyRef}>
              <button
                className={`sidebar-action-btn ${showSessions ? "active" : ""}`}
                onClick={() => setShowSessions((p) => !p)}
                title="Chat history"
                aria-haspopup="true"
                aria-expanded={showSessions}
                style={{ padding: "0.3rem" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15.5 14" />
                </svg>
              </button>

              <AnimatePresence>
                {showSessions && (
                  <motion.div
                    className="chat-history-popover"
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.14 }}
                  >
                    <div className="popover-title">Chats</div>

                    {chatSessions.length === 0 ? (
                      <div className="chat-history-empty">No chats yet</div>
                    ) : (
                      <div className="chat-history-list">
                        {chatSessions.map((s) => (
                          <div
                            key={s.id}
                            className={`chat-history-item ${s.id === activeChatId ? "active" : ""}`}
                            onClick={() => { onSwitchChat(s.id); setShowSessions(false); }}
                          >
                            <div className="chat-history-meta">
                              <span className="chat-history-title">{s.title}</span>
                              <span className="chat-history-time">
                                {relativeTime(s.updatedAt)}
                                {s.messages.length > 0 && ` · ${s.messages.length} msg`}
                              </span>
                            </div>
                            <button
                              className="chat-history-delete"
                              onClick={(e) => { e.stopPropagation(); onDeleteChat(s.id); }}
                              title="Delete chat"
                              aria-label={`Delete ${s.title}`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
              <h4 className="chat-empty-title">Build with AI</h4>
              <p className="chat-empty-sub">
                Ask for routes, components or styles. Forge edits your files directly.
              </p>
              <div className="chat-suggestions">
                {[
                  { label: "Add an /about page", prompt: "Add an /about route with a link to it from the homepage." },
                  { label: "Build a pricing section", prompt: "Add a responsive pricing section to the homepage using Tailwind." },
                  { label: "Add a client component", prompt: "Create an interactive counter as a client component and use it on the homepage." },
                ].map((chip) => (
                  <button
                    key={chip.prompt}
                    className="chat-suggestion"
                    onClick={() => setChatInput(chip.prompt)}
                  >
                    <span>{chip.label}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
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
                      msg.content && <MessageContent content={msg.content} />

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
                                      {(evt.added ?? 0) > 0 && <span style={{ color: "var(--color-success)" }}>+{evt.added}</span>}
                                      {(evt.removed ?? 0) > 0 && <span style={{ color: "var(--color-error)" }}>-{evt.removed}</span>}
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
