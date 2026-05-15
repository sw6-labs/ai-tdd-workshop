// UI layer (spec §3, §5.3, §6, §7): I/O, DOM and event wiring only. All
// channel/reply/date logic lives in the pure domain modules.

import { runMode, dateStageText } from './domain/runMode';
import type { Mode, ModeResult } from './domain/runMode';
import type { ReplyFile } from './domain/indexReplyThreads';
import { findTimestamps } from './domain/findTimestamps';
import type { TimestampInfo } from './domain/findTimestamps';
import { computeEffectiveDates } from './domain/computeEffectiveDates';
import type { DateSelection } from './domain/insertDates';
import { renderMarkdown } from './domain/renderMarkdown';
import type { MergeReport } from './domain/mergeReplyThreads';

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const channelFileEl = $<HTMLInputElement>('channel-file');
const channelPasteEl = $<HTMLTextAreaElement>('channel-paste');
const channelStatusEl = $('channel-status');
const replyFilesEl = $<HTMLInputElement>('reply-files');
const replyStatusEl = $('reply-status');
const replySectionEl = $('reply-section');
const runEl = $<HTMLButtonElement>('run');
const runHintEl = $('run-hint');
const dateReviewEl = $('date-review');
const dateTbodyEl = $('date-tbody');
const dateErrorEl = $('date-error');
const applyDatesEl = $<HTMLButtonElement>('apply-dates');
const cancelDatesEl = $<HTMLButtonElement>('cancel-dates');
const reportSectionEl = $('report-section');
const reportEl = $('report');
const outputSectionEl = $('output-section');
const rawOutputEl = $<HTMLTextAreaElement>('raw-output');
const previewOutputEl = $('preview-output');
const tabRawEl = $<HTMLButtonElement>('tab-raw');
const tabPreviewEl = $<HTMLButtonElement>('tab-preview');
const downloadEl = $<HTMLButtonElement>('download');

let channelFileText: string | null = null;
let replyFiles: ReplyFile[] = [];
let currentResult: ModeResult | null = null;
let pendingStamps: TimestampInfo[] = [];

const normalize = (s: string): string => s.replace(/\r\n?/g, '\n');

function selectedMode(): Mode {
  const checked = document.querySelector<HTMLInputElement>(
    'input[name="mode"]:checked',
  );
  return Number(checked?.value ?? '1') as Mode;
}

const modeNeedsReplies = (m: Mode): boolean => m !== 4;
const modeInsertsDates = (m: Mode): boolean => m !== 3;

function channelText(): string {
  // Uploaded file takes priority over the paste box (§3.1).
  if (channelFileText !== null && channelFileText.trim() !== '')
    return channelFileText;
  return normalize(channelPasteEl.value);
}

function hasChannel(): boolean {
  return channelText().trim() !== '';
}

function readFileText(file: File): Promise<string> {
  return file.text().then(normalize);
}

function refreshState(): void {
  const mode = selectedMode();
  const needsReplies = modeNeedsReplies(mode);

  channelStatusEl.textContent = hasChannel()
    ? 'Channel: ready'
    : 'Channel: not provided';
  channelStatusEl.classList.toggle('ready', hasChannel());

  replySectionEl.classList.toggle('not-needed', !needsReplies);
  if (!needsReplies) {
    replyStatusEl.textContent = 'Reply files: not needed for this mode';
    replyStatusEl.className = 'status not-needed';
  } else {
    const ok = replyFiles.length > 0;
    replyStatusEl.textContent = ok
      ? `Reply files: ${replyFiles.length} ready`
      : 'Reply files: none';
    replyStatusEl.className = ok ? 'status ready' : 'status';
  }

  const ready = hasChannel() && (!needsReplies || replyFiles.length > 0);
  runEl.disabled = !ready;
  runHintEl.textContent = ready
    ? ''
    : !hasChannel()
      ? 'Provide a channel export to continue.'
      : 'This mode needs reply-thread files.';
}

channelFileEl.addEventListener('change', async () => {
  const f = channelFileEl.files?.[0];
  channelFileText = f ? await readFileText(f) : null;
  refreshState();
});
channelPasteEl.addEventListener('input', refreshState);
replyFilesEl.addEventListener('change', async () => {
  const files = Array.from(replyFilesEl.files ?? []);
  replyFiles = await Promise.all(
    files.map(async (f) => ({ name: f.name, content: await readFileText(f) })),
  );
  refreshState();
});
document
  .querySelectorAll('input[name="mode"]')
  .forEach((el) => el.addEventListener('change', refreshState));

// ---- Date review table (spec §5.3) -------------------------------------

function rowStates(): { ticked: boolean; date: string }[] {
  return Array.from(dateTbodyEl.querySelectorAll('tr')).map((tr) => ({
    ticked: tr.querySelector<HTMLInputElement>('.tick')!.checked,
    date: tr.querySelector<HTMLInputElement>('.date')!.value,
  }));
}

function applyDefaults(): void {
  const effective = computeEffectiveDates(rowStates());
  Array.from(dateTbodyEl.querySelectorAll('tr')).forEach((tr, i) => {
    const tick = tr.querySelector<HTMLInputElement>('.tick')!;
    const date = tr.querySelector<HTMLInputElement>('.date')!;
    date.disabled = !tick.checked;
    // Only fill an empty box with the inherited default; never overwrite a
    // value the user typed.
    if (tick.checked && date.value === '' && effective[i] !== '')
      date.placeholder = effective[i];
    else if (!tick.checked) date.placeholder = '';
  });
}

function buildDateTable(stamps: TimestampInfo[]): void {
  dateTbodyEl.innerHTML = '';
  stamps.forEach((s) => {
    const tr = document.createElement('tr');

    const tickTd = document.createElement('td');
    const tick = document.createElement('input');
    tick.type = 'checkbox';
    tick.className = 'tick';
    tick.checked = s.isFirst; // first timestamp always a new date (§5.3)
    tickTd.appendChild(tick);

    const ctxTd = document.createElement('td');
    ctxTd.textContent =
      s.prevLine === undefined ? '(start of file)' : s.prevPreview;

    const timeTd = document.createElement('td');
    timeTd.textContent = s.time;

    const dateTd = document.createElement('td');
    const date = document.createElement('input');
    date.type = 'date';
    date.className = 'date';
    dateTd.appendChild(date);

    tick.addEventListener('change', applyDefaults);
    date.addEventListener('input', applyDefaults);

    tr.append(tickTd, ctxTd, timeTd, dateTd);
    dateTbodyEl.appendChild(tr);
  });
  applyDefaults();
}

function collectSelections(): {
  selections: DateSelection[];
  invalidTicked: number;
} {
  const states = rowStates();
  const effective = computeEffectiveDates(states);
  const selections: DateSelection[] = [];
  let invalidTicked = 0;
  states.forEach((st, i) => {
    if (!st.ticked) return;
    if (effective[i] === '') {
      invalidTicked++;
      return;
    }
    selections.push({ lineIndex: pendingStamps[i].lineIndex, date: effective[i] });
  });
  return { selections, invalidTicked };
}

// ---- Report (spec §4.6) ------------------------------------------------

function renderReport(report: MergeReport): void {
  const byNumber = report.matched.filter((m) => m.source === 'number').length;
  const bySeq = report.matched.filter((m) => m.source === 'sequence').length;
  const insertedOk =
    report.matched.length === report.insertionPoints &&
    report.missing.length === 0;
  const clean =
    byNumber === report.insertionPoints &&
    bySeq === 0 &&
    report.unnumbered === 0 &&
    report.missing.length === 0 &&
    report.unusedThreads.length === 0;

  const line = (html: string, cls = ''): string =>
    `<p class="report-line ${cls}">${html}</p>`;

  reportEl.innerHTML = [
    line(`Insertion points found: <strong>${report.insertionPoints}</strong>`),
    line(
      `Threads inserted: <strong data-testid="inserted-ratio">${report.matched.length} / ${report.insertionPoints}</strong>`,
      insertedOk ? 'report-good' : 'report-flag',
    ),
    line(`Matched by number: ${byNumber}`),
    line(
      `Matched by order/fallback: ${bySeq}${bySeq > 0 ? ' &mdash; check these!' : ''}`,
      bySeq > 0 ? 'report-flag' : '',
    ),
    line(
      `Unnumbered insertion points: ${report.unnumbered}`,
      report.unnumbered > 0 ? 'report-flag' : '',
    ),
    line(
      `Missing reply files: ${report.missing.length ? report.missing.join(', ') : 'none'}`,
      report.missing.length ? 'report-flag' : '',
    ),
    line(
      `Unused reply files: ${report.unusedThreads.length ? report.unusedThreads.join(', ') : 'none'}`,
      report.unusedThreads.length ? 'report-flag' : '',
    ),
    clean
      ? line('✓ Clean: every thread matched by number, nothing to review.', 'report-good')
      : line('⚠ Needs a human check &mdash; review the flagged items above.', 'report-flag'),
  ].join('');
  reportSectionEl.hidden = false;
}

// ---- Output & preview (spec §7) ----------------------------------------

function showOutput(result: ModeResult): void {
  currentResult = result;
  rawOutputEl.value = result.output;
  previewOutputEl.innerHTML = renderMarkdown(result.output);
  outputSectionEl.hidden = false;
  selectTab('raw');
  if (result.report) renderReport(result.report);
  else reportSectionEl.hidden = true;
}

function selectTab(which: 'raw' | 'preview'): void {
  const raw = which === 'raw';
  rawOutputEl.hidden = !raw;
  previewOutputEl.hidden = raw;
  tabRawEl.classList.toggle('active', raw);
  tabPreviewEl.classList.toggle('active', !raw);
}

tabRawEl.addEventListener('click', () => selectTab('raw'));
tabPreviewEl.addEventListener('click', () => selectTab('preview'));

downloadEl.addEventListener('click', () => {
  if (!currentResult) return;
  const blob = new Blob([currentResult.output], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = currentResult.filename;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---- Run / apply / cancel ---------------------------------------------

function finishRun(mode: Mode, selections: DateSelection[]): void {
  const result = runMode(mode, channelText(), replyFiles, () => selections);
  showOutput(result);
}

runEl.addEventListener('click', () => {
  const mode = selectedMode();
  dateReviewEl.hidden = true;
  dateErrorEl.hidden = true;

  if (!modeInsertsDates(mode)) {
    finishRun(mode, []);
    return;
  }

  pendingStamps = findTimestamps(dateStageText(mode, channelText(), replyFiles));
  if (pendingStamps.length === 0) {
    finishRun(mode, []); // no timestamps → date insertion is a no-op (§5.3)
    return;
  }

  buildDateTable(pendingStamps);
  dateReviewEl.hidden = false;
  outputSectionEl.hidden = true;
  reportSectionEl.hidden = true;
});

applyDatesEl.addEventListener('click', () => {
  const { selections, invalidTicked } = collectSelections();
  if (invalidTicked > 0) {
    dateErrorEl.textContent = `⚠ ${invalidTicked} ticked timestamp(s) need a valid date before you can apply.`;
    dateErrorEl.hidden = false;
    return;
  }
  dateErrorEl.hidden = true;
  dateReviewEl.hidden = true;
  finishRun(selectedMode(), selections);
});

cancelDatesEl.addEventListener('click', () => {
  // Abandon the review without changing the document (§5.3).
  dateReviewEl.hidden = true;
  dateErrorEl.hidden = true;
});

refreshState();
