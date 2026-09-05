import Groq from "groq-sdk";

import { env } from "../env.js";
import { TOOL_SCHEMAS } from "./tools.js";
import { recoverToolCalls, safeJsonParse } from "./recovery.js";

/**
 * Accumulate OpenAI-style streamed tool-call deltas into whole calls.
 * Chunks arrive keyed by `index`, with `function.arguments` split across many
 * deltas, so both the id and the argument string have to be stitched together.
 */
class ToolCallAccumulator {
  constructor() {
    this.byIndex = new Map();
  }

  add(deltas = []) {
    for (const delta of deltas) {
      const index = delta.index ?? 0;
      if (!this.byIndex.has(index)) {
        this.byIndex.set(index, { id: "", name: "", arguments: "" });
      }
      const call = this.byIndex.get(index);
      if (delta.id) call.id = delta.id;
      if (delta.function?.name) call.name = delta.function.name;
      if (delta.function?.arguments) call.arguments += delta.function.arguments;
    }
  }

  toArray() {
    return [...this.byIndex.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, call], i) => ({
        id: call.id || `call_${index}_${i}`,
        name: call.name,
        arguments: call.arguments,
      }))
      .filter((c) => c.name);
  }
}

const friendlyProviderError = (err) => {
  const raw = String(err?.message ?? err ?? "");
  const status = err?.status ?? err?.response?.status;

  if (status === 429 || /rate limit|quota|too many requests/i.test(raw)) {
    return "The AI provider is rate limiting this key right now. Wait a few seconds, or switch to a lighter model from the picker.";
  }
  if (status === 401 || status === 403) {
    return "The AI provider rejected our API key. Check GROQ_API_KEY in the backend environment.";
  }
  // Groq retires models without notice; say so plainly instead of echoing a
  // raw `model_not_found`, which reads like a bug in the app.
  if (status === 404 || /model_not_found|does not exist/i.test(raw)) {
    return "That model is no longer available from the provider. Pick another one from the model picker — and if they all fail, the catalogue in backend/src/agent/models.js needs refreshing.";
  }
  if (/context length|too large|maximum context/i.test(raw)) {
    return "This conversation has outgrown the model's context window. Start a new chat to continue.";
  }
  if (status >= 500 || /timeout|ECONNRESET|fetch failed/i.test(raw)) {
    return "The AI provider is having trouble right now. Try again in a moment.";
  }
  return `The AI provider returned an error: ${raw}`;
};

/**
 * Run one agent turn to completion, streaming events as they happen.
 *
 * Compared to the previous implementation this fixes three things:
 *
 *  - **One call per step, not two.** It used to make a non-streaming call to
 *    decide whether tools were needed, then a *second* full streaming call just
 *    to re-generate the prose — doubling latency and token spend, and letting
 *    the text the user saw differ from the text the model had actually decided
 *    on. Now a single streaming call yields both.
 *  - **Aborts when the client leaves.** Stop, or closing the tab, previously
 *    left the loop running and still writing files.
 *  - **Reports its own limits.** Hitting the step ceiling used to end the
 *    stream silently, looking to the user like the model gave up mid-task.
 *
 * @returns {Promise<{text: string, events: object[], stopReason: string}>}
 */
export async function runAgent({
  model,
  systemPrompt,
  history,
  userMessage,
  executors,
  stream,
  maxSteps = env.AGENT_MAX_STEPS,
}) {
  const groq = new Groq({ apiKey: env.GROQ_API_KEY, maxRetries: 2 });

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  /** Everything the UI needs to re-render this turn after a reload. */
  const events = [];
  let text = "";
  let stopReason = "complete";

  const emit = (event) => {
    events.push(event);
    stream.send(event);
  };

  const runToolCalls = async (calls) => {
    const results = [];

    for (const call of calls) {
      if (stream.aborted) break;

      const args = safeJsonParse(call.arguments || "{}") ?? {};
      emit({ type: "tool_start", id: call.id, name: call.name, args });

      let result;
      try {
        const executor = executors[call.name];
        if (!executor) throw new Error(`Unknown tool "${call.name}".`);
        result = await executor(args);
      } catch (err) {
        console.error(`[agent] tool ${call.name} failed:`, err.message);
        // Hand the failure back to the model rather than killing the run — it
        // can usually correct a bad path on the next step.
        result = { error: err.message };
      }

      emit({
        type: "tool_end",
        id: call.id,
        name: call.name,
        ok: !result?.error,
        error: result?.error,
      });
      results.push({ call, result });
    }

    return results;
  };

  const appendToolTurn = (results) => {
    messages.push({
      role: "assistant",
      content: null,
      tool_calls: results.map(({ call }) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments || "{}" },
      })),
    });
    for (const { call, result } of results) {
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.name,
        content: JSON.stringify(result ?? {}),
      });
    }
  };

  for (let step = 1; step <= maxSteps; step++) {
    if (stream.aborted) {
      stopReason = "aborted";
      break;
    }

    emit({ type: "step", step, maxSteps });

    let completion;
    try {
      completion = await groq.chat.completions.create({
        model,
        messages,
        tools: TOOL_SCHEMAS,
        tool_choice: "auto",
        temperature: 0.3,
        stream: true,
      });
    } catch (err) {
      // Groq rejected a malformed tool call. Replay the intended call instead
      // of surfacing a provider error the user can do nothing about.
      const recovered = recoverToolCalls(err);
      if (recovered.length && !stream.aborted) {
        console.warn(`[agent] recovered ${recovered.length} tool call(s) from failed_generation`);
        const synthetic = recovered.map((c, i) => ({
          id: `call_recovered_${step}_${i}`,
          name: c.name,
          arguments: JSON.stringify(c.args ?? {}),
        }));
        appendToolTurn(await runToolCalls(synthetic));
        continue;
      }

      const message = friendlyProviderError(err);
      console.error(`[agent] completion failed (${model}):`, err.message);
      emit({ type: "error", message });
      return { text, events, stopReason: "error" };
    }

    const accumulator = new ToolCallAccumulator();
    let stepText = "";
    let finishReason = null;

    try {
      for await (const chunk of completion) {
        if (stream.aborted) break;

        const choice = chunk.choices?.[0];
        if (!choice) continue;

        if (choice.delta?.content) {
          stepText += choice.delta.content;
          text += choice.delta.content;
          stream.send({ type: "text", delta: choice.delta.content });
        }
        if (choice.delta?.tool_calls) {
          accumulator.add(choice.delta.tool_calls);
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
      }
    } catch (err) {
      if (stream.aborted) break;
      const message = friendlyProviderError(err);
      console.error("[agent] stream interrupted:", err.message);
      emit({ type: "error", message });
      return { text, events, stopReason: "error" };
    }

    if (stream.aborted) {
      stopReason = "aborted";
      break;
    }

    const toolCalls = accumulator.toArray();

    if (toolCalls.length === 0) {
      // No tools requested — the model has produced its final answer.
      stopReason = finishReason === "length" ? "truncated" : "complete";
      break;
    }

    // Preserve any prose the model wrote alongside its tool calls.
    if (stepText) messages.push({ role: "assistant", content: stepText });
    appendToolTurn(await runToolCalls(toolCalls));

    if (step === maxSteps) {
      stopReason = "max_steps";
      emit({
        type: "notice",
        level: "warning",
        message: `Stopped after ${maxSteps} steps to avoid running away. The work so far is saved — send another message to continue.`,
      });
    }
  }

  if (stopReason === "truncated") {
    emit({
      type: "notice",
      level: "warning",
      message: "The response was cut off at the model's output limit.",
    });
  }

  return { text, events, stopReason };
}
