import { describe, it, expect } from 'vitest';
import { formatEventTime } from '../../../src/utils/formatEventTime';

describe('formatEventTime (TEST-SR3-02)', () => {
  const zones = ['UTC', 'America/New_York'];
  it.each(zones)('formats in Bangkok time when the machine is set to %s', (zone) => {
    const saved = process.env.TZ;
    process.env.TZ = zone;
    try {
      const offset = new Date('2026-11-05T10:00:00Z').getTimezoneOffset();
      expect(offset).toBe(zone === 'UTC' ? 0 : 300); // proves the zone really changed
      expect(formatEventTime('2026-11-05T10:00:00Z')).toBe('Thu 5 Nov 2026 · 17:00');
    } finally {
      process.env.TZ = saved;
    }
  });

  it('correctly handles date rollover across time zones', () => {
    // 2026-11-05T20:00:00Z + 07:00 = 2026-11-06 03:00
    const result = formatEventTime('2026-11-05T20:00:00Z');
    expect(result).toBe('Fri 6 Nov 2026 · 03:00');
  });
});
