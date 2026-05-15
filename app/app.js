'use strict';

(function () {
  var channelFile = document.getElementById('channelFile');
  var channelFileName = document.getElementById('channelFileName');
  var channelPaste = document.getElementById('channelPaste');
  var replyFiles = document.getElementById('replyFiles');
  var replyFilesCount = document.getElementById('replyFilesCount');
  var runBtn = document.getElementById('runBtn');
  var downloadBtn = document.getElementById('downloadBtn');
  var reportCard = document.getElementById('reportCard');
  var reportEl = document.getElementById('report');
  var outputCard = document.getElementById('outputCard');
  var previewEl = document.getElementById('preview');
  var rawEl = document.getElementById('raw');
  var dateCard = document.getElementById('dateCard');
  var dateTableWrap = document.getElementById('dateTableWrap');
  var dateError = document.getElementById('dateError');
  var applyDatesBtn = document.getElementById('applyDatesBtn');
  var cancelDatesBtn = document.getElementById('cancelDatesBtn');
  var cardReplies = document.getElementById('card-replies');
  var statusChannel = document.getElementById('status-channel');
  var statusReplies = document.getElementById('status-replies');
  var statusMode = document.getElementById('status-mode');

  var state = {
    channelText: '',
    channelFromFile: false,
    replies: [], // {name, content}
    output: '',
    review: null // {text, timestamps, onApply, mergeReport}
  };

  function currentMode() {
    var r = document.querySelector('input[name="mode"]:checked');
    return r ? r.value : 'replies-then-dates';
  }

  function modeNeedsReplies(m) {
    return m === 'replies' ||
      m === 'replies-then-dates' ||
      m === 'dates-then-replies';
  }

  function modeNeedsDates(m) {
    return m === 'dates' ||
      m === 'replies-then-dates' ||
      m === 'dates-then-replies';
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        resolve({ name: file.name, content: String(r.result) });
      };
      r.onerror = function () { reject(r.error); };
      r.readAsText(file);
    });
  }

  function setStatus(el, kind, text) {
    el.className = 'status ' + kind;
    el.textContent = text;
  }

  function refreshStepStates(hasChannel, repliesNeeded) {
    setStatus(
      statusChannel,
      hasChannel ? 'ready' : 'todo',
      hasChannel ? '✓ ready' : 'needs input'
    );

    if (!repliesNeeded) {
      cardReplies.classList.add('dim');
      setStatus(statusReplies, 'skip', 'not needed for this mode');
    } else {
      cardReplies.classList.remove('dim');
      var n = state.replies.length;
      setStatus(
        statusReplies,
        n ? 'ready' : 'todo',
        n ? '✓ ' + n + ' file' + (n === 1 ? '' : 's') : 'needs input'
      );
    }

    // A mode is always selected (one radio is checked by default).
    setStatus(statusMode, 'ready', '✓ ready');
  }

  function refreshRunState() {
    var hasChannel =
      (state.channelFromFile && state.channelText) ||
      channelPaste.value.trim().length > 0;
    var m = currentMode();
    var repliesNeeded = modeNeedsReplies(m);
    var hasReplies = !repliesNeeded || state.replies.length > 0;
    runBtn.disabled = !(hasChannel && hasReplies);
    refreshStepStates(!!hasChannel, repliesNeeded);
  }

  refreshRunState();

  Array.prototype.forEach.call(
    document.querySelectorAll('input[name="mode"]'),
    function (r) { r.addEventListener('change', refreshRunState); }
  );

  channelFile.addEventListener('change', function () {
    var f = channelFile.files[0];
    if (!f) return;
    readFile(f).then(function (res) {
      state.channelText = res.content;
      state.channelFromFile = true;
      channelFileName.textContent = res.name;
      refreshRunState();
    });
  });

  channelPaste.addEventListener('input', refreshRunState);

  replyFiles.addEventListener('change', function () {
    var files = Array.prototype.slice.call(replyFiles.files);
    Promise.all(files.map(readFile)).then(function (list) {
      state.replies = list;
      replyFilesCount.textContent =
        list.length + ' file' + (list.length === 1 ? '' : 's') + ' selected';
      refreshRunState();
    });
  });

  function getChannelText() {
    return state.channelFromFile && state.channelText
      ? state.channelText
      : channelPaste.value;
  }

  function showResult(output, mergeReport, datesNote, filename) {
    state.output = output;
    state.downloadName = filename || 'output.md';
    renderReport(mergeReport, datesNote);
    rawEl.value = output;
    previewEl.innerHTML = renderMarkdown(output);
    reportCard.classList.remove('hidden');
    outputCard.classList.remove('hidden');
    downloadBtn.disabled = false;
  }

  runBtn.addEventListener('click', function () {
    var mode = currentMode();
    var channelText = getChannelText();

    // Hide any previous results while we (re)compute.
    reportCard.classList.add('hidden');
    outputCard.classList.add('hidden');
    dateCard.classList.add('hidden');

    if (mode === 'replies') {
      var r = window.SlackMerger.merge(channelText, state.replies);
      showResult(r.output, r.report, null, 'merged-channel.md');
      return;
    }

    if (mode === 'dates') {
      startDateReview(channelText, null, function (dated, inserted) {
        showResult(
          dated,
          null,
          inserted + ' date header' + (inserted === 1 ? '' : 's') +
            ' inserted.',
          'channel-with-dates.md'
        );
      });
      return;
    }

    if (mode === 'replies-then-dates') {
      var m1 = window.SlackMerger.merge(channelText, state.replies);
      startDateReview(m1.output, m1.report, function (dated, inserted) {
        showResult(
          dated,
          m1.report,
          inserted + ' date header' + (inserted === 1 ? '' : 's') +
            ' inserted after merging.',
          'merged-channel-with-dates.md'
        );
      });
      return;
    }

    // dates-then-replies
    startDateReview(channelText, null, function (dated, inserted) {
      var m2 = window.SlackMerger.merge(dated, state.replies);
      showResult(
        m2.output,
        m2.report,
        inserted + ' date header' + (inserted === 1 ? '' : 's') +
          ' inserted before merging.',
        'merged-channel-with-dates.md'
      );
    });
  });

  // --- Batch date review ---------------------------------------------------

  function startDateReview(text, mergeReport, onApply) {
    var timestamps = window.SlackMerger.findTimestamps(text);
    if (!timestamps.length) {
      onApply(text, 0);
      return;
    }
    state.review = { text: text, timestamps: timestamps, onApply: onApply };
    buildDateTable(timestamps);
    dateError.classList.add('hidden');
    dateError.textContent = '';
    dateCard.classList.remove('hidden');
    dateCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildDateTable(timestamps) {
    var html =
      '<table class="date-table">' +
      '<thead><tr>' +
      '<th>New date?</th><th>Context (prev. line)</th>' +
      '<th>Time</th><th>Date</th>' +
      '</tr></thead><tbody>';
    timestamps.forEach(function (t, idx) {
      var preview = t.prevPreview
        ? esc(t.prevPreview)
        : '<span class="muted">(start of file)</span>';
      html +=
        '<tr>' +
        '<td class="c"><input type="checkbox" data-i="' + idx + '"' +
          (t.isFirst ? ' checked' : '') + ' /></td>' +
        '<td class="ctx">' + preview + '</td>' +
        '<td class="c">' + esc(t.time) + '</td>' +
        '<td><input type="date" data-d="' + idx + '" /></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    dateTableWrap.innerHTML = html;
  }

  applyDatesBtn.addEventListener('click', function () {
    var review = state.review;
    if (!review) return;

    var decisions = [];
    var missing = 0;
    review.timestamps.forEach(function (t, idx) {
      var cb = dateTableWrap.querySelector('input[data-i="' + idx + '"]');
      var di = dateTableWrap.querySelector('input[data-d="' + idx + '"]');
      var insert = cb && cb.checked;
      var header = insert
        ? window.SlackMerger.formatDateHeader(di && di.value)
        : null;
      if (insert && !header) missing++;
      decisions.push({ insert: !!insert && !!header, header: header });
    });

    if (missing) {
      dateError.textContent =
        '⚠ ' + missing + ' ticked timestamp' + (missing === 1 ? '' : 's') +
        ' need a valid date before you can apply.';
      dateError.classList.remove('hidden');
      return;
    }

    var res = window.SlackMerger.insertDates(review.text, decisions);
    dateCard.classList.add('hidden');
    state.review = null;
    review.onApply(res.output, res.inserted);
  });

  cancelDatesBtn.addEventListener('click', function () {
    dateCard.classList.add('hidden');
    state.review = null;
  });

  downloadBtn.addEventListener('click', function () {
    var blob = new Blob([state.output], { type: 'text/markdown' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = state.downloadName || 'output.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Tab switching
  Array.prototype.forEach.call(
    document.querySelectorAll('.tab'),
    function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        var which = btn.getAttribute('data-tab');
        document.getElementById('tab-preview')
          .classList.toggle('hidden', which !== 'preview');
        document.getElementById('tab-raw')
          .classList.toggle('hidden', which !== 'raw');
      });
    }
  );

  function renderReport(r, datesNote) {
    var note = datesNote
      ? '<p class="ok">📅 ' + datesNote + '</p>'
      : '';
    if (!r) {
      reportEl.innerHTML =
        note || '<p>Done. No reply threads were merged in this mode.</p>';
      return;
    }
    var ok = r.matched.length === r.insertionPoints && r.missing.length === 0;
    var bySeq = r.matched.filter(function (m) {
      return m.source === 'sequence';
    }).length;
    var html = '<dl>';
    html += row('Insertion points found', r.insertionPoints);
    html += row(
      'Reply threads inserted',
      '<span class="' + (ok ? 'ok' : 'bad') + '">' +
        r.matched.length + ' / ' + r.insertionPoints + '</span>'
    );
    html += row('Matched by thread number', r.matched.length - bySeq);
    html += row(
      'Matched by order (fallback)',
      bySeq + (bySeq ? ' — check these!' : '')
    );
    html += row(
      'Insertion points without a number',
      r.unnumbered + (r.unnumbered ? ' — check these!' : '')
    );
    if (r.missing.length) {
      html += row(
        'Missing reply files',
        '<span class="bad">' + r.missing.join(', ') + '</span>'
      );
    }
    if (r.unusedThreads.length) {
      html += row(
        'Reply files never inserted',
        r.unusedThreads.join(', ')
      );
    }
    html += '</dl>';
    if (ok && !bySeq && !r.unnumbered && !r.unusedThreads.length) {
      html +=
        '<p class="ok">✓ Every insertion point was matched cleanly by ' +
        'thread number. Still, eyeball the preview to be sure.</p>';
    } else {
      html +=
        '<p class="bad">⚠ Some matches need a human check — ' +
        'review the preview carefully.</p>';
    }
    reportEl.innerHTML = html + note;
  }

  function row(k, v) {
    return '<dt>' + k + '</dt><dd>' + v + '</dd>';
  }

  // --- Minimal, offline markdown renderer (no CDN dependency) ---
  function esc(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inline(s) {
    s = esc(s);
    // images first, then links
    s = s.replace(
      /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g,
      '<img alt="$1" src="$2" />'
    );
    s = s.replace(
      /\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^\w`])_([^_]+)_(?=[^\w]|$)/g, '$1<em>$2</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(
      /(^|[\s(])(https?:\/\/[^\s<)]+)(?=[\s)]|$)/g,
      '$1<a href="$2" target="_blank" rel="noopener">$2</a>'
    );
    return s;
  }

  function renderBlocks(lines) {
    var out = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }

      var h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        var lvl = h[1].length;
        out.push('<h' + lvl + '>' + inline(h[2]) + '</h' + lvl + '>');
        i++;
        continue;
      }

      if (/^>\s?/.test(line)) {
        var quoted = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quoted.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        out.push(
          '<blockquote>' + renderBlocks(quoted) + '</blockquote>'
        );
        continue;
      }

      // paragraph: gather until blank line / blockquote / heading
      var para = [];
      while (
        i < lines.length &&
        !/^\s*$/.test(lines[i]) &&
        !/^>\s?/.test(lines[i]) &&
        !/^#{1,6}\s+/.test(lines[i])
      ) {
        para.push(inline(lines[i]));
        i++;
      }
      out.push('<p>' + para.join('<br>') + '</p>');
    }
    return out.join('\n');
  }

  function renderMarkdown(md) {
    try {
      return renderBlocks(md.replace(/\r\n/g, '\n').split('\n'));
    } catch (e) {
      var pre = document.createElement('pre');
      pre.className = 'fallback';
      pre.textContent = md;
      return pre.outerHTML;
    }
  }
})();
