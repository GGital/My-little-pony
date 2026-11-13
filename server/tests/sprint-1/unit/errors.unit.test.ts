import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Response } from 'express'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { ERRORS, sendError, type ErrorCode } from '../../../src/http/errors.js'

const serverDir = fileURLToPath(new URL('../../../', import.meta.url))

/** SDS §6.2 catalogue, copied here by hand so the test does not trust the code it checks. */
const CATALOGUE: [string, number][] = [
  ['VALIDATION_FAILED', 400],
  ['INVALID_PATH_PARAMETER', 400],
  ['UNAUTHENTICATED', 401],
  ['INVALID_CREDENTIALS', 401],
  ['FORBIDDEN', 403],
  ['EVENT_NOT_FOUND', 404],
  ['REGISTRATION_NOT_FOUND', 404],
  ['NOT_FOUND', 404],
  ['EVENT_FULL', 409],
  ['ALREADY_REGISTERED', 409],
  ['REGISTRATION_CLOSED', 409],
  ['CAPACITY_BELOW_REGISTERED', 409],
  ['EVENT_STARTED', 409],
  ['ALREADY_CANCELLED', 409],
  ['NOT_IN_CHECK_IN_WINDOW', 409],
  ['ALREADY_CHECKED_IN', 409],
  ['PAYLOAD_TOO_LARGE', 413],
  ['UNSUPPORTED_MEDIA_TYPE', 415],
  ['EVENT_TIME_INVALID', 422],
  ['TOO_MANY_ATTEMPTS', 429],
  ['INTERNAL_ERROR', 500],
]

/** A stand-in for Express's response that records what sendError did. */
function fakeRes() {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(body: unknown) {
      res.body = body
      return res
    },
  }
  return res
}

/** Type-checks a snippet against the real errors.ts and returns the compiler's error messages. */
function compile(snippet: string): string[] {
  const configFile = ts.readConfigFile(path.join(serverDir, 'tsconfig.json'), ts.sys.readFile)
  const { options } = ts.parseJsonConfigFileContent(configFile.config, ts.sys, serverDir)
  const file = path.join(serverDir, 'tests/sprint-1/unit/__type-probe__.ts')
  const source = `import type { Response } from 'express'\nimport { sendError } from '../../../src/http/errors.js'\ndeclare const res: Response\n${snippet}\n`
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (name, lang, ...rest) =>
    path.resolve(name) === file ? ts.createSourceFile(name, source, lang) : getSourceFile(name, lang, ...rest)
  const fileExists = host.fileExists.bind(host)
  host.fileExists = (name) => path.resolve(name) === file || fileExists(name)
  const program = ts.createProgram([file], options, host)
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file && path.resolve(d.file.fileName) === file)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}

describe('TEST-SR2-04 — every error code gets its status from the catalogue (NFR-07)', () => {
  it('has exactly the SDS §6.2 codes', () => {
    expect(Object.keys(ERRORS).sort()).toEqual(CATALOGUE.map(([code]) => code).sort())
  })

  it.each(CATALOGUE)('%s answers %i with the standard body', (code, status) => {
    const res = fakeRes()
    sendError(res as unknown as Response, code as ErrorCode)
    expect(res.statusCode).toBe(status)
    expect(res.body).toEqual({ error: { code, message: expect.any(String) } })
    const { message } = (res.body as { error: { message: string } }).error
    expect(message.trim().length).toBeGreaterThan(0)
  })

  it('adds details only when given', () => {
    const res = fakeRes()
    const details = [{ field: 'capacity', message: 'Too small' }]
    sendError(res as unknown as Response, 'VALIDATION_FAILED', details)
    expect(res.body).toEqual({ error: { code: 'VALIDATION_FAILED', message: expect.any(String), details } })
  })

  it('uses the fixed safe wording for 500 (contracts §2 item 6)', () => {
    const res = fakeRes()
    sendError(res as unknown as Response, 'INTERNAL_ERROR')
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Broken on purpose for 6.6' } })
  })

  it('throws at run time for a code outside the catalogue', () => {
    expect(() => sendError(fakeRes() as unknown as Response, 'NOT_A_CODE' as ErrorCode)).toThrow(/NOT_A_CODE/)
  })

  it('refuses an unknown code at compile time, and accepts a known one', () => {
    expect(compile(`sendError(res, 'EVENT_FULL')`)).toEqual([])
    const errors = compile(`sendError(res, 'NOT_A_CODE')`)
    expect(errors.length).toBe(1)
    expect(errors[0]).toMatch(/'"NOT_A_CODE"' is not assignable/)
  })
})
