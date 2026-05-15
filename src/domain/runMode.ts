// §6 — mode orchestration over the pure pipeline.
//
// Mode 1 (replies → dates): merge, then detect timestamps in the *merged*
//   text and insert dates.
// Mode 2 (dates → replies): detect timestamps in the *original* channel,
//   insert dates, then merge.
// Mode 3 (replies only): merge; the date selector is never invoked.
// Mode 4 (dates only): insert dates into the original channel; no merge,
//   so reply files are not required and there is no report.
//
// `selectDates` is the UI's choice of which timestamps to date and with what
// date (§5.3); orchestration calls it with the timestamps detected at the
// correct pipeline stage so ordering interactions (§8) are honoured.

import { mergeReplyThreads } from './mergeReplyThreads';
import type { MergeReport } from './mergeReplyThreads';
import type { ReplyFile } from './indexReplyThreads';
import { findTimestamps } from './findTimestamps';
import type { TimestampInfo } from './findTimestamps';
import { insertDates } from './insertDates';
import type { DateSelection } from './insertDates';
import { finalizeOutput } from './finalizeOutput';

export type Mode = 1 | 2 | 3 | 4;

export type SelectDates = (timestamps: TimestampInfo[]) => DateSelection[];

export interface ModeResult {
  output: string;
  report?: MergeReport;
  filename: string;
}

const FILENAMES: Record<Mode, string> = {
  1: 'merged-channel-with-dates.md',
  2: 'merged-channel-with-dates.md',
  3: 'merged-channel.md',
  4: 'channel-with-dates.md',
};

// The text whose timestamps the date-review table is built from, for a
// given mode. Mode 1 dates the *merged* output; modes 2 & 4 date the
// original channel; mode 3 inserts no dates. Keeps the UI in step with the
// timestamps runMode will itself detect (line indices line up).
export function dateStageText(
  mode: Mode,
  channel: string,
  replyFiles: ReplyFile[],
): string {
  if (mode === 1) return mergeReplyThreads(channel, replyFiles).output;
  return channel;
}

function applyDates(text: string, selectDates: SelectDates): string {
  const selections = selectDates(findTimestamps(text));
  return insertDates(text, selections);
}

export function runMode(
  mode: Mode,
  channel: string,
  replyFiles: ReplyFile[],
  selectDates: SelectDates,
): ModeResult {
  const filename = FILENAMES[mode];

  if (mode === 3) {
    const merged = mergeReplyThreads(channel, replyFiles);
    return { output: merged.output, report: merged.report, filename };
  }

  if (mode === 4) {
    return { output: finalizeOutput(applyDates(channel, selectDates)), filename };
  }

  if (mode === 1) {
    const merged = mergeReplyThreads(channel, replyFiles);
    const dated = applyDates(merged.output, selectDates);
    return { output: finalizeOutput(dated), report: merged.report, filename };
  }

  // mode 2: dates first, then merge (merge finalises the output).
  const dated = applyDates(channel, selectDates);
  const merged = mergeReplyThreads(dated, replyFiles);
  return { output: merged.output, report: merged.report, filename };
}
