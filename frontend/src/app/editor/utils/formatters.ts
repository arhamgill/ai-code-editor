export function formatFriendlyErrorMessage(rawMessage: string): string {
  if (!rawMessage) return "An unknown error occurred.";

  try {
    let parsed: Record<string, unknown> | null = null;
    const trimmed = rawMessage.trim();
    if (trimmed.startsWith("{")) {
      parsed = JSON.parse(trimmed);
    } else {
      const jsonStart = rawMessage.indexOf("{");
      if (jsonStart !== -1) {
        parsed = JSON.parse(rawMessage.slice(jsonStart));
      }
    }

    if (parsed) {
      const errorObj = (parsed.error ?? parsed) as Record<string, unknown>;
      const status = errorObj.status as string | undefined;
      const message = typeof errorObj.message === "string" ? errorObj.message : "";
      const code = errorObj.code as number | undefined;

      let innerMessage = message;
      try {
        if (message && message.trim().startsWith("{")) {
          const innerParsed = JSON.parse(message) as Record<string, unknown>;
          const inner = innerParsed.error as Record<string, unknown> | undefined;
          if (inner?.message) {
            innerMessage = inner.message as string;
          }
        }
      } catch (_) {}

      const isQuota =
        status === "RESOURCE_EXHAUSTED" ||
        code === 429 ||
        (innerMessage &&
          (innerMessage.toLowerCase().includes("quota") ||
            innerMessage.toLowerCase().includes("rate limit") ||
            innerMessage.toLowerCase().includes("limit: 0")));

      if (isQuota) {
        return `\n\n### ⚠️ Message Limit Exceeded\n\nYou have hit the rate limit or daily usage quota for the AI assistant.\n\n**How to fix:**\n1. Wait a moment and try again.\n2. Switch to a lighter model (like **2.5 Flash** or **2.0 Flash**) using the selector dropdown.`;
      }

      if (innerMessage) {
        return `\n\n### ⚠️ Assistant Error\n\nThe assistant encountered an error: ${innerMessage}`;
      }
    }
  } catch (_) {}

  const lowerMsg = rawMessage.toLowerCase();
  const isQuotaFallback =
    lowerMsg.includes("quota") ||
    lowerMsg.includes("429") ||
    lowerMsg.includes("resource_exhausted") ||
    lowerMsg.includes("exceeded") ||
    lowerMsg.includes("limit: 0");

  if (isQuotaFallback) {
    return `\n\n### ⚠️ Message Limit Exceeded\n\nYou have hit the rate limit or daily usage quota for the AI assistant.\n\n**How to fix:**\n1. Wait a moment and try again.\n2. Switch to a different model using the dropdown above.`;
  }

  return `\n\n⚠️ **Error:** ${rawMessage}`;
}
