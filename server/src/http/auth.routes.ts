import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import type { Config } from '../config.js'

// I-04 red stub: no routes yet, so E-01 … E-03 answer 404.
export function authRouter(_db: PrismaClient, _config: Config) {
  return Router()
}
