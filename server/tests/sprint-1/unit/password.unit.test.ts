import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../../../src/domain/password.js'

// TEST-A-05 (U), AC-A-05, NFR-03. password.ts came with I-01 (the seed hashes with it), so this unit test has no
// red run of its own: it pins the reused TokTickIT behaviour before Feature-A relies on it for sign-in.
const HASH = /^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/

describe('TEST-A-05 (U) — scrypt password hashing', () => {
  it('hashPassword gives scrypt$32768$8$1$<salt>$<hash>, with a new salt each time', async () => {
    const a = await hashPassword('correct horse battery')
    const b = await hashPassword('correct horse battery')
    expect(a).toMatch(HASH)
    expect(a).not.toBe(b)
  })

  it('verifyPassword: the right password is true, a wrong one or a malformed hash is false', async () => {
    const stored = await hashPassword('correct horse battery')
    expect(await verifyPassword('correct horse battery', stored)).toBe(true)
    expect(await verifyPassword('correct horse batter', stored)).toBe(false)
    expect(await verifyPassword('correct horse battery', 'scrypt$test')).toBe(false)
    expect(await verifyPassword('correct horse battery', 'plain-text')).toBe(false)
  })
})
