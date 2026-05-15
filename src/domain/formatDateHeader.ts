// §5.4 — Date header text. `formatDateHeader('YYYY-MM-DD')` →
// e.g. `Tuesday, 26 August 2025`. Parsed in UTC (no timezone off-by-one).
// Invalid / out-of-range input → null. Names are explicit (not locale data)
// so output is deterministic across environments.

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatDateHeader(isoDate: string): string | null {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]); // 1-12
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject values that JS rolled over (e.g. Feb 30 → Mar 2).
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const weekday = DAY_NAMES[date.getUTCDay()];
  const monthName = MONTH_NAMES[month - 1];
  return `${weekday}, ${day} ${monthName} ${year}`;
}
