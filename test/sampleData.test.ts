import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { mergeReplyThreads } from '../src/domain/mergeReplyThreads';
import { findTimestamps } from '../src/domain/findTimestamps';

const MD_DIR = join(__dirname, '..', 'markdown');
const REPLY_DIR = join(MD_DIR, 'sample-reply-threads');

describe('Sample data acceptance (spec §4.6 / §10)', () => {
  const channel = readFileSync(join(MD_DIR, 'sample-input.md'), 'utf8');
  const replyFiles = readdirSync(REPLY_DIR)
    .filter((n) => n.endsWith('.md'))
    .map((name) => ({
      name,
      content: readFileSync(join(REPLY_DIR, name), 'utf8'),
    }));

  it('matches 28/28 reply threads by number, 0 fallbacks, 0 unused', () => {
    const { report } = mergeReplyThreads(channel, replyFiles);

    expect(replyFiles).toHaveLength(28);
    expect(report.insertionPoints).toBe(28);
    expect(report.matched).toHaveLength(28);
    expect(report.matched.every((m) => m.source === 'number')).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.unnumbered).toBe(0);
    expect(report.unusedThreads).toEqual([]);
  });

  it('finds the documented ~30 username-preceded timestamps', () => {
    const stamps = findTimestamps(channel);
    expect(stamps.length).toBeGreaterThanOrEqual(28);
    expect(stamps.every((s) => s.hasUserName)).toBe(true);
  });
});
