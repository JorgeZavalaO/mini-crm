/**
 * Date formatting utilities using the native Intl API.
 * All timestamps are stored as UTC in the database and formatted
 * using the tenant's configured timezone for display.
 */

export const DEFAULT_TIMEZONE = 'America/Lima';
const LOCALE = 'es-PE';

/**
 * Format a date as a full datetime string (date + time) in the given timezone.
 * Example: "10 abr 2026, 10:35"
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
}

/**
 * Format a date as a date-only string in the given timezone.
 * Example: "10 abr 2026"
 */
export function formatDate(
  date: Date | string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE,
  opts?: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts,
    timeZone: timezone,
  });
}

/**
 * Returns a human-readable relative time string (e.g. "hace 3 horas").
 * Timezone-independent (delta is always in ms).
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const diffMs = Date.now() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

  if (diffSeconds < 60) return rtf.format(-diffSeconds, 'second');
  if (diffMinutes < 60) return rtf.format(-diffMinutes, 'minute');
  if (diffHours < 24) return rtf.format(-diffHours, 'hour');
  if (diffDays < 30) return rtf.format(-diffDays, 'day');

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return rtf.format(-diffMonths, 'month');

  return rtf.format(-Math.floor(diffMonths / 12), 'year');
}
