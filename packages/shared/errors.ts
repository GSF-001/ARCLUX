import type { ArcluxErrorCode, ArcluxErrorShape } from "./types";

/**
 * Single error class for the whole codebase. Throw this, never a bare Error,
 * inside packages/* code — so callers (API routes, CLI) can branch on `.code`.
 */
export class ArcluxError extends Error implements ArcluxErrorShape {
  code: ArcluxErrorCode;
  filePath?: string;
  cause?: unknown;

  constructor(shape: ArcluxErrorShape) {
    super(shape.message);
    this.name = "ArcluxError";
    this.code = shape.code;
    this.filePath = shape.filePath;
    this.cause = shape.cause;
  }
}

export function isArcluxError(err: unknown): err is ArcluxError {
  return err instanceof ArcluxError;
}
