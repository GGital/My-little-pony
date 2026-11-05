// RED STUB (I-02 commit A): no start-up validation yet.
export type Config = {
  NODE_ENV: 'development' | 'test' | 'production'
  PORT: number
  DATABASE_URL: string
  APP_ORIGIN: string
  LOG_LEVEL: 'silent' | 'error' | 'warn' | 'info' | 'debug'
  TRUST_PROXY: number
}

export const CONFIG_KEYS: string[] = []
export const TOOL_KEYS: string[] = []

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return env as unknown as Config
}
