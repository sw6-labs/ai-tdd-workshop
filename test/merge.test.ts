import { mergeReplyThreads } from '../src/domain/mergeReplyThreads';
import { NBSP, REPLY_HEADER, NO_FILE_PLACEHOLDER } from './constants';

const file = (name: string, content: string) => ({ name, content });

describe('mergeReplyThreads — insertion & formatting (spec §4.1–4.5)', () => {
  it('replaces pointer + reply-count + scaffolding with the formatted thread', () => {
    const channel = [
      '**Clare Sudbery (she/her)**',
      'a message',
      'Thread 01 >>>',
      '**1 reply**',
      '3 months ago',
      'View thread',
      '**neville**',
      'next message',
    ].join('\n');
    const { output } = mergeReplyThreads(channel, [
      file('ReplyThread01.md', 'line one\nline two'),
    ]);

    expect(output).toBe(
      [
        '**Clare Sudbery (she/her)**',
        'a message',
        '',
        REPLY_HEADER(1),
        '>',
        '> line one',
        '> line two',
        '',
        '**neville**',
        'next message',
        '',
      ].join('\n'),
    );
  });

  it('detects a reply-count line with extra spaces (** 3  replies **)', () => {
    const channel = ['Thread 02 >>>', '** 3  replies **', 'done'].join('\n');
    const { report } = mergeReplyThreads(channel, [
      file('ReplyThread02.md', 'x'),
    ]);
    expect(report.insertionPoints).toBe(1);
  });

  it('does not treat an inline >>> inside a message as a pointer', () => {
    const channel = [
      'I can not say the same for the app. >>> (edited)',
      '**1 reply**',
      'View thread',
      'tail',
    ].join('\n');
    const { report, output } = mergeReplyThreads(channel, [
      file('ReplyThread01.md', 'resolved by sequence'),
    ]);
    expect(report.unnumbered).toBe(1);
    expect(report.matched).toEqual([
      { number: 1, file: 'ReplyThread01.md', source: 'sequence' },
    ]);
    expect(output).toContain('I can not say the same for the app. >>> (edited)');
  });

  it('omits the number in the header when the thread number is unknown', () => {
    const channel = ['**1 reply**', 'View thread'].join('\n');
    const { output } = mergeReplyThreads(channel, [
      file('notes.md', 'orphan content'),
    ]);
    expect(output).toContain(REPLY_HEADER(null));
  });

  it('keeps blockquote indentation; empty content lines become bare >', () => {
    const channel = ['Thread 01 >>>', '**1 reply**'].join('\n');
    const { output } = mergeReplyThreads(channel, [
      file('ReplyThread01.md', 'first\n\nthird'),
    ]);
    expect(output).toContain(['> first', '>', '> third'].join('\n'));
  });

  it('strips trailing whitespace from content but preserves inner hard-break spaces', () => {
    const channel = ['Thread 01 >>>', '**1 reply**'].join('\n');
    const { output } = mergeReplyThreads(channel, [
      file('ReplyThread01.md', 'Hi  \nthere\n\n\n'),
    ]);
    expect(output).toContain('> Hi  \n> there');
    expect(output).not.toMatch(/Hi {2}\n>\n>\n>/); // trailing blanks gone
  });

  it('consumes "… ago" and "View newer replies" scaffolding (incl. NBSP-indented)', () => {
    const channel = [
      'Thread 05 >>>',
      '**8 replies**',
      'Last reply 2 months ago',
      '**View newer replies**',
      `${NBSP}30 days ago`,
      'real next line',
    ].join('\n');
    const { output } = mergeReplyThreads(channel, [
      file('ReplyThread05.md', 'body'),
    ]);
    expect(output).not.toContain('Last reply 2 months ago');
    expect(output).not.toContain('View newer replies');
    expect(output).not.toContain('30 days ago');
    expect(output).toContain('real next line');
  });

  it('normalises CRLF, collapses 3+ blank lines, ends with one trailing newline', () => {
    const channel = 'Thread 01 >>>\r\n**1 reply**\r\n\r\n\r\n\r\ntail\r\n';
    const { output } = mergeReplyThreads(channel, [
      file('ReplyThread01.md', 'c'),
    ]);
    expect(output).not.toContain('\r');
    expect(output).not.toMatch(/\n{3,}/);
    expect(output.endsWith('\n')).toBe(true);
    expect(output.endsWith('\n\n')).toBe(false);
  });

  it('inserts a placeholder for a numbered point whose file was not provided', () => {
    const channel = ['Thread 09 >>>', '**1 reply**', 'View thread'].join('\n');
    const { output, report } = mergeReplyThreads(channel, []);
    expect(output).toContain(NO_FILE_PLACEHOLDER(9));
    expect(report.missing).toEqual([9]);
    expect(report.matched).toEqual([]);
  });

  it('uses the no-file placeholder when an unnumbered point exhausts the pool', () => {
    const channel = ['**1 reply**', 'View thread'].join('\n');
    const { output, report } = mergeReplyThreads(channel, []);
    expect(output).toContain(NO_FILE_PLACEHOLDER(null));
    expect(report.unnumbered).toBe(1);
  });
});

describe('mergeReplyThreads — report & fallback (spec §4.2, §4.6)', () => {
  it('matches by number and reports source "number"', () => {
    const channel = [
      'Thread 02 >>>',
      '**1 reply**',
      'View thread',
      'Thread 01 >>>',
      '**2 replies**',
      'View thread',
    ].join('\n');
    const { report } = mergeReplyThreads(channel, [
      file('ReplyThread01.md', 'one'),
      file('ReplyThread02.md', 'two'),
    ]);
    expect(report.insertionPoints).toBe(2);
    expect(report.matched).toEqual([
      { number: 2, file: 'ReplyThread02.md', source: 'number' },
      { number: 1, file: 'ReplyThread01.md', source: 'number' },
    ]);
    expect(report.missing).toEqual([]);
    expect(report.unnumbered).toBe(0);
    expect(report.unusedThreads).toEqual([]);
  });

  it('sequence-fallback for unnumbered points draws only from files not matched by number', () => {
    const channel = [
      'Thread 02 >>>',
      '**1 reply**', // numbered → ReplyThread02
      'View thread',
      '**1 reply**', // unnumbered → first remaining pool file (01)
      'View thread',
      '**1 reply**', // unnumbered → next pool file (03)
      'View thread',
    ].join('\n');
    const { report } = mergeReplyThreads(channel, [
      file('ReplyThread01.md', 'a'),
      file('ReplyThread02.md', 'b'),
      file('ReplyThread03.md', 'c'),
    ]);
    expect(report.matched).toEqual([
      { number: 2, file: 'ReplyThread02.md', source: 'number' },
      { number: 1, file: 'ReplyThread01.md', source: 'sequence' },
      { number: 3, file: 'ReplyThread03.md', source: 'sequence' },
    ]);
    expect(report.unnumbered).toBe(2);
    expect(report.unusedThreads).toEqual([]);
  });

  it('reports reply files that were never inserted as unusedThreads', () => {
    const channel = ['Thread 01 >>>', '**1 reply**', 'View thread'].join('\n');
    const { report } = mergeReplyThreads(channel, [
      file('ReplyThread01.md', 'used'),
      file('ReplyThread99.md', 'never referenced'),
    ]);
    expect(report.unusedThreads).toEqual(['ReplyThread99.md']);
  });

  it('is a clean no-op when there are no insertion points', () => {
    const channel = 'just\na normal\nchannel';
    const { output, report } = mergeReplyThreads(channel, [
      file('ReplyThread01.md', 'unused'),
    ]);
    expect(output).toBe('just\na normal\nchannel\n');
    expect(report.insertionPoints).toBe(0);
    expect(report.matched).toEqual([]);
    expect(report.unusedThreads).toEqual(['ReplyThread01.md']);
  });
});
