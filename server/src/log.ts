export type LogFields = Record<string, unknown>
export type Logger = {
  error(event: string, fields?: LogFields): void
  info(event: string, fields?: LogFields): void
}

const RANK = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 } as const
export type LogLevel = keyof typeof RANK

/**
 * JSON lines on stdout/stderr, which Cloud Logging reads in Lab 5 (SDS §9.3).
 * Callers pass only safe fields: never passwords, tokens, cookies or request bodies (NFR-03).
 */
export function createLogger(level: LogLevel): Logger {
  const write = (severity: 'error' | 'info', event: string, fields?: LogFields) => {
    if (RANK[severity] > RANK[level]) return
    const line = JSON.stringify({ time: new Date().toISOString(), severity: severity.toUpperCase(), event, ...fields })
    ;(severity === 'error' ? process.stderr : process.stdout).write(`${line}\n`)
  }
  return {
    error: (event, fields) => write('error', event, fields),
    info: (event, fields) => write('info', event, fields),
  }
}
