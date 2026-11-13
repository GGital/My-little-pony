import { z } from 'zod'

const required = (rest: string) => (issue: { input?: unknown }) =>
  issue.input === undefined ? 'is required' : rest

const isOrigin = (value: string) => {
  try {
    return new URL(value).origin === value
  } catch {
    return false
  }
}

/** Server variables of SDS §9.1, checked once at start-up. */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  DATABASE_URL: z
    .string({ error: required('must be text') })
    .regex(/^postgres(ql)?:\/\//, 'must start with postgresql://'),
  APP_ORIGIN: z
    .string({ error: required('must be text') })
    // A comma-separated list is allowed: Cloud Run answers on two URLs (Lab 5).
    .refine(
      (value) => value.split(',').every(isOrigin),
      'must be an origin such as http://localhost:5173 (scheme, host and port only), or several separated by commas',
    ),
  LOG_LEVEL: z.enum(['silent', 'error', 'warn', 'info', 'debug']).default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Lab 5 (R-08): the full commit SHA the image was built from (Docker build argument), or "local".
  GIT_SHA: z
    .string()
    .regex(/^([0-9a-f]{40}|local)$/, 'must be a full 40-character lower-case commit SHA, or "local"')
    .default('local'),
})

export type Config = z.infer<typeof schema>

export const CONFIG_KEYS = Object.keys(schema.shape)
/** In .env.example too, but read by the tests and the seed script, not by the server. */
export const TOOL_KEYS = ['DATABASE_URL_TEST', 'SEED_PASSWORD']

/** Reads and checks the environment. Throws a message naming each bad variable, never its value. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // An empty value counts as missing.
  const input = Object.fromEntries(CONFIG_KEYS.map((key) => [key, env[key] === '' ? undefined : env[key]]))
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const problems = result.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`)
  throw new Error(
    `Invalid configuration: ${problems.join('; ')}. Set it in server/.env (see server/.env.example).`,
  )
}
