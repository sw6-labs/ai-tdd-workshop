// §4.5 — final whitespace tidy applied to any emitted document: normalise
// line endings, collapse 3+ consecutive newlines to a single blank line,
// trim leading blank lines, and end the file with exactly one trailing
// newline.
export function finalizeOutput(text: string): string {
  const body = text
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
  return body + '\n';
}
