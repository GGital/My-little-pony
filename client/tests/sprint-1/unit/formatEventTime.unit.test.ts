import { describe, it, expect } from 'vitest';
import { formatEventTime } from '../../../src/utils/formatEventTime';

describe('formatEventTime (TEST-SR3-02)', () => {
  it('formats UTC ISO timestamp into Asia/Bangkok time with en-GB format', () => {
    // 2026-11-05T10:00:00Z + 07:00 = 2026-11-05 17:00
    const result = formatEventTime('2026-11-05T10:00:00Z');
    expect(result).toBe('Thu 5 Nov 2026 · 17:00');
  });

  it('correctly handles date rollover across time zones', () => {
    // 2026-11-05T20:00:00Z + 07:00 = 2026-11-06 03:00
    const result = formatEventTime('2026-11-05T20:00:00Z');
    expect(result).toBe('Fri 6 Nov 2026 · 03:00');
  });
});
