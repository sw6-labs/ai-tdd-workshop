// §4 — reply-thread merge.
//
// Insertion points are reply-count lines (§4.1). The line immediately above,
// if a standalone `Thread NN >>>` pointer, supplies the thread number (§4.2);
// numbered points resolve against the uploaded files, numbered-but-missing
// get a placeholder, and unnumbered points are filled by sequence from files
// not already matched by number. The pointer line, reply-count line and the
// scaffolding tail (§4.3) are replaced by the formatted blockquote (§4.4).
// Final whitespace is tidied per §4.5.

import { indexReplyThreads } from './indexReplyThreads';
import type { ReplyFile } from './indexReplyThreads';
import { finalizeOutput } from './finalizeOutput';

export interface MatchedThread {
  number: number | null;
  file: string;
  source: 'number' | 'sequence';
}

export interface MergeReport {
  insertionPoints: number;
  matched: MatchedThread[];
  missing: number[];
  unnumbered: number;
  unusedThreads: string[];
}

export interface MergeResult {
  output: string;
  report: MergeReport;
}

const REPLY_COUNT_RE = /^\*\*\s*\d+\s+repl(?:y|ies)\s*\*\*$/;
const POINTER_RE = /^Thread\s+(\d+)\s*>>>\s*$/;
const VIEW_THREAD_RE = /^View thread$/;
const VIEW_NEWER_RE = /^\*{0,2}View newer replies\*{0,2}$/;

function isScaffold(line: string): boolean {
  const t = line.trim();
  if (VIEW_THREAD_RE.test(t) || VIEW_NEWER_RE.test(t)) return true;
  return t.length > 0 && t.length <= 40 && t.endsWith('ago');
}

interface Point {
  /** Line index of the reply-count line. */
  countIdx: number;
  /** Line index of the pointer (to be removed), or null. */
  pointerIdx: number | null;
  /** Resolved thread number from the pointer, or null if unnumbered. */
  number: number | null;
  /** First line index after the scaffolding tail (exclusive end of removal). */
  removeEnd: number;
  /** Resolution filled in during planning. */
  resolved?: { number: number | null; content: string | null };
}

function scan(lines: string[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!REPLY_COUNT_RE.test(lines[i].trim())) continue;

    let pointerIdx: number | null = null;
    let number: number | null = null;
    if (i > 0) {
      const m = POINTER_RE.exec(lines[i - 1]);
      if (m) {
        pointerIdx = i - 1;
        number = Number(m[1]);
      }
    }

    let j = i + 1;
    while (j < lines.length && isScaffold(lines[j])) j++;

    points.push({ countIdx: i, pointerIdx, number, removeEnd: j });
    i = j - 1; // resume after the scaffolding (loop will ++)
  }
  return points;
}

function buildBlock(number: number | null, content: string | null): string[] {
  const suffix = number === null ? '' : ` ${number}`;
  if (content === null) {
    return ['', `> _[Reply thread${suffix}: no reply-thread file provided]_`, ''];
  }
  const trimmed = content.replace(/\s+$/, '');
  const quoted = trimmed.split('\n').map((l) => (l === '' ? '>' : `> ${l}`));
  return ['', `> **💬 Reply thread${suffix}**`, '>', ...quoted, ''];
}

export function mergeReplyThreads(
  channel: string,
  replyFiles: ReplyFile[],
): MergeResult {
  const lines = channel.replace(/\r\n?/g, '\n').split('\n');
  const index = indexReplyThreads(replyFiles);
  const points = scan(lines);

  const matched: MatchedThread[] = [];
  const missing: number[] = [];
  const usedFiles = new Set<string>();

  // Pass 1: numbered points (in document order) — match or mark missing.
  for (const p of points) {
    if (p.number === null) continue;
    const entry = index.byNumber.get(p.number);
    if (entry) {
      usedFiles.add(entry.name);
      matched.push({ number: p.number, file: entry.name, source: 'number' });
      p.resolved = { number: p.number, content: entry.content };
    } else {
      missing.push(p.number);
      p.resolved = { number: p.number, content: null };
    }
  }

  // Pass 2: sequence fallback for unnumbered points, from the remaining pool.
  const pool = index.ordered.filter((e) => !usedFiles.has(e.name));
  let poolIdx = 0;
  let unnumbered = 0;
  for (const p of points) {
    if (p.number !== null) continue;
    unnumbered++;
    if (poolIdx < pool.length) {
      const entry = pool[poolIdx++];
      usedFiles.add(entry.name);
      matched.push({ number: entry.number, file: entry.name, source: 'sequence' });
      p.resolved = { number: entry.number, content: entry.content };
    } else {
      p.resolved = { number: null, content: null };
    }
  }

  // Pass 3: rebuild the document, swapping each point's range for its block.
  const byStart = new Map<number, Point>();
  for (const p of points) {
    byStart.set(p.pointerIdx ?? p.countIdx, p);
  }

  const out: string[] = [];
  for (let i = 0; i < lines.length; ) {
    const p = byStart.get(i);
    if (p) {
      const r = p.resolved!;
      out.push(...buildBlock(r.number, r.content));
      i = p.removeEnd;
    } else {
      out.push(lines[i]);
      i++;
    }
  }

  const unusedThreads = index.ordered
    .filter((e) => !usedFiles.has(e.name))
    .map((e) => e.name);

  return {
    output: finalizeOutput(out.join('\n')),
    report: {
      insertionPoints: points.length,
      matched,
      missing,
      unnumbered,
      unusedThreads,
    },
  };
}
