import { runMode } from '../src/domain/runMode';
import type { TimestampInfo } from '../src/domain/findTimestamps';
import { DATE_2025_08_26, HEADER_2025_08_26, REPLY_HEADER } from './constants';

const CHANNEL = [
  '**Clare Sudbery (she/her)**',
  '  2:03 PM',
  'a message',
  'Thread 01 >>>',
  '**1 reply**',
  'View thread',
  '**neville**',
  '  3:45 PM',
  'another',
].join('\n');

const REPLY_FILES = [{ name: 'ReplyThread01.md', content: 'reply body' }];

// Tick every detected timestamp with one fixed date (UI is mocked here).
const tickAll = (stamps: TimestampInfo[]) =>
  stamps.map((s) => ({ lineIndex: s.lineIndex, date: DATE_2025_08_26 }));

describe('runMode (spec §6)', () => {
  it('mode 3 (replies only): merges, no dates, filename merged-channel.md', () => {
    const called = jest.fn(tickAll);
    const r = runMode(3, CHANNEL, REPLY_FILES, called);
    expect(called).not.toHaveBeenCalled();
    expect(r.output).toContain(REPLY_HEADER(1));
    expect(r.output).not.toContain(`## ${HEADER_2025_08_26}`);
    expect(r.report?.matched).toHaveLength(1);
    expect(r.filename).toBe('merged-channel.md');
  });

  it('mode 4 (dates only): inserts dates, no merge, filename channel-with-dates.md', () => {
    const r = runMode(4, CHANNEL, REPLY_FILES, tickAll);
    expect(r.output).toContain(`## ${HEADER_2025_08_26}`);
    expect(r.output).toContain('Thread 01 >>>'); // pointer untouched (no merge)
    expect(r.output).not.toContain(REPLY_HEADER(1));
    expect(r.report).toBeUndefined();
    expect(r.filename).toBe('channel-with-dates.md');
  });

  it('mode 1 (replies → dates): detects timestamps in the MERGED text', () => {
    const seen = jest.fn(tickAll);
    const r = runMode(1, CHANNEL, REPLY_FILES, seen);
    // Timestamps detected after merge; the reply blockquote is not a timestamp.
    const stamps = seen.mock.calls[0][0] as TimestampInfo[];
    expect(stamps.map((s) => s.time)).toEqual(['2:03 PM', '3:45 PM']);
    expect(r.output).toContain(REPLY_HEADER(1));
    expect(r.output).toContain(`## ${HEADER_2025_08_26}`);
    expect(r.filename).toBe('merged-channel-with-dates.md');
  });

  it('mode 2 (dates → replies): detects timestamps in the ORIGINAL channel', () => {
    const seen = jest.fn(tickAll);
    const r = runMode(2, CHANNEL, REPLY_FILES, seen);
    const stamps = seen.mock.calls[0][0] as TimestampInfo[];
    expect(stamps.map((s) => s.time)).toEqual(['2:03 PM', '3:45 PM']);
    // Date headers must not break later insertion-point detection.
    expect(r.output).toContain(REPLY_HEADER(1));
    expect(r.output).toContain(`## ${HEADER_2025_08_26}`);
    expect(r.report?.matched).toHaveLength(1);
    expect(r.filename).toBe('merged-channel-with-dates.md');
  });

  it('every mode output ends with exactly one trailing newline', () => {
    for (const mode of [1, 2, 3, 4] as const) {
      const out = runMode(mode, CHANNEL, REPLY_FILES, tickAll).output;
      expect(out.endsWith('\n')).toBe(true);
      expect(out.endsWith('\n\n')).toBe(false);
    }
  });

  it('mode 4 with no timestamps is a clean no-op (0 inserted)', () => {
    const r = runMode(4, 'no times here\njust text', [], tickAll);
    expect(r.output).toBe('no times here\njust text\n');
  });
});
