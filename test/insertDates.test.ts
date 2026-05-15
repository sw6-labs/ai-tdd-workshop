import { insertDates } from '../src/domain/insertDates';
import { DATE_2025_08_26, HEADER_2025_08_26 } from './constants';

describe('insertDates (spec §5.4)', () => {
  it('inserts the header above the username line when a username precedes', () => {
    const text = ['**Clare Sudbery (she/her)**', '  2:03 PM', 'body'].join(
      '\n',
    );
    const out = insertDates(text, [{ lineIndex: 1, date: DATE_2025_08_26 }]);
    expect(out).toBe(
      [
        `## ${HEADER_2025_08_26}`,
        '',
        '**Clare Sudbery (she/her)**',
        '  2:03 PM',
        'body',
      ].join('\n'),
    );
  });

  it('inserts directly above the timestamp when no username precedes', () => {
    const text = ['some prose', '2:03 PM', 'body'].join('\n');
    const out = insertDates(text, [{ lineIndex: 1, date: DATE_2025_08_26 }]);
    expect(out).toBe(
      [
        'some prose',
        '',
        `## ${HEADER_2025_08_26}`,
        '',
        '2:03 PM',
        'body',
      ].join('\n'),
    );
  });

  it('renders the header as a level-2 markdown header', () => {
    const out = insertDates('2:03 PM', [
      { lineIndex: 0, date: DATE_2025_08_26 },
    ]);
    expect(out.startsWith(`## ${HEADER_2025_08_26}`)).toBe(true);
  });

  it('inserts bottom-up so multiple line indices stay valid', () => {
    const text = [
      '**a**',
      '1:00 PM',
      'msg one',
      '**b**',
      '2:00 PM',
      'msg two',
    ].join('\n');
    const out = insertDates(text, [
      { lineIndex: 1, date: '2025-08-26' },
      { lineIndex: 4, date: '2025-08-27' },
    ]);
    expect(out).toBe(
      [
        '## Tuesday, 26 August 2025',
        '',
        '**a**',
        '1:00 PM',
        'msg one',
        '',
        '## Wednesday, 27 August 2025',
        '',
        '**b**',
        '2:00 PM',
        'msg two',
      ].join('\n'),
    );
  });

  it('leaves unticked timestamps (those not in selections) untouched', () => {
    const text = ['**a**', '1:00 PM', 'x', '**b**', '2:00 PM'].join('\n');
    const out = insertDates(text, [{ lineIndex: 1, date: DATE_2025_08_26 }]);
    expect(out).toContain('## ' + HEADER_2025_08_26);
    expect(out.match(/^## /gm)).toHaveLength(1);
  });

  it('skips a selection whose date is invalid (defensive no-op for that row)', () => {
    const text = ['**a**', '1:00 PM'].join('\n');
    expect(insertDates(text, [{ lineIndex: 1, date: 'nope' }])).toBe(text);
  });

  it('collapses 3+ newlines to one blank line and trims leading blank lines', () => {
    const text = ['', '', '**a**', '1:00 PM', '', '', '', 'tail'].join('\n');
    const out = insertDates(text, [{ lineIndex: 3, date: DATE_2025_08_26 }]);
    expect(out.startsWith(`## ${HEADER_2025_08_26}`)).toBe(true);
    expect(out).not.toMatch(/\n{3,}/);
  });

  it('is a no-op when there are no selections', () => {
    const text = '**a**\n1:00 PM\nbody';
    expect(insertDates(text, [])).toBe(text);
  });
});
