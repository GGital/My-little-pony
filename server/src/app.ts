import express, { type Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import type { Config } from './config.js'
import { jsonBody } from './http/body.js'
import { errorHandler, sendError } from './http/errors.js'
import { healthRouter } from './http/health.js'
import { createLogger, type Logger } from './log.js'

export type AppDeps = {
  prisma: Pick<PrismaClient, '$queryRaw'>
  config: Config
  log?: Logger
  /** Extra routes mounted under /api before the 404 handler. Tests use it for probe routes. */
  extraRoutes?: (api: Router) => void
}

/** Builds the Express app. Nothing here reads process.env: everything comes in through `deps`. */
export function createApp({ prisma, config, log = createLogger(config.LOG_LEVEL), extraRoutes }: AppDeps) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.TRUST_PROXY)

  const api = express.Router()
  api.use(jsonBody())
  api.use(healthRouter(prisma, log))
  extraRoutes?.(api)
  api.use((_req, res) => sendError(res, 'NOT_FOUND'))
  api.use(errorHandler(log))
  app.use('/api', api)

  // ponytail: the built client is served from here in I-12 (SD-01, one container).
  return app
}
