/**
 * Recovery for Groq's `tool_use_failed` 400.
 *
 * Llama-family models sometimes emit a tool call as literal text —
 * `<function=write_file,{"path":"…","content":"…"}></function>` — which Groq's
 * server rejects outright. The intended call is still sitting in the error's
 * `failed_generation` field, so we parse it out and run it ourselves rather
 * than showing the user a raw provider error.
 */

/** JSON.parse that tolerates raw control characters inside string values. */
export function safeJsonParse(text) {
  const escapeControlChars = (s) => {
    let out = "";
    for (const ch of s) {
      out += ch.charCodeAt(0) < 0x20 ? JSON.stringify(ch).slice(1, -1) : ch;
    }
    return out;
  };

  for (const candidate of [text, escapeControlChars(text)]) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try the next form */
    }
  }
  return null;
}

/**
 * From an opening `{`, return the balanced JSON object substring.
 * String-aware, because tool arguments contain code full of braces.
 */
export function extractBalancedJson(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (inString) {
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return text.slice(startIndex, i + 1);
  }
  return null;
}

function haystackFrom(err) {
  const direct = err?.error?.failed_generation ?? err?.error?.error?.failed_generation;
  if (direct) return String(direct);
  try {
    return `${err?.message ?? ""} ${JSON.stringify(err?.error ?? "")}`;
  } catch {
    return String(err?.message ?? "");
  }
}

/** @returns {Array<{name: string, args: object}>} calls we can safely replay. */
export function recoverToolCalls(err) {
  const haystack = haystackFrom(err);
  if (!haystack) return [];

  const calls = [];
  const nameRe = /<function=([a-zA-Z0-9_]+)/g;
  let match;

  while ((match = nameRe.exec(haystack)) !== null) {
    const braceIndex = haystack.indexOf("{", nameRe.lastIndex);
    if (braceIndex === -1) continue;

    const json = extractBalancedJson(haystack, braceIndex);
    if (!json) continue;

    // Resume scanning past this call's payload so nested braces in the
    // arguments are not mistaken for another call.
    nameRe.lastIndex = braceIndex + json.length;

    const args = safeJsonParse(json);
    // Running a mutating tool with empty args would truncate a file, so a call
    // we cannot parse is dropped rather than guessed at.
    if (args && typeof args === "object") calls.push({ name: match[1], args });
  }

  return calls;
}
