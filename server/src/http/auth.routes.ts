import { Router, type CookieOptions } from 'express'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import type { Config } from '../config.js'
import { SESSION_MS, signIn, signOut, toAuthUser } from '../domain/auth.js'
import { requireOrigin } from './origin.js'
import { requireAuth } from './guards.js'
import { SESSION_COOKIE } from './session.js'
import { validate } from './validate.js'

const EMAIL_MESSAGE = 'Enter your email address.'
const PASSWORD_MESSAGE = 'Enter your password.'

/** E-01 body (contracts §4 rules). The password is never trimmed. */
const loginSchema = z
  .object({
    email: z
      .string({ error: EMAIL_MESSAGE })
      .trim()
      .min(3, { error: EMAIL_MESSAGE })
      .max(254, { error: EMAIL_MESSAGE })
      .includes('@', { error: EMAIL_MESSAGE }),
    password: z.string({ error: PASSWORD_MESSAGE }).min(1, { error: PASSWORD_MESSAGE }).max(128, { error: PASSWORD_MESSAGE }),
  })
  .strict()

/** Feature-A: E-01 sign in, E-02 sign out, E-03 who am I (contracts §4, SDS §8). Mounted at /api/auth. */
export function authRouter(db: PrismaClient, config: Config) {
  const router = Router()
  const cookie: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: config.NODE_ENV === 'production',
  }

  router.post('/login', requireOrigin(config.APP_ORIGIN), validate({ body: loginSchema }), async (_req, res) => {
    const { email, password } = res.locals.body as z.infer<typeof loginSchema>
    const { user, token } = await signIn(db, email, password)
    res.cookie(SESSION_COOKIE, token, { ...cookie, maxAge: SESSION_MS })
    res.json(user)
  })

  // requireAuth before requireOrigin, so a signed-out caller always gets 401 first (SDS §6.1).
  router.post('/logout', requireAuth, requireOrigin(config.APP_ORIGIN), async (req, res) => {
    await signOut(db, req.sessionToken!)
    res.clearCookie(SESSION_COOKIE, cookie)
    res.status(204).end()
  })

  router.get('/me', requireAuth, async (req, res) => {
    res.json(toAuthUser(await db.user.findUniqueOrThrow({ where: { id: req.actor!.id } })))
  })

  return router
}
