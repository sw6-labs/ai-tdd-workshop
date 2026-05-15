// Shared sample strings/constants for the test suite (testing_process.md §7:
// avoid magic literals). One definition, reused across spec-driven tests.

export const DATE_2025_08_26 = '2025-08-26';
export const HEADER_2025_08_26 = 'Tuesday, 26 August 2025';

// Non-breaking space (U+00A0) Slack uses for timestamp/username indentation.
export const NBSP = ' ';

export const REPLY_HEADER = (n: number | null): string =>
  n === null ? '> **💬 Reply thread**' : `> **💬 Reply thread ${n}**`;

export const NO_FILE_PLACEHOLDER = (n: number | null): string =>
  n === null
    ? '> _[Reply thread: no reply-thread file provided]_'
    : `> _[Reply thread ${n}: no reply-thread file provided]_`;
