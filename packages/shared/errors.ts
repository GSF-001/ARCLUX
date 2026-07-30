import type { AriesErrorCode, AriesErrorShape } from "./types";

/**
 * Single error class for the whole codebase. Throw this, never a bare Error,
 * inside packages/* code — so callers (API routes, CLI) can branch on `.code`.
 */
export class AriesError extends Error implements AriesErrorShape {
  code: AriesErrorCode;
  filePath?: string;
  cause?: unknown;

  constructor(shape: AriesErrorShape) {
    super(shape.message);
    this.name = "AriesError";
    this.code = shape.code;
    this.filePath = shape.filePath;
    this.cause = shape.cause;
  }
}

export function isAriesError(err: unknown): err is AriesError {
  return err instanceof AriesError;
}
