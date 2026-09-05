import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { getAuth } from "@clerk/express";
import { env, isTest } from "../env.js";

// Key by Clerk user when we have one, so a shared NAT does not throttle a whole
// office, and a single account cannot dodge the limit by rotating IPs.
// Anonymous requests fall back to `ipKeyGenerator`, which normalises IPv6 to a
// /64 subnet — keying on the raw address lets one client walk a whole prefix.
const keyGenerator = (req, res) => {
  const userId = getAuth(req)?.userId;
  return userId ? `user:${userId}` : ipKeyGenerator(req, res);
};

const jsonError = (message) => (req, res) => {
  res.status(429).json({ error: { code: "rate_limited", message } });
};

const base = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator,
  // Rate limiting an automated test suite just makes it flaky.
  skip: () => isTest,
};

/** Broad limit for ordinary CRUD. Generous — this is an editor. */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 300,
  handler: jsonError("Too many requests. Give it a second and try again."),
});

/** The endpoint that actually costs money. */
export const agentLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: env.AGENT_RATE_LIMIT_PER_MIN,
  handler: jsonError(
    `You've sent a lot of AI requests in a short time (limit: ${env.AGENT_RATE_LIMIT_PER_MIN}/min). Wait a moment and try again.`
  ),
});

/** Uploads are large and hit the disk. */
export const uploadLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 20,
  handler: jsonError("Too many imports in a row. Wait a minute and try again."),
});
