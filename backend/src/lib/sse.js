/**
 * Minimal Server-Sent Events writer.
 *
 * Also owns the abort signal for a stream: when the client goes away (the user
 * hits Stop, or closes the tab) `aborted` flips, and the agent loop checks it
 * before every model call and every file write. The old implementation kept
 * generating — and kept *writing files* — long after the user had left.
 */
export function createSseStream(req, res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Stops nginx and friends from buffering the stream into uselessness.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let aborted = false;
  const onClose = () => {
    aborted = true;
    clearInterval(heartbeat);
  };
  req.on("close", onClose);
  req.on("aborted", onClose);

  // Comment frames keep intermediaries from timing out a quiet stream.
  const heartbeat = setInterval(() => {
    if (!aborted && !res.writableEnded) res.write(": ping\n\n");
  }, 15000);

  return {
    get aborted() {
      return aborted || res.writableEnded;
    },
    send(event) {
      if (aborted || res.writableEnded) return false;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      return true;
    },
    end() {
      clearInterval(heartbeat);
      if (!res.writableEnded) {
        if (!aborted) res.write("data: [DONE]\n\n");
        res.end();
      }
    },
  };
}
