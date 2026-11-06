import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import type { AuthActor } from './actor.js'
import type { EventDetail } from './events.read.js'

export const createEventInputSchema = z.object({}).strict()

export type CreateEventInput = z.infer<typeof createEventInputSchema>

export async function createEvent(
  _prisma: PrismaClient,
  _actor: AuthActor,
  _input: CreateEventInput,
): Promise<EventDetail> {
  throw new Error('Not implemented: createEvent stub')
}
