import { dateStageText } from '../src/domain/runMode';
import { REPLY_HEADER } from './constants';

const CHANNEL = ['Thread 01 >>>', '**1 reply**', 'View thread', 'tail'].join(
  '\n',
);
const REPLIES = [{ name: 'ReplyThread01.md', content: 'r' }];

describe('dateStageText (spec §6 — timestamp detection stage per mode)', () => {
  it('mode 1 dates the merged output', () => {
    expect(dateStageText(1, CHANNEL, REPLIES)).toContain(REPLY_HEADER(1));
  });

  it('modes 2 and 4 date the original channel (unmerged)', () => {
    expect(dateStageText(2, CHANNEL, REPLIES)).toContain('Thread 01 >>>');
    expect(dateStageText(4, CHANNEL, REPLIES)).toContain('Thread 01 >>>');
    expect(dateStageText(4, CHANNEL, REPLIES)).not.toContain(REPLY_HEADER(1));
  });
});
