import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import type { Config } from './config.js'
import { authRouter } from './http/auth.routes.js'
import { jsonBody } from './http/body.js'
import { errorHandler, sendError } from './http/errors.js'
import { eventsRouter } from './http/events.routes.js'
import { healthRouter } from './http/health.js'
import { meRouter } from './http/me.routes.js'
import { loadSession } from './http/session.js'
import { organizerRouter } from './http/organizer.routes.js'
import { createLogger, type Logger } from './log.js'

export type AppDeps = {
  prisma: PrismaClient
  config: Config
  log?: Logger
  /** Extra routes mounted under /api before the 404 handler. Tests use it for probe routes. */
  extraRoutes?: (api: Router) => void
  /** Folder holding the built React app. Default: client/dist next to server/ (the same layout in the image). */
  staticDir?: string
}

const BUILT_CLIENT = fileURLToPath(new URL('../../client/dist', import.meta.url))

/** Builds the Express app. Nothing here reads process.env: everything comes in through `deps`. */
export function createApp({
  prisma,
  config,
  log = createLogger(config.LOG_LEVEL),
  extraRoutes,
  staticDir = BUILT_CLIENT,
}: AppDeps) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.TRUST_PROXY)

  const api = express.Router()
  api.use(jsonBody())
  api.use(healthRouter(prisma, log, config.GIT_SHA))
  api.use(loadSession(prisma)) // SDS §2.3 step 2: every route after health knows its caller
  api.use('/auth', authRouter(prisma, config))
  api.use(organizerRouter(prisma))
  api.use(eventsRouter(prisma, config))
  api.use(meRouter(prisma))
  extraRoutes?.(api)
  api.use((_req, res) => sendError(res, 'NOT_FOUND'))
  api.use(errorHandler(log))
  app.use('/api', api)

  // SD-01: the same container serves the built React app. /api never reaches here (its own 404 above).
  // Without a client build (local API-only runs) only /api is served.
  const indexHtml = join(staticDir, 'index.html')
  if (existsSync(indexHtml)) {
    app.use(express.static(staticDir))
    // Client-side routes such as /events/1 get the app, which then routes itself.
    app.use((req, res, next) => (req.method === 'GET' || req.method === 'HEAD' ? res.sendFile(indexHtml) : next()))
  }
  return app
}
