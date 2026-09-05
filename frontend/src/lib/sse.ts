import type { AgentEvent } from "./types";

/**
 * Parse an SSE byte stream into typed agent events.
 *
 * Two things the previous inline parser got wrong:
 *  - `if (dataStr === "[DONE]") break;` broke out of the *inner* per-line loop
 *    only, so the sentinel did not actually stop anything.
 *  - Events were dropped silently when a JSON payload straddled a chunk
 *    boundary. Buffering by frame (`\n\n`) rather than by line fixes that,
 *    since one frame is exactly one event.
 */
export async function* readAgentStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<AgentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) return;

      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        for (const line of frame.split("\n")) {
          // ":" frames are keep-alive comments.
          if (!line.startsWith("data:")) continue;

          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;

          try {
            yield JSON.parse(data) as AgentEvent;
          } catch {
            // A malformed frame is not worth killing a live run over.
            if (process.env.NODE_ENV !== "production") {
              console.warn("[sse] dropped unparseable frame:", data.slice(0, 200));
            }
          }
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
