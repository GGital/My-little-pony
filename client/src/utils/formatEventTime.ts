/**
 * Formats an ISO 8601 date string to the standardized Bangkok time format:
 * e.g., "Thu 5 Nov 2026 · 17:00"
 *
 * Requirements (AC-SR3-01, NFR-11):
 * - Always formatted in Asia/Bangkok time zone regardless of client's local system timezone.
 * - Locale formatted as en-GB (e.g. "Thu 5 Nov 2026 · 17:00").
 */
export function formatEventTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = dtf.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const weekday = partMap.weekday || '';
  const day = partMap.day || '';
  const month = partMap.month || '';
  const year = partMap.year || '';
  const hour = partMap.hour || '';
  const minute = partMap.minute || '';

  return `${weekday} ${day} ${month} ${year} · ${hour}:${minute}`;
}
