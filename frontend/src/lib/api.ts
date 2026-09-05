import type {
  AiModel,
  ChatDetail,
  ChatSummary,
  FileContent,
  FileNode,
  Project,
  ProjectStats,
} from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

/**
 * An error carrying the server's structured message.
 *
 * The old code checked `if (res.ok)` and silently did nothing otherwise, which
 * is how a 500 on project creation turned into a button that appeared to do
 * nothing at all. Every failure now arrives here with something showable.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: { field: string; message: string }[];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: { field: string; message: string }[]
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** A sentence that is safe and useful to show a user verbatim. */
  get userMessage(): string {
    if (this.details?.length) {
      return `${this.message} ${this.details.map((d) => d.message).join(" ")}`;
    }
    return this.message;
  }
}

export type TokenGetter = () => Promise<string | null>;

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

async function request<T>(
  getToken: TokenGetter,
  path: string,
  { body, query, headers, ...init }: RequestOptions = {}
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let token: string | null = null;
  try {
    token = await getToken();
  } catch {
    throw new ApiError(401, "unauthorized", "Your session expired. Please sign in again.");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network-level failure — almost always the API not running in local dev.
    throw new ApiError(
      0,
      "network_error",
      "Can't reach the Forge API. Check that the backend is running."
    );
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const err = payload?.error;
    throw new ApiError(
      response.status,
      err?.code ?? "unknown",
      err?.message ?? `Request failed with status ${response.status}.`,
      err?.details
    );
  }

  return payload as T;
}

/** Typed client bound to a Clerk token getter. */
export function createApi(getToken: TokenGetter) {
  const req = <T>(path: string, options?: RequestOptions) => request<T>(getToken, path, options);

  return {
    me: () => req<{ id: string; email: string }>("/api/me"),

    projects: {
      list: () => req<Project[]>("/api/projects"),
      create: (name: string, files: { path: string; content: string }[]) =>
        req<Project>("/api/projects", { method: "POST", body: { name, files } }),
      rename: (id: string, name: string) =>
        req<Project>(`/api/projects/${id}`, { method: "PATCH", body: { name } }),
      remove: (id: string) => req<{ ok: true }>(`/api/projects/${id}`, { method: "DELETE" }),
      stats: (id: string) => req<ProjectStats>(`/api/projects/${id}/stats`),
      tree: (id: string) => req<FileNode[]>(`/api/projects/${id}/files`),
      readFile: (id: string, path: string) =>
        req<FileContent>(`/api/projects/${id}/file`, { query: { path } }),
      writeFile: (id: string, path: string, content: string) =>
        req<{ ok: true; path: string }>(`/api/projects/${id}/file`, {
          method: "PUT",
          body: { path, content },
        }),
      createFolder: (id: string, path: string) =>
        req<{ ok: true }>(`/api/projects/${id}/folder`, { method: "POST", body: { path } }),
      rename_: (id: string, from: string, to: string) =>
        req<{ ok: true; path: string }>(`/api/projects/${id}/rename`, {
          method: "POST",
          body: { from, to },
        }),
      deleteFile: (id: string, path: string) =>
        req<{ ok: true }>(`/api/projects/${id}/file`, { method: "DELETE", query: { path } }),
    },

    chats: {
      list: (projectId: string) => req<ChatSummary[]>(`/api/projects/${projectId}/chats`),
      create: (projectId: string) =>
        req<ChatSummary>(`/api/projects/${projectId}/chats`, { method: "POST", body: {} }),
      get: (projectId: string, chatId: string) =>
        req<ChatDetail>(`/api/projects/${projectId}/chats/${chatId}`),
      rename: (projectId: string, chatId: string, title: string) =>
        req<ChatSummary>(`/api/projects/${projectId}/chats/${chatId}`, {
          method: "PATCH",
          body: { title },
        }),
      remove: (projectId: string, chatId: string) =>
        req<{ ok: true }>(`/api/projects/${projectId}/chats/${chatId}`, { method: "DELETE" }),
      restore: (projectId: string, chatId: string, checkpointId: string) =>
        req<{ ok: true; restored: string[]; deleted: string[] }>(
          `/api/projects/${projectId}/chats/${chatId}/checkpoints/${checkpointId}/restore`,
          { method: "POST" }
        ),
    },

    agent: {
      models: () => req<{ models: AiModel[]; default: string }>("/api/agent/models"),

      /** Opens the SSE stream. The caller drives it with `readAgentStream`. */
      stream: async (
        payload: {
          projectId: string;
          chatId?: string;
          message: string;
          model?: string;
          attachments?: string[];
        },
        signal: AbortSignal
      ) => {
        const token = await getToken();
        const response = await fetch(`${API_BASE}/api/agent/stream`, {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          // Validation and rate-limit failures come back as ordinary JSON
          // before the stream starts, so they surface as real errors rather
          // than an empty assistant bubble.
          const body = await response.json().catch(() => null);
          throw new ApiError(
            response.status,
            body?.error?.code ?? "stream_failed",
            body?.error?.message ?? "The assistant could not be reached.",
            body?.error?.details
          );
        }
        if (!response.body) {
          throw new ApiError(500, "stream_failed", "The assistant returned an empty response.");
        }
        return response.body;
      },
    },
  };
}

export type ForgeApi = ReturnType<typeof createApi>;
