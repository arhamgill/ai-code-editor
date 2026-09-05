import express from "express";
import { z } from "zod";

import prisma from "../db.js";
import { AppError, asyncHandler, parseBody } from "../lib/errors.js";
import { requireProject } from "../middleware/auth.js";
import { restoreCheckpoint } from "../lib/checkpoints.js";

const router = express.Router({ mergeParams: true });

/**
 * Chats live in Postgres rather than localStorage.
 *
 * The previous build kept every conversation in the browser under
 * `forge_chats_<projectId>`, so history vanished on a different machine, in a
 * private window, or whenever the 5 MB quota was hit mid-stream — and it
 * silently JSON-stringified every message on every keystroke.
 */

const titleSchema = z.object({ title: z.string().trim().min(1).max(120) });

const shapeMessage = (m) => ({
  id: m.id,
  role: m.role,
  content: m.content,
  events: m.events ?? [],
  createdAt: m.createdAt,
  status: "complete",
});

const shapeChat = (c) => ({
  id: c.id,
  title: c.title,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  messageCount: c._count?.messages ?? c.messages?.length ?? 0,
  ...(c.messages ? { messages: c.messages.map(shapeMessage) } : {}),
});

async function requireChat(userId, projectId, chatId) {
  await requireProject(userId, projectId);
  const chat = await prisma.chat.findFirst({ where: { id: chatId, projectId } });
  if (!chat) throw AppError.notFound("Chat not found.");
  return chat;
}

// All chats for a project (metadata only — messages are fetched on open).
router.get(
  "/",
  asyncHandler(async (req, res) => {
    await requireProject(req.userId, req.params.projectId);
    const chats = await prisma.chat.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { messages: true } } },
      take: 100,
    });
    res.json(chats.map(shapeChat));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    await requireProject(req.userId, req.params.projectId);
    const chat = await prisma.chat.create({
      data: { projectId: req.params.projectId },
      include: { _count: { select: { messages: true } } },
    });
    res.status(201).json(shapeChat(chat));
  })
);

router.get(
  "/:chatId",
  asyncHandler(async (req, res) => {
    await requireChat(req.userId, req.params.projectId, req.params.chatId);
    const chat = await prisma.chat.findUnique({
      where: { id: req.params.chatId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    // Which messages can be rolled back to, so the UI can show Restore only
    // where it will actually do something.
    const checkpoints = await prisma.checkpoint.findMany({
      where: { chatId: chat.id },
      select: { id: true, messageId: true, label: true, createdAt: true, _count: { select: { files: true } } },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      ...shapeChat(chat),
      checkpoints: checkpoints.map((c) => ({
        id: c.id,
        messageId: c.messageId,
        label: c.label,
        createdAt: c.createdAt,
        fileCount: c._count.files,
      })),
    });
  })
);

router.patch(
  "/:chatId",
  asyncHandler(async (req, res) => {
    await requireChat(req.userId, req.params.projectId, req.params.chatId);
    const { title } = parseBody(titleSchema, req.body);
    const chat = await prisma.chat.update({
      where: { id: req.params.chatId },
      data: { title },
      include: { _count: { select: { messages: true } } },
    });
    res.json(shapeChat(chat));
  })
);

router.delete(
  "/:chatId",
  asyncHandler(async (req, res) => {
    await requireChat(req.userId, req.params.projectId, req.params.chatId);
    await prisma.chat.delete({ where: { id: req.params.chatId } });
    res.json({ ok: true });
  })
);

/**
 * Restore the project to its state before a given assistant message.
 *
 * This is the server-side replacement for the old in-memory `checkpoints`
 * object, which only ever held files that happened to be open in a tab — so
 * "Restore" quietly left every other edited file in place.
 */
router.post(
  "/:chatId/checkpoints/:checkpointId/restore",
  asyncHandler(async (req, res) => {
    const project = await requireProject(req.userId, req.params.projectId);
    const checkpoint = await prisma.checkpoint.findFirst({
      where: {
        id: req.params.checkpointId,
        projectId: project.id,
        chatId: req.params.chatId,
      },
      include: { files: true },
    });
    if (!checkpoint) throw AppError.notFound("That checkpoint no longer exists.");

    const result = await restoreCheckpoint(req.userId, project.id, checkpoint);
    await prisma.project.update({ where: { id: project.id }, data: { updatedAt: new Date() } });

    res.json({ ok: true, ...result });
  })
);

export default router;
