import { formatDateHeader } from '../src/domain/formatDateHeader';
import { DATE_2025_08_26, HEADER_2025_08_26 } from './constants';

describe('formatDateHeader (spec §5.4)', () => {
  it('formats a valid date as "Weekday, D Month YYYY"', () => {
    expect(formatDateHeader(DATE_2025_08_26)).toBe(HEADER_2025_08_26);
  });

  it('parses in UTC (no timezone off-by-one)', () => {
    // Midnight UTC must not roll back a day in negative-offset zones.
    expect(formatDateHeader('2025-01-01')).toBe('Wednesday, 1 January 2025');
  });

  it('does not zero-pad the day', () => {
    expect(formatDateHeader('2025-08-01')).toBe('Friday, 1 August 2025');
    expect(formatDateHeader('2025-01-05')).toBe('Sunday, 5 January 2025');
  });

  it('handles December and a leap day', () => {
    expect(formatDateHeader('2025-12-31')).toBe('Wednesday, 31 December 2025');
    expect(formatDateHeader('2024-02-29')).toBe('Thursday, 29 February 2024');
  });

  it('returns null for malformed input', () => {
    expect(formatDateHeader('')).toBeNull();
    expect(formatDateHeader('not-a-date')).toBeNull();
    expect(formatDateHeader('2025-8-1')).toBeNull();
    expect(formatDateHeader('2025/08/26')).toBeNull();
    expect(formatDateHeader('26-08-2025')).toBeNull();
  });

  it('returns null for an out-of-range calendar date', () => {
    expect(formatDateHeader('2025-02-30')).toBeNull();
    expect(formatDateHeader('2025-13-01')).toBeNull();
    expect(formatDateHeader('2025-00-10')).toBeNull();
    expect(formatDateHeader('2023-02-29')).toBeNull(); // 2023 is not a leap year
  });
});
