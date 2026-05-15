// §5.1 timestamp detection + §5.2 username detection.
//
// A timestamp line is a line consisting *only* of `H:MM AM/PM`
// (case-insensitive), surrounding whitespace allowed — including the
// non-breaking spaces (U+00A0) Slack uses for indentation, which `\s`
// matches. A leading `>` (quoted reply thread) disqualifies the line, as do
// bare 24-hour times. The shape regex is not enough: hour must be 0–12 and
// minute 00–59 (so `25:00 AM` is rejected, `00:15 am` accepted).

export interface TimestampInfo {
  lineIndex: number;
  time: string;
  prevLine?: string;
  prevPreview: string;
  hasUserName: boolean;
  isFirst: boolean;
}

const PREVIEW_LEN = 40;

const TIMESTAMP_RE = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i;
const USERNAME_RE = /^\s*\*\*.+\*\*\s*$/;

export function isUsernameLine(line: string): boolean {
  return USERNAME_RE.test(line);
}

function isTimestampLine(line: string): boolean {
  const m = TIMESTAMP_RE.exec(line);
  if (!m) return false;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour >= 0 && hour <= 12 && minute >= 0 && minute <= 59;
}

export function findTimestamps(text: string): TimestampInfo[] {
  const lines = text.split('\n');
  const result: TimestampInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isTimestampLine(line)) continue;

    const prevLine = i > 0 ? lines[i - 1] : undefined;
    result.push({
      lineIndex: i,
      time: line.trim(),
      prevLine,
      prevPreview: prevLine ? prevLine.slice(0, PREVIEW_LEN) : '',
      hasUserName: prevLine !== undefined && isUsernameLine(prevLine),
      isFirst: result.length === 0,
    });
  }

  return result;
}
