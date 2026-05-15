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

  var state = {
    channelText: '',
    channelFromFile: false,
    replies: [], // {name, content}
    output: ''
  };

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

  function refreshRunState() {
    var hasChannel =
      (state.channelFromFile && state.channelText) ||
      channelPaste.value.trim().length > 0;
    runBtn.disabled = !(hasChannel && state.replies.length > 0);
  }

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

  runBtn.addEventListener('click', function () {
    var channelText = state.channelFromFile && state.channelText
      ? state.channelText
      : channelPaste.value;

    var result = window.SlackMerger.merge(channelText, state.replies);
    state.output = result.output;

    renderReport(result.report);
    rawEl.value = result.output;
    previewEl.innerHTML = renderMarkdown(result.output);

    reportCard.classList.remove('hidden');
    outputCard.classList.remove('hidden');
    downloadBtn.disabled = false;
  });

  downloadBtn.addEventListener('click', function () {
    var blob = new Blob([state.output], { type: 'text/markdown' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'merged-channel.md';
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

  function renderReport(r) {
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
    reportEl.innerHTML = html;
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
