import { indexReplyThreads } from '../src/domain/indexReplyThreads';

const f = (name: string, content = `body of ${name}`) => ({ name, content });

describe('indexReplyThreads (spec §4.2)', () => {
  it('matches a number ignoring leading zeros and filename case', () => {
    const idx = indexReplyThreads([
      f('ReplyThread01.md'),
      f('replythread7.MD'),
      f('ReplyThread10.md'),
    ]);
    expect(idx.byNumber.get(1)?.name).toBe('ReplyThread01.md');
    expect(idx.byNumber.get(7)?.name).toBe('replythread7.MD');
    expect(idx.byNumber.get(10)?.name).toBe('ReplyThread10.md');
  });

  it('exposes the parsed number and original content on each entry', () => {
    const idx = indexReplyThreads([f('ReplyThread03.md', 'hello')]);
    const entry = idx.byNumber.get(3)!;
    expect(entry.number).toBe(3);
    expect(entry.content).toBe('hello');
  });

  it('orders entries by parsed number ascending', () => {
    const idx = indexReplyThreads([
      f('ReplyThread10.md'),
      f('ReplyThread02.md'),
      f('ReplyThread1.md'),
    ]);
    expect(idx.ordered.map((e) => e.number)).toEqual([1, 2, 10]);
  });

  it('treats non-matching filenames as unnumbered and orders them last by filename', () => {
    const idx = indexReplyThreads([
      f('zeta-notes.md'),
      f('ReplyThread05.md'),
      f('alpha.md'),
    ]);
    expect(idx.ordered.map((e) => e.name)).toEqual([
      'ReplyThread05.md',
      'alpha.md',
      'zeta-notes.md',
    ]);
    expect(idx.byNumber.get(5)?.name).toBe('ReplyThread05.md');
    expect(idx.ordered[1].number).toBeNull();
  });

  it('handles an empty input list', () => {
    const idx = indexReplyThreads([]);
    expect(idx.ordered).toEqual([]);
    expect(idx.byNumber.size).toBe(0);
  });
});
