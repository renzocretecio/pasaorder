import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Invalid request",
      issues: error.issues.map(({ path, message }) => ({ path, message })),
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  if (code === "23505") {
    res
      .status(409)
      .json({ message: "A record with these details already exists" });
    return;
  }
  if (code === "23503") {
    res.status(400).json({ message: "Referenced record does not exist" });
    return;
  }
  if (
    error &&
    typeof error === "object" &&
    "type" in error &&
    error.type === "entity.parse.failed"
  ) {
    res.status(400).json({ message: "Invalid JSON body" });
    return;
  }
  if (
    error &&
    typeof error === "object" &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    res.status(413).json({ message: "Request body too large" });
    return;
  }
  console.error(
    "Unhandled API error",
    error instanceof Error ? error.name : "UnknownError",
  );
  res.status(500).json({ message: "Internal server error" });
};
