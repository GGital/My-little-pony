import type { Response } from 'express'

// RED STUB (I-02 commit A): the error catalogue is not implemented yet.
export const ERRORS: Record<string, { status: number; message: string }> = {}
export type ErrorCode = string
export type ErrorDetail = { field: string; message: string }

export class HttpError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly details?: ErrorDetail[],
  ) {
    super(code)
  }
}

export function sendError(res: Response, _code: ErrorCode, _details?: ErrorDetail[]) {
  return res
}
