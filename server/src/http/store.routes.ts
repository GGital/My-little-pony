import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import type { Config } from '../config.js'
import { validateStoreProfile } from '../domain/store-contact.js'
import { getStoreProfile, updateStoreProfile } from '../domain/store-profile.js'
import { sendError } from './errors.js'
import { requireAuth, requireRole } from './guards.js'
import { requireOrigin } from './origin.js'

/** Feature-U: E-23 GET and PATCH /organizer/store, the caller's own store (Sprint 2 contracts §11.1). Mounted at /api. */
export function storeRouter(db: PrismaClient, config: Config): Router {
  const router = Router()
  const organizer = [requireAuth, requireRole('ORGANIZER')]

  router.get('/organizer/store', ...organizer, async (req, res) => {
    res.json(await getStoreProfile(db, req.actor!))
  })

  // 401 → 403 role → 403 Origin → 400 (all failing fields together) → 200.
  router.patch('/organizer/store', ...organizer, requireOrigin(config.APP_ORIGIN), async (req, res) => {
    const result = validateStoreProfile(req.body)
    if (!result.ok) return sendError(res, 'VALIDATION_FAILED', result.errors)
    res.json(await updateStoreProfile(db, req.actor!, result.data))
  })

  return router
}
