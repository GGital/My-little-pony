import { randomBytes } from 'node:crypto'
import type { Role } from '@prisma/client'
import type { Response } from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { hashPassword } from '../../src/domain/password.js'
import { TEST_ORIGIN } from './app.js'
import { makeUser } from './db.js'

export const SESSION_COOKIE = 'tcg.sid'

/** A user with a real scrypt hash of a generated password that is never committed (STS §1.3). */
export async function makeUserWithPassword(role: Role, name?: string, email?: string) {
  const password = randomBytes(12).toString('base64url')
  const user = await makeUser(role, name, { email, passwordHash: await hashPassword(password) })
  return { user, password }
}

/** Calls the real E-01, so the test carries a real cookie (STS §1.3). Works with `request(app)` or an agent. */
export function signIn(client: Pick<TestAgent, 'post'>, email: string, password: string) {
  return client.post('/api/auth/login').set('Origin', TEST_ORIGIN).send({ email, password })
}

export type SetCookie = { value: string; attributes: Map<string, string> }

/** Reads the `tcg.sid` Set-Cookie header: its value and its attributes (lower-case names). */
export function readSessionCookie(res: Response): SetCookie | undefined {
  const headers = ([] as string[]).concat(res.headers['set-cookie'] ?? [])
  const line = headers.find((h) => h.startsWith(`${SESSION_COOKIE}=`))
  if (!line) return undefined
  const [pair = '', ...parts] = line.split(';').map((s) => s.trim())
  const attributes = new Map(
    parts.map((part) => {
      const [name = '', ...rest] = part.split('=')
      return [name.toLowerCase(), rest.join('=')] as [string, string]
    }),
  )
  return { value: pair.slice(SESSION_COOKIE.length + 1), attributes }
}

export const cookieHeader = (token: string) => `${SESSION_COOKIE}=${token}`
