import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import fixture from '../../fixtures/deep-lagoon.json'

// TEST-C-08 (U): AC-C-08, NFR-10. Every listed text pair is at least 4.5:1 and every control border at least 3:1
// (WCAG 1.4.3, 1.4.11). The last test ties the table to the real theme.css so the pairs cannot drift from the file.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('TEST-C-08 contrast (AC-C-08)', () => {
  for (const [bg, fg] of fixture.textPairs) {
    it(`text ${fg} on ${bg} is at least 4.5:1`, () => {
      expect(contrast(bg, fg)).toBeGreaterThanOrEqual(4.5)
    })
  }
  for (const [bg, line] of fixture.controlPairs) {
    it(`control border ${line} on ${bg} is at least 3:1`, () => {
      expect(contrast(bg, line)).toBeGreaterThanOrEqual(3)
    })
  }
  it('theme.css holds the colours the pairs were measured with', () => {
    const css = readFileSync(resolve(__dirname, '../../../src/theme/theme.css'), 'utf8').toLowerCase()
    for (const name of ['--primary', '--primary-hover', '--accent', '--text', '--text-muted', '--control-line']) {
      const want = (fixture.tokens as Record<string, string>)[name].toLowerCase()
      expect(css, name).toContain(`${name}: ${want}`)
    }
  })
})
