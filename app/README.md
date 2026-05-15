# Slack Thread Merger

Inserts Slack reply threads back into a channel export at the correct
points and produces one tidy markdown file.

## Run it

Double-click `app/index.html` (or open it in any browser). No build step,
no server, no internet required. Everything runs locally in the browser.

## Use it

1. **Channel export** — choose `markdown/sample-input.md` (or paste the
   channel text).
2. **Reply thread files** — select all 28 `markdown/sample-reply-threads/ReplyThreadNN.md`
   files at once.
3. Click **Merge threads**.
4. Check the **Result** panel, eyeball the **Preview**, then **Download .md**.

## How matching works

An insertion point in the channel looks like:

```
Thread 07 >>>
**13 replies**
Last reply 2 months ago
View thread
```

- The standalone `Thread NN >>>` line gives the thread number; it is
  matched to `ReplyThreadNN.md` by filename.
- If a number is missing, it falls back to insertion-point order and the
  Result panel flags it for a human check.
- The four scaffolding lines are removed and the reply thread is inserted
  in their place as an indented blockquote.
- Inline `>>>` inside message text (e.g. "…longwinded) Thread >>>") is
  left untouched — only standalone numbered pointers count.

Verified against `sample-input.md`: 28/28 insertion points matched by
number, no false positives.
