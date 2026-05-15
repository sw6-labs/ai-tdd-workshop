// §5.3 — date-picker defaulting. Each ticked row's effective date is the
// date the user entered (if valid), otherwise the most recent valid date
// from a ticked row above it. The first ticked row (and any with no valid
// dated ticked row above) stays blank. Unticked rows contribute nothing and
// receive no value. Recomputed on every edit by the UI.

import { formatDateHeader } from './formatDateHeader';

export interface DateRowState {
  ticked: boolean;
  date: string;
}

const isValid = (d: string): boolean => formatDateHeader(d) !== null;

export function computeEffectiveDates(rows: DateRowState[]): string[] {
  let lastValid = '';
  return rows.map((row) => {
    if (!row.ticked) return '';
    const effective = isValid(row.date) ? row.date : lastValid;
    if (isValid(effective)) lastValid = effective;
    return effective;
  });
}
