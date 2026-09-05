"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, type ForgeApi } from "./api";
import { readAgentStream } from "./sse";
import type {
  ChatCheckpoint,
  ChatMessage,
  ChatSummary,
  FileChange,
  ToolActivity,
} from "./types";

export interface AgentChatState {
  chats: ChatSummary[];
  chatId: string | null;
  messages: ChatMessage[];
  checkpoints: ChatCheckpoint[];
  /** Tool calls for the turn currently streaming. */
  activity: ToolActivity[];
  step: { current: number; max: number } | null;
  streaming: boolean;
  loadingChat: boolean;
}

interface Options {
  projectId: string;
  api: ForgeApi;
  model: string;
  /** Called for every file the agent writes, as it happens. */
  onFileChange: (change: FileChange) => void;
  /** Called once a turn finishes, with everything it touched. */
  onTurnComplete: (changes: FileChange[]) => void;
  onError: (message: string) => void;
}

const DRAFT_ID = "__streaming__";

/**
 * Owns the AI conversation: server-persisted history, the live SSE stream, and
 * checkpoint restore.
 *
 * Replaces roughly 250 lines that lived inline in the editor page, where
 * `handleSendChat` was rebuilt on every keystroke because `chatInput` was in
 * its dependency array.
 */
export function useAgentChat({
  projectId,
  api,
  model,
  onFileChange,
  onTurnComplete,
  onError,
}: Options) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [checkpoints, setCheckpoints] = useState<ChatCheckpoint[]>([]);
  const [activity, setActivity] = useState<ToolActivity[]>([]);
  const [step, setStep] = useState<{ current: number; max: number } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  // Callbacks change identity every render; reading them from a ref keeps
  // `send` stable so the composer doesn't re-render on each keystroke.
  const handlers = useRef({ onFileChange, onTurnComplete, onError });
  handlers.current = { onFileChange, onTurnComplete, onError };

  /* ── Loading ─────────────────────────────────────────────────── */

  const loadChats = useCallback(async () => {
    try {
      const list = await api.chats.list(projectId);
      setChats(list);
      return list;
    } catch {
      return [];
    }
  }, [api, projectId]);

  const openChat = useCallback(
    async (id: string) => {
      setLoadingChat(true);
      try {
        const chat = await api.chats.get(projectId, id);
        setChatId(chat.id);
        setMessages(chat.messages);
        setCheckpoints(chat.checkpoints);
      } catch (error) {
        handlers.current.onError(
          error instanceof ApiError ? error.userMessage : "Could not load that chat."
        );
      } finally {
        setLoadingChat(false);
      }
    },
    [api, projectId]
  );

  // Open the most recent conversation on mount.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const list = await loadChats();
      if (cancelled) return;
      if (list.length > 0) await openChat(list[0].id);
      else setLoadingChat(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadChats, openChat]);

  /* ── Sending ─────────────────────────────────────────────────── */

  const send = useCallback(
    async (text: string, attachments: string[] = []) => {
      const message = text.trim();
      if (!message || abortRef.current) return;

      const controller = new AbortController();
      abortRef.current = controller;

      setStreaming(true);
      setActivity([]);
      setStep(null);

      const now = new Date().toISOString();
      setMessages((current) => [
        ...current,
        { id: `user-${Date.now()}`, role: "user", content: message, events: [], createdAt: now },
        {
          id: DRAFT_ID,
          role: "assistant",
          content: "",
          events: [],
          createdAt: now,
          status: "streaming",
        },
      ]);

      const changes: FileChange[] = [];
      let activeChatId = chatId;

      const patchDraft = (update: (draft: ChatMessage) => ChatMessage) =>
        setMessages((current) =>
          current.map((m) => (m.id === DRAFT_ID ? update(m) : m))
        );

      try {
        const body = await api.agent.stream(
          { projectId, chatId: chatId ?? undefined, message, model, attachments },
          controller.signal
        );

        for await (const event of readAgentStream(body, controller.signal)) {
          switch (event.type) {
            case "start":
              activeChatId = event.chatId;
              setChatId(event.chatId);
              break;

            case "step":
              setStep({ current: event.step, max: event.maxSteps });
              break;

            case "text":
              patchDraft((draft) => ({ ...draft, content: draft.content + event.delta }));
              break;

            case "tool_start":
              setActivity((current) => [
                ...current,
                { id: event.id, name: event.name, args: event.args, status: "running" },
              ]);
              break;

            case "tool_end":
              setActivity((current) =>
                current.map((item) =>
                  item.id === event.id
                    ? { ...item, status: event.ok ? "done" : "failed", error: event.error }
                    : item
                )
              );
              break;

            case "file_change": {
              const change: FileChange = {
                action: event.action,
                path: event.path,
                added: event.added,
                removed: event.removed,
              };
              changes.push(change);
              patchDraft((draft) => ({
                ...draft,
                events: [...draft.events, { type: "file_change", ...change }],
              }));
              handlers.current.onFileChange(change);
              break;
            }

            case "notice":
            case "error":
              patchDraft((draft) => ({ ...draft, events: [...draft.events, event] }));
              break;

            case "done":
              patchDraft((draft) => ({
                ...draft,
                id: event.messageId ?? draft.id,
                status: "complete",
                checkpointId: event.checkpointId ?? null,
              }));
              if (event.checkpointId && event.messageId) {
                setCheckpoints((current) => [
                  ...current,
                  {
                    id: event.checkpointId!,
                    messageId: event.messageId!,
                    label: message.slice(0, 60),
                    createdAt: new Date().toISOString(),
                    fileCount: event.fileChanges.length,
                  },
                ]);
              }
              break;
          }
        }
      } catch (error) {
        const aborted = controller.signal.aborted;

        patchDraft((draft) => ({
          ...draft,
          status: "complete",
          content: aborted
            ? draft.content || "_Stopped._"
            : draft.content,
          events: aborted
            ? draft.events
            : [
                ...draft.events,
                {
                  type: "error" as const,
                  message:
                    error instanceof ApiError
                      ? error.userMessage
                      : "The assistant stopped unexpectedly.",
                },
              ],
        }));

        if (!aborted && error instanceof ApiError) {
          handlers.current.onError(error.userMessage);
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
        setStep(null);
        // Any tool still marked running was cut off mid-flight.
        setActivity((current) =>
          current.map((item) => (item.status === "running" ? { ...item, status: "failed" } : item))
        );

        if (changes.length) handlers.current.onTurnComplete(changes);

        // Refresh titles and ordering; a brand-new chat only gets its real
        // title once the server has derived it.
        loadChats();
        if (activeChatId && !chatId) setChatId(activeChatId);
      }
    },
    [api, chatId, model, projectId, loadChats]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Never leave a request in flight when the workspace unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  /* ── Chat management ─────────────────────────────────────────── */

  const newChat = useCallback(async () => {
    if (streaming) return;
    // Reuse an empty conversation rather than stacking up blank ones.
    if (messages.length === 0 && chatId) return;

    setChatId(null);
    setMessages([]);
    setCheckpoints([]);
    setActivity([]);
  }, [streaming, messages.length, chatId]);

  const deleteChat = useCallback(
    async (id: string) => {
      try {
        await api.chats.remove(projectId, id);
        const remaining = chats.filter((chat) => chat.id !== id);
        setChats(remaining);

        if (id === chatId) {
          if (remaining.length) await openChat(remaining[0].id);
          else {
            setChatId(null);
            setMessages([]);
            setCheckpoints([]);
          }
        }
      } catch (error) {
        handlers.current.onError(
          error instanceof ApiError ? error.userMessage : "Could not delete that chat."
        );
      }
    },
    [api, chats, chatId, openChat, projectId]
  );

  const restore = useCallback(
    async (checkpointId: string) => {
      if (!chatId) return null;
      try {
        return await api.chats.restore(projectId, chatId, checkpointId);
      } catch (error) {
        handlers.current.onError(
          error instanceof ApiError ? error.userMessage : "Could not restore that checkpoint."
        );
        return null;
      }
    },
    [api, chatId, projectId]
  );

  const state: AgentChatState = {
    chats,
    chatId,
    messages,
    checkpoints,
    activity,
    step,
    streaming,
    loadingChat,
  };

  return { ...state, send, stop, newChat, openChat, deleteChat, restore, reloadChats: loadChats };
}
