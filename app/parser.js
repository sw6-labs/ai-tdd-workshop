/*
 * Slack channel + reply-thread merger.
 *
 * Pure logic, no DOM. Works in the browser (attaches to window.SlackMerger)
 * and in Node (module.exports) so it can be exercised from a script.
 *
 * Insertion point in the channel export looks like:
 *
 *     Thread 07 >>>
 *     **13 replies**
 *     Last reply 2 months ago
 *     View thread
 *
 * The standalone "Thread NN >>>" pointer gives the thread number; we match it
 * to ReplyThreadNN.md by filename. If the number is missing we fall back to
 * the order in which insertion points appear. The four scaffolding lines are
 * replaced by the reply thread, rendered as an indented blockquote.
 */
(function (root) {
  'use strict';

  // Standalone pointer line, e.g. "Thread 07 >>>". Anchored so inline uses
  // like "...longwinded) Thread >>>" inside a message are NOT matched.
  var RE_THREAD_PTR = /^Thread\s+(\d+)\s*>>>\s*$/;
  // "**1 reply**" or "**13 replies**"
  var RE_REPLY_COUNT = /^\*\*\s*\d+\s+repl(?:y|ies)\s*\*\*$/;
  var RE_VIEW_THREAD = /^View thread$/;
  var RE_VIEW_NEWER = /^\*{0,2}View newer replies\*{0,2}$/;
  // "3 months ago", "Last reply 2 months ago", "30 days ago", etc.
  var RE_AGO = /ago$/i;

  function isAgoLine(line) {
    return line.length <= 40 && RE_AGO.test(line);
  }

  // A scaffolding tail line is one of: an "... ago" line, "View thread",
  // or "View newer replies". We keep eating them after the reply-count line.
  function isScaffoldTail(line) {
    return (
      RE_VIEW_THREAD.test(line) ||
      RE_VIEW_NEWER.test(line) ||
      isAgoLine(line)
    );
  }

  /**
   * Build a lookup of reply threads from uploaded files.
   * @param {Array<{name:string, content:string}>} files
   * @returns {{byNumber:Object, ordered:Array}}
   */
  function indexReplyThreads(files) {
    var byNumber = {};
    var named = [];
    (files || []).forEach(function (f) {
      var m = /ReplyThread0*(\d+)\s*\.md$/i.exec(f.name || '');
      var num = m ? parseInt(m[1], 10) : null;
      var entry = { name: f.name, content: f.content, number: num };
      if (num != null) byNumber[num] = entry;
      named.push(entry);
    });
    // Fallback ordering: by parsed number when available, else by filename.
    named.sort(function (a, b) {
      if (a.number != null && b.number != null) return a.number - b.number;
      return String(a.name).localeCompare(String(b.name));
    });
    return { byNumber: byNumber, ordered: named };
  }

  /**
   * Render a reply thread as an indented blockquote section.
   */
  function formatThread(label, content) {
    var body = String(content).replace(/\s+$/, '').split(/\r?\n/);
    var out = ['> **💬 ' + label + '**', '>'];
    body.forEach(function (line) {
      out.push(line.length ? '> ' + line : '>');
    });
    return out.join('\n');
  }

  /**
   * Merge reply threads into the channel export.
   *
   * @param {string} channelText
   * @param {Array<{name:string, content:string}>} replyFiles
   * @returns {{output:string, report:Object}}
   */
  function merge(channelText, replyFiles) {
    var idx = indexReplyThreads(replyFiles);
    var lines = String(channelText).replace(/\r\n/g, '\n').split('\n');

    var out = [];
    var report = {
      insertionPoints: 0,
      matched: [],       // {number, file, source: 'number'|'sequence'}
      missing: [],       // numbers with no reply file
      unnumbered: 0,     // insertion points lacking a Thread NN >>> pointer
      unusedThreads: []  // reply files never inserted
    };
    var usedNumbers = {};
    var sequenceCounter = 0; // ordinal of insertion points, for fallback

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();

      if (!RE_REPLY_COUNT.test(trimmed)) {
        out.push(line);
        continue;
      }

      // --- We're at an insertion point ---
      report.insertionPoints++;
      sequenceCounter++;

      // The "Thread NN >>>" pointer (if any) is the line we last emitted.
      var number = null;
      var prevPtr = RE_THREAD_PTR.exec(
        (out.length ? out[out.length - 1] : '').trim()
      );
      if (prevPtr) {
        number = parseInt(prevPtr[1], 10);
        out.pop(); // drop the pointer line from the output
      } else {
        report.unnumbered++;
      }

      // Consume the scaffolding tail (reply-count + ago + View thread...).
      var j = i + 1;
      while (j < lines.length && isScaffoldTail(lines[j].trim())) j++;
      // Resume the outer loop just before the next real line.
      i = j - 1;

      // Resolve which reply thread to insert.
      var entry = null;
      var source = null;
      if (number != null && idx.byNumber[number]) {
        entry = idx.byNumber[number];
        source = 'number';
      } else if (number != null) {
        // Numbered, but no matching file uploaded.
        report.missing.push(number);
      }
      if (!entry) {
        // Fallback: Nth insertion point -> Nth reply file in order.
        var fallback = idx.ordered[sequenceCounter - 1];
        if (fallback) {
          entry = fallback;
          source = 'sequence';
          if (number == null) number = fallback.number;
        }
      }

      var label =
        'Reply thread' + (number != null ? ' ' + number : '');
      if (entry) {
        out.push('');
        out.push(formatThread(label, entry.content));
        out.push('');
        if (entry.number != null) usedNumbers[entry.number] = true;
        report.matched.push({
          number: number,
          file: entry.name,
          source: source
        });
      } else {
        out.push('');
        out.push(
          '> _[' + label + ': no reply-thread file provided]_'
        );
        out.push('');
        if (number != null && report.missing.indexOf(number) === -1) {
          report.missing.push(number);
        }
      }
    }

    idx.ordered.forEach(function (e) {
      if (e.number != null && !usedNumbers[e.number]) {
        report.unusedThreads.push(e.number);
      }
    });

    // Collapse 3+ blank lines down to a single blank line.
    var merged = out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '')
      .replace(/\s+$/, '\n');

    return { output: merged, report: report };
  }

  // --- Date insertion (Exercise 1 + 2) -------------------------------------

  // A line that consists ONLY of a single H:MM AM/PM timestamp (leading /
  // trailing whitespace allowed). Bare times like "11:56" are intentionally
  // NOT matched, and "> 2:03 PM" inside a blockquoted reply thread is not
  // matched either (it has a leading ">").
  // \s is used (not [ \t]) because Slack indents these lines with
  // non-breaking spaces (U+00A0); lines are already split, so \s never
  // spans a newline here.
  var RE_TIMESTAMP = /^\s*\d{1,2}:\d{2}\s*(?:AM|PM)\s*$/i;
  // A fully bold line, e.g. "**Clare Sudbery (she/her)**" — a Slack username.
  var RE_BOLD_LINE = /^\s*\*\*.+\*\*\s*$/;

  var DAYS = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday'
  ];
  var MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  /**
   * Find every standalone timestamp line in the text.
   * @returns {Array<{lineIndex:number, time:string, prevLine:string,
   *   prevPreview:string, hasUserName:boolean, isFirst:boolean}>}
   */
  function findTimestamps(text) {
    var lines = String(text).replace(/\r\n/g, '\n').split('\n');
    var found = [];
    for (var i = 0; i < lines.length; i++) {
      if (!RE_TIMESTAMP.test(lines[i])) continue;
      var prev = i > 0 ? lines[i - 1] : '';
      found.push({
        lineIndex: i,
        time: lines[i].trim(),
        prevLine: prev,
        prevPreview: prev.slice(0, 40),
        hasUserName: RE_BOLD_LINE.test(prev),
        isFirst: found.length === 0
      });
    }
    return found;
  }

  /**
   * Format an ISO "YYYY-MM-DD" string as e.g. "Monday, 26 August 2025".
   * Parsed in UTC to avoid timezone off-by-one. Returns null if invalid.
   */
  function formatDateHeader(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    if (!m) return null;
    var y = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10);
    var d = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    return DAYS[dt.getUTCDay()] + ', ' + d + ' ' + MONTHS[mo - 1] + ' ' + y;
  }

  /**
   * Insert "## <date>" headers above selected timestamps.
   *
   * `decisions` is aligned by index with findTimestamps(text): each entry is
   * { insert:boolean, header:string }. When a timestamp is preceded by a bold
   * username line, the header goes ABOVE the username (Exercise 2); otherwise
   * directly above the timestamp (Exercise 1e). The header is always wrapped
   * in blank lines.
   *
   * @returns {{output:string, inserted:number}}
   */
  function insertDates(text, decisions) {
    var lines = String(text).replace(/\r\n/g, '\n').split('\n');
    var stamps = findTimestamps(text);
    var inserted = 0;
    decisions = decisions || [];
    // Bottom-up so earlier line indices stay valid as we splice.
    for (var k = stamps.length - 1; k >= 0; k--) {
      var dec = decisions[k];
      if (!dec || !dec.insert || !dec.header) continue;
      var s = stamps[k];
      var at = s.hasUserName ? s.lineIndex - 1 : s.lineIndex;
      lines.splice(at, 0, '', '## ' + dec.header, '');
      inserted++;
    }
    var outText = lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '');
    return { output: outText, inserted: inserted };
  }

  var api = {
    merge: merge,
    indexReplyThreads: indexReplyThreads,
    findTimestamps: findTimestamps,
    formatDateHeader: formatDateHeader,
    insertDates: insertDates
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.SlackMerger = api;
  }
})(typeof window !== 'undefined' ? window : this);
