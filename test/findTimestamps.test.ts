import { findTimestamps, isUsernameLine } from '../src/domain/findTimestamps';
import { NBSP } from './constants';

describe('findTimestamps (spec §5.1 / §5.2)', () => {
  it('detects a standalone H:MM AM/PM line and reports its index/time', () => {
    const text = ['**Clare Sudbery (she/her)**', '  2:03 PM', 'Hello'].join(
      '\n',
    );
    const stamps = findTimestamps(text);
    expect(stamps).toHaveLength(1);
    expect(stamps[0].lineIndex).toBe(1);
    expect(stamps[0].time).toBe('2:03 PM');
  });

  it('matches lines indented with non-breaking spaces (U+00A0)', () => {
    const text = `**neville**\n${NBSP}${NBSP}3:45 PM\nbody`;
    const stamps = findTimestamps(text);
    expect(stamps).toHaveLength(1);
    expect(stamps[0].time).toBe('3:45 PM');
  });

  it('accepts boundary times 00:15 am, 9:17 AM, 12:00 PM (case-insensitive)', () => {
    const text = ['00:15 am', 'x', '9:17 AM', 'y', '12:00 PM'].join('\n');
    expect(findTimestamps(text).map((s) => s.lineIndex)).toEqual([0, 2, 4]);
  });

  it('rejects bare 24-hour times and out-of-range hours', () => {
    const text = ['11:56', '25:00 AM', '13:00 PM', 'just text'].join('\n');
    expect(findTimestamps(text)).toHaveLength(0);
  });

  it('does not match a quoted timestamp inside a reply thread', () => {
    const text = ['> 2:03 PM', '> body'].join('\n');
    expect(findTimestamps(text)).toHaveLength(0);
  });

  it('marks only the first timestamp isFirst', () => {
    const text = ['**a**', '1:00 PM', 'x', '**b**', '2:00 PM'].join('\n');
    const stamps = findTimestamps(text);
    expect(stamps.map((s) => s.isFirst)).toEqual([true, false]);
  });

  it('sets hasUserName when the previous line is a fully bold username', () => {
    const text = ['**Clare Sudbery (she/her)**', '2:03 PM'].join('\n');
    expect(findTimestamps(text)[0].hasUserName).toBe(true);
  });

  it('clears hasUserName when the previous line is not a bold username', () => {
    const text = ['some prose here', '2:03 PM'].join('\n');
    expect(findTimestamps(text)[0].hasUserName).toBe(false);
  });

  it('exposes prevLine and a 40-char prevPreview of the previous line', () => {
    const longLine = 'x'.repeat(60);
    const text = [longLine, '2:03 PM'].join('\n');
    const s = findTimestamps(text)[0];
    expect(s.prevLine).toBe(longLine);
    expect(s.prevPreview).toBe('x'.repeat(40));
  });

  it('treats a timestamp at the start of file as having no previous line', () => {
    const s = findTimestamps('2:03 PM\nbody')[0];
    expect(s.lineIndex).toBe(0);
    expect(s.prevLine).toBeUndefined();
    expect(s.prevPreview).toBe('');
    expect(s.hasUserName).toBe(false);
    expect(s.isFirst).toBe(true);
  });
});

describe('isUsernameLine (spec §5.2)', () => {
  it('is true for a fully bold line, allowing surrounding whitespace', () => {
    expect(isUsernameLine('**Clare Sudbery (she/her)**')).toBe(true);
    expect(isUsernameLine(`  **wiseoldman** `)).toBe(true);
  });

  it('is false for partially bold or non-bold lines', () => {
    expect(isUsernameLine('**bold** then plain')).toBe(false);
    expect(isUsernameLine('plain text')).toBe(false);
    expect(isUsernameLine('****')).toBe(false);
  });
});
