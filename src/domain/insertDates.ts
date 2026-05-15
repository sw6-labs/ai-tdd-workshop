// §5.4 — date header format & placement.
//
// For each selected (ticked) timestamp: render `## <formatDateHeader(date)>`
// wrapped in a blank line before and after. Placement (extension 2): if the
// timestamp is preceded by a username (fully bold) line, the header goes
// *above the username line*; otherwise directly above the timestamp.
// Insertion is bottom-up so earlier line indices stay valid. Afterwards,
// collapse 3+ newlines to one blank line and trim leading blank lines.

import { formatDateHeader } from './formatDateHeader';
import { isUsernameLine } from './findTimestamps';

export interface DateSelection {
  lineIndex: number;
  date: string;
}

export function tidyAfterInsert(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
}

export function insertDates(text: string, selections: DateSelection[]): string {
  const lines = text.split('\n');
  let inserted = false;

  // Bottom-up: descending lineIndex keeps not-yet-processed indices valid.
  const ordered = [...selections].sort((a, b) => b.lineIndex - a.lineIndex);

  for (const { lineIndex, date } of ordered) {
    const header = formatDateHeader(date);
    if (header === null) continue; // invalid date → defensive no-op for row

    const prev = lineIndex > 0 ? lines[lineIndex - 1] : undefined;
    const insertAt =
      prev !== undefined && isUsernameLine(prev) ? lineIndex - 1 : lineIndex;

    lines.splice(insertAt, 0, '', `## ${header}`, '');
    inserted = true;
  }

  if (!inserted) return text;
  return tidyAfterInsert(lines.join('\n'));
}
