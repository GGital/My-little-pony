import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import fixture from '../../fixtures/deep-lagoon.json'

// TEST-C-07 (U): AC-C-07, D-38. Every :root token equals the design-direction v0.6 section 2 value,
// and Chakra Petch is no longer a dependency.
const css = readFileSync(resolve(__dirname, '../../../src/theme/theme.css'), 'utf8')
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf8'))
const norm = (v: string) => v.replace(/\s+/g, ' ').replace(/\b0\./g, '.').trim().toLowerCase()

function rootTokens(): Record<string, string> {
  const block = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = norm(m[2])
  return out
}

describe('TEST-C-07 theme tokens (AC-C-07)', () => {
  const tokens = rootTokens()
  for (const [name, value] of Object.entries(fixture.tokens)) {
    it(`${name} equals the v0.6 value`, () => {
      expect(tokens[name]).toBe(norm(value))
    })
  }

  it('has no @fontsource/chakra-petch dependency', () => {
    expect(pkg.dependencies['@fontsource/chakra-petch']).toBeUndefined()
  })

  it('self-hosts Inter, Manrope and IBM Plex Sans Thai', () => {
    for (const name of ['inter', 'manrope', 'ibm-plex-sans-thai']) {
      expect(pkg.dependencies[`@fontsource/${name}`], name).toBeDefined()
    }
  })
})
