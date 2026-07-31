export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function currentLevel(): LogLevel {
  const fromEnv = process.env.ARCLUX_LOG_LEVEL as LogLevel | undefined;
  return fromEnv && fromEnv in LEVEL_WEIGHT ? fromEnv : "info";
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

function log(namespace: string, level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentLevel()]) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${namespace}]`;
  const line = meta ? `${prefix} ${message} ${JSON.stringify(meta)}` : `${prefix} ${message}`;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Minimal namespaced logger. Every package should create its own via
 * createLogger("packageName") instead of calling console.* directly, so
 * output stays consistent and filterable via the ARCLUX_LOG_LEVEL env var.
 */
export function createLogger(namespace: string): Logger {
  return {
    debug: (message, meta) => log(namespace, "debug", message, meta),
    info: (message, meta) => log(namespace, "info", message, meta),
    warn: (message, meta) => log(namespace, "warn", message, meta),
    error: (message, meta) => log(namespace, "error", message, meta),
  };
}
