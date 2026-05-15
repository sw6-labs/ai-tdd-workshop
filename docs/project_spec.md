# Project Spec — Slack Thread Merger

> Reverse-engineered from `exercises/part1-basic.md`, `exercises/part1-extensions.md`
> (extension 4 excluded — no Slack access) and the current implementation in
> `app/` (`index.html`, `app.js`, `parser.js`, `styles.css`).
>
> This document is the **single source of truth** for a from-scratch, test-driven
> rebuild (workshop exercise 2). The current `app/` code is the *behavioural
> reference*, not the artifact to keep: it will be deleted and rebuilt under TDD.
> Spec and tests must tell the same story (see `process-files/processes/testing_process.md`).

## 1. Purpose

A tool that takes a Slack **channel export** (markdown) plus its separate
**reply-thread** markdown files, inserts each reply thread back at its correct
point in the channel, optionally inserts **date headers**, and emits one tidy,
downloadable markdown file with a live preview.

Sample data lives in `markdown/`:
- `markdown/sample-input.md` — the channel export.
- `markdown/sample-reply-threads/ReplyThreadNN.md` — 28 reply threads.
- `markdown/sample-input-image-urls.md` — example only; used for the
  out-of-scope image extension.

## 2. Hard requirements (non-negotiable)

1. **TDD is mandatory.** Every piece of production behaviour is driven by a
   failing test first, following `process-files/processes/testing_process.md`
   and the [LLM Golden Rules](LLM-golden-rules.md):
   - Write/agree the test(s) before production code.
   - See each test fail **meaningfully** (wrong return value / wrong DOM
     state), never via `throw new Error('not implemented')`.
   - Implement the minimum to pass; keep the whole suite green.
   - Work in small, independently verifiable steps.
   - Back-end (pure) logic is tested and built **before** UI wiring.
   - When behaviour or an edge case is clarified, update **this spec** in the
     same change so spec and tests stay in sync.
2. **Stack:** TypeScript for all domain/processing logic. **Jest** for the
   pure logic. **Cypress** for UI behaviour and full end-to-end flows.
3. **Architecture:** the channel/reply/date logic is a set of **pure
   functions** with no DOM access (the testable core, equivalent to today's
   `parser.js`). The UI layer only does I/O, DOM, and event wiring.
4. **Delivery:** a local **dev server is acceptable** (e.g. Vite). The strict
   "double-click `index.html`, zero toolchain" constraint is **dropped**. No
   data ever leaves the browser — all processing is client-side; nothing is
   uploaded anywhere.
5. **Spec location:** this file lives at **`docs/project_spec.md`**, the path
   `testing_process.md` tells the LLM to keep updated.
6. **Test organisation:** split tests by concern — one file per top-level
   `describe`/method group (e.g. `merge.test.ts`, `findTimestamps.test.ts`,
   `insertDates.test.ts`, `indexReplyThreads.test.ts`,
   `formatDateHeader.test.ts`). Avoid magic literals — shared sample strings
   are defined once as constants. Assert observable behaviour/final output,
   not incidental implementation details.

## 3. Inputs

### 3.1 Channel export
- Provided as an uploaded `.md`/`.txt` file **or** pasted into a textarea.
- An uploaded file takes priority over the paste box.
- The UI must warn that raw Slack paste will not format nicely (the sample
  files are pre-processed).

### 3.2 Reply-thread files
- Multiple files selected at once (e.g. the 28 `ReplyThreadNN.md`).
- Not required when the mode does not insert replies (see §6).
- Each file is read as text: `{ name, content }`.

## 4. Core behaviour — reply-thread merge

### 4.1 Insertion-point detection
An insertion point is a line that, trimmed, matches the **reply-count**
pattern:

```
**N reply**   or   **N replies**     (N = digits)
```

Regex (anchored, whole trimmed line):
`^\*\*\s*\d+\s+repl(?:y|ies)\s*\*\*$`

### 4.2 Thread-number resolution
- The line **immediately before** the reply-count line, if it is a
  standalone thread pointer `Thread NN >>>`, gives the thread number.
  Regex: `^Thread\s+(\d+)\s*>>>\s*$` (anchored — inline `... ) Thread >>>`
  inside a message is **not** a pointer and must be left untouched).
- The pointer line is **removed** from the output.
- The number is matched to the reply file whose name matches
  `ReplyThread0*(\d+)\.md` (case-insensitive; leading zeros ignored).
- **Numbered but missing:** if a pointer number is present but no reply
  file matches it, this is **not** a sequence fallback — it is a *missing*
  thread: insert the placeholder (§4.4) and record the number in `missing`.
- **Sequence fallback (unnumbered points only):** insertion points with
  **no** `Thread NN >>>` pointer are resolved by sequence. Build the
  fallback pool from reply files **not already matched by number**, ordered
  by parsed number (else by filename). Assign these pool files, in order, to
  the unnumbered insertion points in document order (1st unnumbered point →
  1st remaining pool file, etc.). A file is never used twice. If the pool is
  exhausted, the unnumbered point gets the no-file placeholder (§4.4).
- Every sequence-fallback / unnumbered insertion point must be flagged in
  the report for human review.

### 4.3 Scaffolding removal
After the reply-count line, consume and discard consecutive "scaffolding
tail" lines, each of which is one of:
- `View thread` (`^View thread$`)
- `View newer replies`, optionally bold (`^\*{0,2}View newer replies\*{0,2}$`)
- an "… ago" line: length ≤ 40 chars and ends with `ago`
  (e.g. `Last reply 2 months ago`, `30 days ago`).

The pointer line + reply-count line + scaffolding tail are replaced by the
inserted thread.

### 4.4 Thread formatting
Insert the matched reply thread as an indented blockquote:
- Trailing whitespace stripped from the content.
- First line: `> **💬 Reply thread N**` (omit ` N` if no number known).
- Then `>` (blank quoted line).
- Each content line: `> <line>`; empty content lines become bare `>`.
- One blank line before and after the inserted block.

If no reply thread can be resolved for an insertion point, insert a
placeholder: `> _[Reply thread N: no reply-thread file provided]_` (wrapped
in blank lines) and record the number as missing.

### 4.5 Whitespace tidy
Final output: collapse 3+ consecutive newlines to a single blank line, trim
leading blank lines, and end the file with exactly one trailing newline.

### 4.6 Report (must be shown to the user)
The merge produces a report with:
- `insertionPoints` — count found.
- `matched` — list of `{ number, file, source: 'number' | 'sequence' }`.
- `missing` — numbers with no reply file.
- `unnumbered` — insertion points with no `Thread NN >>>` pointer.
- `unusedThreads` — reply files never inserted.

The UI surfaces: insertion points found; threads inserted as `X / Y`
(green only when all matched and none missing); count matched by number;
count matched by order/fallback (flagged "check these!" when > 0); count of
unnumbered points (flagged when > 0); missing files; unused files. A clear
"clean" message only when every point matched by number with no fallbacks,
no unnumbered points, and no unused files; otherwise a "needs a human
check" warning. Verified target on sample data: **28/28 matched by number,
0 fallbacks, 0 unused**.

## 5. Core behaviour — date insertion (extensions 1 & 2)

### 5.1 Timestamp detection
A timestamp line is a line consisting **only** of `H:MM AM/PM`
(case-insensitive), leading/trailing whitespace allowed. Bare 24-hour times
like `11:56` are **not** matched. A `> 2:03 PM` line inside a quoted reply
thread is **not** matched (leading `>`).
Regex: `^\s*\d{1,2}:\d{2}\s*(?:AM|PM)\s*$` (case-insensitive). The shape
regex is **not sufficient on its own**: the hour must be **0–12** and the
minute **00–59**, so `25:00 AM` is rejected while `00:15 am` is accepted
(see §8).

> **Gotcha (must be covered by a test):** Slack indents timestamp and
> username lines with **non-breaking spaces (U+00A0)**, so whitespace
> classes must be `\s`, not `[ \t]`.

For each timestamp, expose: `lineIndex`, `time` (trimmed), `prevLine`,
`prevPreview` (first **40** chars of the previous line), `hasUserName`
(true iff the previous line is a fully bold line — see §5.2), and `isFirst`
(true for the first timestamp in the document).

### 5.2 Username detection
A username line is a fully bold line: `^\s*\*\*.+\*\*\s*$`
(e.g. `**Clare Sudbery (she/her)**`).

### 5.3 Date review (UI) — batch table, not a wizard
Present **all** timestamps in one table with columns: *New date?*
(checkbox), *Context* (the 40-char preview of the previous line, or
"(start of file)"), *Time*, *Date* (an HTML `date` picker).
- The first timestamp's checkbox is **pre-ticked** (always a new date).
- **Default date value:** each ticked row's Date picker defaults to the
  most recent **valid date entered in a ticked row above it**; the first
  ticked row (and any ticked row with no dated ticked row above it) starts
  blank. This default is recomputed as the user edits dates/ticks. The
  date-selection callback is invoked with these defaults so the defaulting
  behaviour is observable and testable.
- On apply: every ticked row needs a valid date; if any ticked row lacks a
  valid date, show an error (`⚠ N ticked timestamp(s) need a valid date…`)
  and do not proceed.
- Unticked timestamps are left unchanged.
- A Cancel action abandons the review without changing the document.
- If a document has no timestamps, date insertion is a no-op (0 inserted).

### 5.4 Date header format & placement
- Header text: `formatDateHeader('YYYY-MM-DD')` → e.g.
  `Monday, 26 August 2025`. Parsed in **UTC** (no timezone off-by-one).
  Invalid input → `null` (treated as "no valid date").
  Day names Sunday–Saturday; month names January–December; day not
  zero-padded.
- Rendered as a level-2 header: `## Monday, 26 August 2025`.
- **Placement (extension 2 supersedes 1e):** if the timestamp is preceded
  by a username (bold) line, insert the header **above the username line**;
  otherwise directly above the timestamp.
- Always wrapped in a blank line before and after.
- Insertion is done bottom-up so earlier line indices stay valid.
- After insertion, collapse 3+ newlines to one blank line and trim leading
  blank lines.

Verified target on sample data: ~30 timestamps, all username-preceded,
correct blank-line spacing.

## 6. Modes (extension 3)

A required single-choice mode selector:
1. **Insert reply threads, then insert dates** (default).
2. **Insert dates, then insert reply threads.**
3. **Only insert reply threads.**
4. **Only insert dates** (reply-thread files not required).

The Run button is enabled only when a channel is available **and** reply
files are present *if the mode needs them*. Step status indicators reflect
readiness; the reply step is visibly dimmed/"not needed" in dates-only mode.
Output filenames by mode:
- Mode 1 (replies → dates): `merged-channel-with-dates.md`
- Mode 2 (dates → replies): `merged-channel-with-dates.md`
- Mode 3 (replies only): `merged-channel.md`
- Mode 4 (dates only): `channel-with-dates.md`

## 7. Output & preview

- **Raw markdown** view (read-only textarea) and a rendered **Preview**
  view, toggled by tabs.
- A **Download .md** action saves the result with the mode-appropriate
  filename.
- The preview uses a minimal in-house markdown renderer (headings,
  paragraphs with `<br>` line breaks, nested blockquotes, bold, italic,
  inline code, links, images, autolinked URLs) — no CDN/external library.
  Rendering must HTML-escape input and degrade to a `<pre>` fallback on error.

## 8. Edge cases (turn each into at least one test)

- Inline `>>>` inside message text is not treated as a pointer.
- Reply-count with extra spaces: `** 3  replies **`.
- Insertion point with no preceding `Thread NN >>>` → unnumbered + fallback.
- Numbered point whose `ReplyThreadNN.md` was not uploaded → missing +
  placeholder text.
- Reply file uploaded but never referenced → `unusedThreads`.
- Filenames with/without leading zeros and mixed case (`replythread7.MD`).
- Scaffolding tail with zero, one, or several "… ago"/"View …" lines.
- Empty/blank reply-thread content.
- CRLF vs LF input; trailing-whitespace normalisation; 3+ blank-line collapse.
- Timestamps indented with non-breaking spaces (U+00A0).
- `00:15 am`, `9:17 AM`, `12:00 PM`; reject `11:56`, `25:00 AM`.
- Timestamp at start of file (no previous line) → `(start of file)` context.
- Timestamp preceded by a username vs. not (header placement differs).
- Invalid/empty date on a ticked row → blocking error, no mutation.
- Document with no timestamps / no insertion points → clean no-op.
- Each of the 4 modes, including dates-then-replies ordering interactions
  (date headers must not break later insertion-point detection, and vice
  versa).
- Full-flow Cypress: upload `sample-input.md` + 28 reply files → 28/28
  matched by number, preview correct, download produces expected file.

## 9. Out of scope

- **Extension 4 (Slack image download).** Excluded — no Slack access. The
  preview renderer still renders existing `![alt](url)` markdown image links,
  but no Slack authentication or file download is built.
- **Extension 5 (open-ended polish).** Treated as non-binding nice-to-haves,
  not acceptance criteria. The behaviour above is the contract.

## 10. Acceptance criteria

- Full Jest + Cypress suite green; every behaviour in §4–§7 covered by a
  test that was seen to fail meaningfully before implementation.
- On the sample data: 28/28 reply threads matched by number, 0 fallbacks,
  0 unused; date headers placed above usernames with correct spacing.
- This spec and the test suite describe the same behaviour.
