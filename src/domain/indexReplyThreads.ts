// §4.2 — thread-number resolution / reply-file matching.
//
// A reply file is matched to a thread number by filename
// `ReplyThread0*(\d+)\.md` (case-insensitive; leading zeros ignored).
// Non-matching names are "unnumbered". `ordered` is the sequence-fallback
// pool order: numbered entries by parsed number ascending, then unnumbered
// entries by filename.

export interface ReplyFile {
  name: string;
  content: string;
}

export interface IndexedReplyThread {
  number: number | null;
  name: string;
  content: string;
}

export interface ReplyThreadIndex {
  byNumber: Map<number, IndexedReplyThread>;
  ordered: IndexedReplyThread[];
}

const NAME_RE = /^ReplyThread0*(\d+)\.md$/i;

function parseNumber(name: string): number | null {
  const m = NAME_RE.exec(name.trim());
  return m ? Number(m[1]) : null;
}

export function indexReplyThreads(files: ReplyFile[]): ReplyThreadIndex {
  const entries: IndexedReplyThread[] = files.map((file) => ({
    number: parseNumber(file.name),
    name: file.name,
    content: file.content,
  }));

  const ordered = [...entries].sort((a, b) => {
    if (a.number !== null && b.number !== null) return a.number - b.number;
    if (a.number !== null) return -1;
    if (b.number !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  const byNumber = new Map<number, IndexedReplyThread>();
  for (const entry of ordered) {
    if (entry.number !== null && !byNumber.has(entry.number)) {
      byNumber.set(entry.number, entry);
    }
  }

  return { byNumber, ordered };
}
