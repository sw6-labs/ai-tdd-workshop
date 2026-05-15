import { computeEffectiveDates } from '../src/domain/computeEffectiveDates';

describe('computeEffectiveDates (spec §5.3 defaulting)', () => {
  it('leaves the first ticked row blank when it has no entered date', () => {
    const eff = computeEffectiveDates([
      { ticked: true, date: '' },
      { ticked: true, date: '' },
    ]);
    expect(eff).toEqual(['', '']);
  });

  it('defaults later ticked rows to the most recent valid ticked date above', () => {
    const eff = computeEffectiveDates([
      { ticked: true, date: '2025-08-26' },
      { ticked: true, date: '' },
      { ticked: true, date: '' },
    ]);
    expect(eff).toEqual(['2025-08-26', '2025-08-26', '2025-08-26']);
  });

  it('an explicit valid date overrides the inherited default and carries forward', () => {
    const eff = computeEffectiveDates([
      { ticked: true, date: '2025-08-26' },
      { ticked: true, date: '2025-09-01' },
      { ticked: true, date: '' },
    ]);
    expect(eff).toEqual(['2025-08-26', '2025-09-01', '2025-09-01']);
  });

  it('ignores unticked rows entirely (no value, not a default source)', () => {
    const eff = computeEffectiveDates([
      { ticked: true, date: '2025-08-26' },
      { ticked: false, date: '2099-12-31' },
      { ticked: true, date: '' },
    ]);
    expect(eff).toEqual(['2025-08-26', '', '2025-08-26']);
  });

  it('an invalid entered date does not become a default source', () => {
    const eff = computeEffectiveDates([
      { ticked: true, date: 'not-a-date' },
      { ticked: true, date: '' },
    ]);
    expect(eff).toEqual(['', '']);
  });
});
