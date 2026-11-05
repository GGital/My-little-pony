export type LogFields = Record<string, unknown>
export type Logger = {
  error(event: string, fields?: LogFields): void
  info(event: string, fields?: LogFields): void
}

// RED STUB (I-02 commit A): logs nothing.
export function createLogger(_level: string): Logger {
  return { error() {}, info() {} }
}
