/**
 * Groq models this app is allowed to call.
 *
 * Verified against the live `GET /v1/models` catalogue and a tool-calling smoke
 * test — Groq retires models without notice, and the previous hard-coded list
 * (the llama-3.x family) had been withdrawn entirely, which meant *every* AI
 * request failed with a raw `model_not_found` from the provider.
 *
 * Before adding an entry, confirm two things:
 *   1. it appears in https://console.groq.com/docs/models, and
 *   2. it actually emits `tool_calls` — `groq/compound*` answers chat fine but
 *      rejects tool calling outright, so it is unusable here.
 */
export const MODELS = [
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    tagline: "Best for multi-file changes",
    contextWindow: 131_072,
    recommended: true,
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    tagline: "Fastest — great for small edits",
    contextWindow: 131_072,
  },
  {
    id: "qwen/qwen3.8-27b",
    label: "Qwen3.8 27B",
    tagline: "Strong at reasoning through a codebase",
    contextWindow: 131_042,
  },
];

export const DEFAULT_MODEL = "openai/gpt-oss-120b";

const byId = new Map(MODELS.map((m) => [m.id, m]));

export function resolveModel(requested) {
  return byId.has(requested) ? requested : DEFAULT_MODEL;
}

export function modelLabel(id) {
  return byId.get(id)?.label ?? id;
}
