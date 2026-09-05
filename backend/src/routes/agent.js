import express from "express";
import { z } from "zod";

import prisma from "../db.js";
import { asyncHandler, parseBody, AppError } from "../lib/errors.js";
import { projectDir } from "../lib/paths.js";
import { listTextFiles } from "../lib/workspace.js";
import { createSseStream } from "../lib/sse.js";
import { CheckpointRecorder } from "../lib/checkpoints.js";
import { requireProject } from "../middleware/auth.js";
import { agentLimiter } from "../middleware/rateLimit.js";

import { MODELS, DEFAULT_MODEL, resolveModel } from "../agent/models.js";
import { buildSystemPrompt } from "../agent/prompt.js";
import { createToolExecutors } from "../agent/tools.js";
import { runAgent } from "../agent/runner.js";

const router = express.Router();

/** How much prior conversation is replayed to the model. */
const HISTORY_TURNS = 12;

const sendSchema = z.object({
  projectId: z.string().uuid("Unknown project."),
  chatId: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Type a message first.").max(16_000, "That message is too long."),
  model: z.string().optional(),
  attachments: z.array(z.string().max(400)).max(10).optional(),
});

router.get("/models", (_req, res) => {
  res.json({ models: MODELS, default: DEFAULT_MODEL });
});

/** Derive a chat title from its first user message. */
const deriveTitle = (text) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean || "New chat";
};

router.post(
  "/stream",
  agentLimiter,
  asyncHandler(async (req, res) => {
    const { projectId, chatId, message, model, attachments = [] } = parseBody(sendSchema, req.body);

    // Validate everything *before* opening the stream: a 400 with a JSON body is
    // far easier for the client to handle than an error event on an SSE stream
    // that has already committed to a 200.
    const project = await requireProject(req.userId, projectId);

    let chat = chatId
      ? await prisma.chat.findFirst({ where: { id: chatId, projectId: project.id } })
      : null;
    if (chatId && !chat) throw AppError.notFound("That chat no longer exists.");
    if (!chat) {
      chat = await prisma.chat.create({
        data: { projectId: project.id, title: deriveTitle(message) },
      });
    }

    const selectedModel = resolveModel(model);
    const dir = projectDir(req.userId, project.id);

    const priorMessages = await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_TURNS,
      select: { role: true, content: true },
    });

    const userMessage = await prisma.message.create({
      data: { chatId: chat.id, role: "user", content: message },
    });

    const stream = createSseStream(req, res);
    stream.send({ type: "start", chatId: chat.id, messageId: userMessage.id, model: selectedModel });

    const checkpoint = new CheckpointRecorder({
      userId: req.userId,
      projectId: project.id,
      chatId: chat.id,
    });

    const fileChanges = [];
    const executors = createToolExecutors({
      userId: req.userId,
      projectId: project.id,
      projectDir: dir,
      checkpoint,
      onFileChange: (change) => {
        fileChanges.push(change);
        stream.send({ type: "file_change", ...change });
      },
    });

    let result = { text: "", events: [], stopReason: "error" };

    try {
      result = await runAgent({
        model: selectedModel,
        systemPrompt: buildSystemPrompt({
          projectName: project.name,
          filePaths: await listTextFiles(dir),
          attachments,
        }),
        history: priorMessages
          .reverse()
          .filter((m) => m.content?.trim())
          .map((m) => ({ role: m.role, content: m.content })),
        userMessage: attachments.length
          ? `${message}\n\n(Attached for context: ${attachments.join(", ")})`
          : message,
        executors,
        stream,
      });
    } catch (err) {
      console.error("[agent] unhandled run failure:", err);
      stream.send({
        type: "error",
        message: "The assistant stopped unexpectedly. Any files it had already written are saved.",
      });
    }

    // Persist whatever happened — including a partial run the user stopped, so
    // the transcript matches the files actually on disk.
    try {
      // Only events that still mean something on reload are persisted: the
      // file changes and any warning. Step counters and tool spinners are
      // progress UI, not transcript.
      const durableEvents = [
        ...fileChanges.map((c) => ({ type: "file_change", ...c })),
        ...result.events.filter((e) => e.type === "notice" || e.type === "error"),
      ];

      const assistantMessage = await prisma.message.create({
        data: {
          chatId: chat.id,
          role: "assistant",
          content: result.text,
          events: durableEvents,
        },
      });

      const saved = await checkpoint.commit({
        messageId: assistantMessage.id,
        label: deriveTitle(message),
      });

      await prisma.chat.update({
        where: { id: chat.id },
        data: {
          updatedAt: new Date(),
          ...(chat.title === "New chat" ? { title: deriveTitle(message) } : {}),
        },
      });
      if (fileChanges.length) {
        await prisma.project.update({
          where: { id: project.id },
          data: { updatedAt: new Date() },
        });
      }

      stream.send({
        type: "done",
        messageId: assistantMessage.id,
        chatId: chat.id,
        stopReason: result.stopReason,
        checkpointId: saved?.id ?? null,
        fileChanges,
      });
    } catch (err) {
      console.error("[agent] failed to persist turn:", err);
      stream.send({
        type: "done",
        stopReason: result.stopReason,
        persisted: false,
        fileChanges,
      });
    }

    stream.end();
  })
);

export default router;
