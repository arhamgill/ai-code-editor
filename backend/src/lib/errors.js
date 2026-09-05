import { isProd } from "../env.js";

/**
 * An error with an HTTP status that is safe to show the user.
 * Anything thrown that is *not* an AppError is treated as an internal fault:
 * it gets logged in full and reported to the client as a generic 500, so we
 * never leak filesystem paths, SQL, or provider internals.
 */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }

  static badRequest(message, details) {
    return new AppError(400, "bad_request", message, details);
  }
  static unauthorized(message = "You must be signed in.") {
    return new AppError(401, "unauthorized", message);
  }
  static forbidden(message = "You do not have access to this resource.") {
    return new AppError(403, "forbidden", message);
  }
  static notFound(message = "Not found.") {
    return new AppError(404, "not_found", message);
  }
  static conflict(message) {
    return new AppError(409, "conflict", message);
  }
  static unprocessable(message, details) {
    return new AppError(422, "unprocessable", message, details);
  }
  static tooLarge(message) {
    return new AppError(413, "payload_too_large", message);
  }
  static tooManyRequests(message = "Too many requests. Slow down a moment.") {
    return new AppError(429, "rate_limited", message);
  }
}

/** Wrap an async route handler so rejected promises reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: "not_found", message: `No route matches ${req.method} ${req.path}` },
  });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
export function errorHandler(err, req, res, next) {
  const isApp = err instanceof AppError;
  const status = isApp ? err.status : err.status === 413 ? 413 : 500;

  if (!isApp) {
    console.error(`[error] ${req.method} ${req.path}`, err);
  } else if (status >= 500) {
    console.error(`[error] ${req.method} ${req.path}`, err.message);
  }

  if (res.headersSent) return;

  const body = {
    error: {
      code: isApp ? err.code : "internal_error",
      message: isApp
        ? err.message
        : "Something went wrong on our end. Please try again.",
    },
  };
  if (isApp && err.details) body.error.details = err.details;
  if (!isApp && !isProd) body.error.debug = err.message;

  res.status(status).json(body);
}

/** Parse a request body with a zod schema, converting failures into a 400. */
export function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw AppError.badRequest(
      "Some fields are missing or invalid.",
      result.error.issues.map((i) => ({
        field: i.path.join(".") || "(body)",
        message: i.message,
      }))
    );
  }
  return result.data;
}
