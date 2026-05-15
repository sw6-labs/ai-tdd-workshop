import { renderMarkdown } from '../src/domain/renderMarkdown';

describe('renderMarkdown (spec §7)', () => {
  it('HTML-escapes input so markup cannot be injected', () => {
    const html = renderMarkdown('a <script>alert(1)</script> & "x"');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
  });

  it('renders ATX headings h1–h6', () => {
    expect(renderMarkdown('# Title')).toContain('<h1>Title</h1>');
    expect(renderMarkdown('## Tuesday, 26 August 2025')).toContain(
      '<h2>Tuesday, 26 August 2025</h2>',
    );
    expect(renderMarkdown('###### Deep')).toContain('<h6>Deep</h6>');
  });

  it('renders bold, italic and inline code', () => {
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>');
    expect(renderMarkdown('say _hi_ now')).toContain('<em>hi</em>');
    expect(renderMarkdown('use *AA Bot* please')).toContain('<em>AA Bot</em>');
    expect(renderMarkdown('run `npm test`')).toContain(
      '<code>npm test</code>',
    );
  });

  it('renders links and images', () => {
    expect(renderMarkdown('[**AI 2027**](https://ai-2027.com/)')).toContain(
      '<a href="https://ai-2027.com/"><strong>AI 2027</strong></a>',
    );
    expect(renderMarkdown('![alt text](https://x.test/p.png)')).toContain(
      '<img src="https://x.test/p.png" alt="alt text">',
    );
  });

  it('autolinks bare URLs without double-linking markdown links', () => {
    expect(renderMarkdown('see https://example.test/a for more')).toContain(
      '<a href="https://example.test/a">https://example.test/a</a>',
    );
    const linked = renderMarkdown('[site](https://example.test/a)');
    expect(linked.match(/<a /g)).toHaveLength(1);
  });

  it('joins single newlines with <br> and splits paragraphs on blank lines', () => {
    const html = renderMarkdown('line one\nline two\n\nsecond para');
    expect(html).toContain('<p>line one<br>line two</p>');
    expect(html).toContain('<p>second para</p>');
  });

  it('renders nested blockquotes', () => {
    const html = renderMarkdown('> outer\n> > inner');
    expect(html).toBe(
      '<blockquote><p>outer</p><blockquote><p>inner</p></blockquote></blockquote>',
    );
  });

  it('renders a reply-thread blockquote with its bold header', () => {
    const html = renderMarkdown(
      ['> **💬 Reply thread 1**', '>', '> hello'].join('\n'),
    );
    expect(html).toContain(
      '<blockquote><p><strong>💬 Reply thread 1</strong></p><p>hello</p></blockquote>',
    );
  });

  it('falls back to an escaped <pre> block on a rendering error', () => {
    // A non-string slips past typing; renderer must not throw.
    const html = renderMarkdown(undefined as unknown as string);
    expect(html.startsWith('<pre>')).toBe(true);
    expect(html).not.toContain('<script>');
  });
});
