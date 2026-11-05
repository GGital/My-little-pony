import express, { type Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import type { Config } from './config.js'
import type { Logger } from './log.js'

export type AppDeps = {
  prisma: Pick<PrismaClient, '$queryRaw'>
  config: Config
  log?: Logger
  /** Extra routes mounted under /api before the 404 handler. Tests use it for probe routes. */
  extraRoutes?: (api: Router) => void
}

// RED STUB (I-02 commit A): an empty app with no routes or error handling.
export function createApp(_deps: AppDeps) {
  return express()
}
