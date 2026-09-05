"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  FilePlus2,
  FileSearch,
  FilePen,
  Info,
  ListTree,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

import type {
  AiModel,
  ChatCheckpoint,
  ChatMessage,
  FileChange,
  ToolActivity,
} from "@/lib/types";
import { cn, fileName, relativeTime } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/button";
import { Badge, EmptyState, Kbd, Skeleton, TypingDots } from "@/components/ui/primitives";
import { Popover, PopoverItem, PopoverLabel, PopoverSeparator } from "@/components/ui/popover";
import { Markdown } from "./markdown";

const SUGGESTIONS = [
  { label: "Add an /about page", prompt: "Add an /about route with a short bio section, and link to it from the homepage nav." },
  { label: "Build a pricing section", prompt: "Add a responsive three-tier pricing section to the homepage using Tailwind." },
  { label: "Make it dark mode", prompt: "Add a dark mode toggle that persists the choice, and restyle the homepage to support both themes." },
  { label: "Add a contact form", prompt: "Create a contact form as a client component with validation and a success state." },
];

interface ChatPaneProps {
  messages: ChatMessage[];
  checkpoints: ChatCheckpoint[];
  activity: ToolActivity[];
  step: { current: number; max: number } | null;
  streaming: boolean;
  loadingChat: boolean;
  chats: { id: string; title: string; updatedAt: string; messageCount: number }[];
  chatId: string | null;
  models: AiModel[];
  model: string;
  attachments: string[];
  activeFilePath: string | null;

  onSend: (text: string) => void;
  onStop: () => void;
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onModelChange: (model: string) => void;
  onAttach: (path: string) => void;
  onDetach: (path: string) => void;
  onRestore: (checkpoint: ChatCheckpoint) => void;
  onOpenFile: (path: string) => void;
  onViewDiff: (change: FileChange) => void;
  onClose: () => void;
}

export function ChatPane(props: ChatPaneProps) {
  const {
    messages, checkpoints, activity, step, streaming, loadingChat, chats, chatId,
    models, model, attachments, activeFilePath,
    onSend, onStop, onNewChat, onOpenChat, onDeleteChat, onModelChange,
    onAttach, onDetach, onRestore, onOpenFile, onViewDiff, onClose,
  } = props;

  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const checkpointByMessage = useMemo(
    () => new Map(checkpoints.filter((c) => c.messageId).map((c) => [c.messageId!, c])),
    [checkpoints]
  );

  // Auto-scroll, but only while the user is already at the bottom — yanking
  // the view back mid-scroll is the most common complaint about chat UIs.
  useLayoutEffect(() => {
    if (pinnedToBottom) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, activity, pinnedToBottom]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const onScroll = () => {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
      setPinnedToBottom(distance < 80);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, []);

  // Grow the composer with its content, up to a ceiling.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
  }, [input]);

  const submit = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setPinnedToBottom(true);
    onSend(text);
  };

  const selectedModel = models.find((m) => m.id === model);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-surface">
      {/* Header */}
      <div className="flex h-(--spacing-titlebar) shrink-0 items-center gap-1.5 border-b border-border px-2.5">
        <Sparkles className="size-3.5 text-brand" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
          Assistant
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          <IconButton label="New chat" size="xs" disabled={streaming} onClick={onNewChat}>
            <Plus className="size-3.5" />
          </IconButton>

          <Popover
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            panelClassName="w-[280px]"
            trigger={({ ref, onClick }) => (
              <IconButton ref={ref} label="Chat history" size="xs" active={historyOpen} onClick={onClick}>
                <Clock className="size-3.5" />
              </IconButton>
            )}
          >
            <PopoverLabel>Conversations</PopoverLabel>
            {chats.length === 0 ? (
              <p className="px-2 py-3 text-center text-[12px] text-subtle">No chats yet</p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {chats.map((chat) => (
                  <div key={chat.id} className="group/chat flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChat(chat.id);
                        setHistoryOpen(false);
                      }}
                      className={cn(
                        "min-w-0 flex-1 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-hover",
                        chat.id === chatId && "bg-brand-subtle"
                      )}
                    >
                      <span
                        className={cn(
                          "block truncate text-[12.5px]",
                          chat.id === chatId ? "text-brand" : "text-fg"
                        )}
                      >
                        {chat.title}
                      </span>
                      <span className="block text-[11px] text-subtle">
                        {relativeTime(chat.updatedAt)} · {chat.messageCount} messages
                      </span>
                    </button>
                    <IconButton
                      label={`Delete ${chat.title}`}
                      size="xs"
                      className="opacity-0 hover:text-danger group-hover/chat:opacity-100"
                      onClick={() => onDeleteChat(chat.id)}
                    >
                      <Trash2 className="size-3" />
                    </IconButton>
                  </div>
                ))}
              </div>
            )}
          </Popover>

          <IconButton label="Close assistant" size="xs" onClick={onClose}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        {loadingChat ? (
          <div className="space-y-4 p-4">
            <Skeleton className="ml-auto h-9 w-2/3 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col justify-center px-4 py-6">
            <EmptyState
              icon={<Sparkles className="size-5 text-brand" />}
              title="Describe what you want to build"
              description="Forge reads your project, edits the files directly, and shows you a diff for every change."
            />
            <div className="mt-4 space-y-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => {
                    setInput(suggestion.prompt);
                    textareaRef.current?.focus();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border border-border bg-canvas px-2.5 py-2",
                    "text-left text-[12.5px] text-fg transition-colors hover:border-brand/40 hover:bg-hover"
                  )}
                >
                  <span className="flex-1">{suggestion.label}</span>
                  <ArrowUp className="size-3 shrink-0 rotate-45 text-subtle" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-3.5">
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id || index}
                message={message}
                checkpoint={checkpointByMessage.get(message.id)}
                activity={message.status === "streaming" ? activity : []}
                step={message.status === "streaming" ? step : null}
                onRestore={onRestore}
                onOpenFile={onOpenFile}
                onViewDiff={onViewDiff}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {!pinnedToBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setPinnedToBottom(true);
              bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
            }}
            className="sticky bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border-strong bg-overlay px-2.5 py-1 text-[11.5px] text-fg shadow-[var(--shadow-popover)]"
          >
            <ArrowDown className="size-3" />
            Jump to latest
          </button>
        )}
      </div>

      {/* Composer */}
      <div className="@container shrink-0 border-t border-border p-2.5">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((path) => (
              <span
                key={path}
                className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand-subtle px-1.5 py-0.5 text-[11.5px] text-brand"
              >
                <Paperclip className="size-3" />
                <span className="max-w-[140px] truncate font-mono">{fileName(path)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${fileName(path)} from context`}
                  onClick={() => onDetach(path)}
                  className="rounded hover:text-bright"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div
          className={cn(
            "rounded-xl border border-border-strong bg-canvas transition-colors",
            "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20"
          )}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            disabled={streaming}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={streaming ? "Forge is working…" : "Ask for a change, or a question about the code…"}
            aria-label="Message the assistant"
            className={cn(
              "block max-h-[200px] w-full resize-none bg-transparent px-3 pt-2.5 text-[13px] leading-relaxed",
              "text-fg placeholder:text-subtle focus:outline-none disabled:opacity-60"
            )}
          />

          <div className="flex items-center gap-1 px-2 pb-2 pt-1">
            <IconButton
              label={
                activeFilePath
                  ? `Attach ${fileName(activeFilePath)} as context`
                  : "Open a file to attach it as context"
              }
              size="xs"
              disabled={!activeFilePath || attachments.includes(activeFilePath)}
              onClick={() => activeFilePath && onAttach(activeFilePath)}
            >
              <Paperclip className="size-3.5" />
            </IconButton>

            <Popover
              open={modelOpen}
              onOpenChange={setModelOpen}
              align="start"
              panelClassName="w-[248px] bottom-[calc(100%+6px)] top-auto"
              trigger={({ ref, onClick }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={onClick}
                  aria-label="Choose AI model"
                  className="inline-flex h-6 max-w-[130px] items-center gap-1 rounded-md px-1.5 text-[11.5px] text-muted transition-colors hover:bg-hover hover:text-fg"
                >
                  <span className="truncate">{selectedModel?.label ?? "Model"}</span>
                  <ChevronDown className="size-3 shrink-0" />
                </button>
              )}
            >
              <PopoverLabel>Model</PopoverLabel>
              {models.map((option) => (
                <PopoverItem
                  key={option.id}
                  selected={option.id === model}
                  onClick={() => {
                    onModelChange(option.id);
                    setModelOpen(false);
                  }}
                  hint={option.id === model ? <Check className="size-3.5" /> : undefined}
                >
                  <span className="block truncate">{option.label}</span>
                  <span className="block truncate text-[11px] text-subtle">{option.tagline}</span>
                </PopoverItem>
              ))}
              <PopoverSeparator />
              <p className="px-2 pb-1 text-[11px] leading-relaxed text-subtle">
                All models run on Groq. Bigger models handle multi-file changes better.
              </p>
            </Popover>

            <span className="ml-auto hidden truncate text-[10.5px] text-subtle @[300px]:inline">
              <Kbd>Enter</Kbd> to send
            </span>

            {streaming ? (
              <Button
                size="xs"
                variant="secondary"
                icon={<Square className="size-2.5 fill-current" />}
                onClick={onStop}
              >
                Stop
              </Button>
            ) : (
              <IconButton
                label="Send message"
                size="sm"
                variant="primary"
                disabled={!input.trim()}
                onClick={submit}
              >
                <ArrowUp className="size-4" />
              </IconButton>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ══════════════════════════ Message ══════════════════════════ */

function MessageBubble({
  message,
  checkpoint,
  activity,
  step,
  onRestore,
  onOpenFile,
  onViewDiff,
}: {
  message: ChatMessage;
  checkpoint?: ChatCheckpoint;
  activity: ToolActivity[];
  step: { current: number; max: number } | null;
  onRestore: (checkpoint: ChatCheckpoint) => void;
  onOpenFile: (path: string) => void;
  onViewDiff: (change: FileChange) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-brand px-3 py-2 text-[13px] leading-relaxed text-brand-fg">
          {message.content}
        </div>
      </div>
    );
  }

  const changes = message.events.filter(
    (event): event is { type: "file_change" } & FileChange => event.type === "file_change"
  );
  const notices = message.events.filter((e) => e.type === "notice" || e.type === "error");
  const isStreaming = message.status === "streaming";
  const isEmpty = !message.content && changes.length === 0 && activity.length === 0;

  return (
    <div className="group/msg space-y-2">
      {/* Tool timeline */}
      {activity.length > 0 && (
        <div className="space-y-1">
          {activity.map((item) => (
            <ToolRow key={item.id} activity={item} />
          ))}
        </div>
      )}

      {isStreaming && isEmpty && (
        <div className="flex items-center gap-2">
          <TypingDots />
          {step && step.current > 1 && (
            <span className="text-[11px] text-subtle">
              step {step.current} of {step.max}
            </span>
          )}
        </div>
      )}

      {message.content && (
        <>
          <Markdown content={message.content} />
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-blink bg-brand align-text-bottom" />
          )}
        </>
      )}

      {/* File changes */}
      {changes.length > 0 && (
        <div className="space-y-1 pt-0.5">
          {changes.map((change, index) => (
            <ChangeRow
              key={`${change.path}-${index}`}
              change={change}
              onOpen={() => onOpenFile(change.path)}
              onViewDiff={() => onViewDiff(change)}
            />
          ))}
        </div>
      )}

      {/* Notices */}
      {notices.map((notice, index) => (
        <div
          key={index}
          className={cn(
            "flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-[12px] leading-relaxed",
            notice.type === "error"
              ? "border-danger/25 bg-danger-subtle text-danger"
              : "border-warning/25 bg-warning-subtle text-warning"
          )}
        >
          {notice.type === "error" ? (
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
          ) : (
            <Info className="mt-px size-3.5 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      ))}

      {/* Undo the whole turn */}
      {checkpoint && !isStreaming && (
        <div className="flex items-center gap-2 pt-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/msg:opacity-100">
          <button
            type="button"
            onClick={() => onRestore(checkpoint)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] text-subtle transition-colors hover:bg-hover hover:text-fg"
          >
            <Undo2 className="size-3" />
            Undo this change
            <span className="text-subtle/70">
              ({checkpoint.fileCount} file{checkpoint.fileCount === 1 ? "" : "s"})
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

const TOOL_META: Record<string, { icon: typeof FileSearch; verb: (args: Record<string, unknown>) => string }> = {
  list_files: { icon: ListTree, verb: () => "Listing project files" },
  read_file: { icon: FileSearch, verb: (a) => `Reading ${a.path ?? "a file"}` },
  write_file: { icon: FilePen, verb: (a) => `Writing ${a.path ?? "a file"}` },
  delete_file: { icon: Trash2, verb: (a) => `Deleting ${a.path ?? "a file"}` },
  search_files: { icon: Search, verb: (a) => `Searching for "${a.query ?? ""}"` },
};

function ToolRow({ activity }: { activity: ToolActivity }) {
  const meta = TOOL_META[activity.name] ?? { icon: FilePlus2, verb: () => activity.name };
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-[11.5px]",
        activity.status === "failed" ? "text-danger" : "text-subtle"
      )}
    >
      {activity.status === "running" ? (
        <Loader2 className="size-3 shrink-0 animate-spin" />
      ) : activity.status === "failed" ? (
        <AlertTriangle className="size-3 shrink-0" />
      ) : (
        <Check className="size-3 shrink-0 text-success" />
      )}
      <Icon className="size-3 shrink-0 opacity-60" />
      <span className="truncate font-mono">{meta.verb(activity.args)}</span>
    </div>
  );
}

function ChangeRow({
  change,
  onOpen,
  onViewDiff,
}: {
  change: FileChange;
  onOpen: () => void;
  onViewDiff: () => void;
}) {
  const tone =
    change.action === "created" ? "success" : change.action === "deleted" ? "danger" : "brand";
  const label = change.action === "created" ? "new" : change.action === "deleted" ? "del" : "edit";

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-canvas px-1.5 py-1">
      <Badge tone={tone as "success" | "danger" | "brand"}>{label}</Badge>

      <button
        type="button"
        onClick={onOpen}
        title={`Open ${change.path}`}
        className="min-w-0 flex-1 truncate text-left font-mono text-[11.5px] text-fg hover:text-brand hover:underline"
      >
        {change.path}
      </button>

      {(change.added > 0 || change.removed > 0) && (
        <span className="shrink-0 font-mono text-[10.5px]">
          {change.added > 0 && <span className="text-added">+{change.added}</span>}
          {change.removed > 0 && <span className="ml-1 text-removed">−{change.removed}</span>}
        </span>
      )}

      {change.action !== "deleted" && (
        <button
          type="button"
          onClick={onViewDiff}
          className="shrink-0 rounded px-1 py-px text-[10.5px] text-subtle transition-colors hover:bg-hover hover:text-fg"
        >
          Diff
        </button>
      )}
    </div>
  );
}
