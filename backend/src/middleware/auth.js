import { getAuth, clerkClient } from "@clerk/express";
import prisma from "../db.js";
import { AppError, asyncHandler } from "../lib/errors.js";

/**
 * Authenticate the request *and* guarantee a matching row in our own database.
 *
 * This closes the bug that made the product unusable for every new account:
 * the User row was only ever created by GET /api/me, which the frontend never
 * called, so the first `POST /api/projects` from a fresh Clerk user died on a
 * `Project_userId_fkey` foreign-key violation — surfaced to them as a project
 * that silently failed to appear.
 *
 * Provisioning on first authenticated request makes sign-up → first project
 * work with no ordering requirement between the two systems.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const { userId } = getAuth(req);
  if (!userId) throw AppError.unauthorized();

  req.userId = userId;
  req.dbUser = await ensureUser(userId);
  next();
});

const inFlight = new Map();

/** Upsert the Clerk user into Postgres, de-duplicating concurrent callers. */
export async function ensureUser(userId) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (existing) return existing;

  // A fresh session fires several requests at once; without this they would
  // all hit Clerk and all try to insert the same row.
  if (inFlight.has(userId)) return inFlight.get(userId);

  const promise = (async () => {
    let email = `${userId}@users.noreply.forge.local`;
    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      email =
        clerkUser.primaryEmailAddress?.emailAddress ||
        clerkUser.emailAddresses?.[0]?.emailAddress ||
        email;
    } catch (err) {
      // A Clerk outage should not block someone from using their workspace;
      // the placeholder is corrected the next time we can reach Clerk.
      console.warn(`[auth] Could not fetch Clerk profile for ${userId}:`, err.message);
    }

    return prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email },
    });
  })().finally(() => inFlight.delete(userId));

  inFlight.set(userId, promise);
  return promise;
}

/**
 * Load a project the caller owns, or 404.
 * Ownership is enforced in the query itself, so a valid id belonging to
 * someone else is indistinguishable from one that does not exist.
 */
export async function requireProject(userId, projectId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw AppError.notFound("Project not found.");
  return project;
}
