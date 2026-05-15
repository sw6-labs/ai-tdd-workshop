// UI behaviour (spec §3, §5.3, §6, §7) with small inline data.

const CHANNEL = [
  '**Clare Sudbery (she/her)**',
  '  2:03 PM',
  'a message',
  'Thread 01 >>>',
  '**1 reply**',
  'View thread',
  '**neville**',
  '  3:45 PM',
  'another message',
].join('\n');

const REPLY = 'reply thread body line';

const channelFile = () => ({
  contents: Cypress.Buffer.from(CHANNEL),
  fileName: 'channel.md',
});
const replyFile = () => ({
  contents: Cypress.Buffer.from(REPLY),
  fileName: 'ReplyThread01.md',
});

describe('Slack Thread Merger UI', () => {
  beforeEach(() => cy.visit('/'));

  it('warns that raw Slack paste will not format nicely (§3.1)', () => {
    cy.get('#paste-warning').should('be.visible').and('contain', 'not format');
  });

  it('keeps Run disabled until a channel and (if needed) reply files exist (§6)', () => {
    cy.get('#run').should('be.disabled');
    cy.get('#channel-file').selectFile(channelFile());
    cy.get('#run').should('be.disabled'); // mode 1 still needs replies
    cy.get('#run-hint').should('contain', 'reply-thread files');
    cy.get('#reply-files').selectFile(replyFile());
    cy.get('#run').should('be.enabled');
  });

  it('dims the reply step and needs no reply files in dates-only mode (§6)', () => {
    cy.get('input[name="mode"][value="4"]').check();
    cy.get('#reply-section').should('have.class', 'not-needed');
    cy.get('#reply-status').should('contain', 'not needed');
    cy.get('#channel-file').selectFile(channelFile());
    cy.get('#run').should('be.enabled');
  });

  it('runs replies-only (mode 3): merges, shows report, no date review (§4, §6)', () => {
    cy.get('input[name="mode"][value="3"]').check();
    cy.get('#channel-file').selectFile(channelFile());
    cy.get('#reply-files').selectFile(replyFile());
    cy.get('#run').click();
    cy.get('#date-review').should('not.be.visible');
    cy.get('[data-testid="inserted-ratio"]').should('have.text', '1 / 1');
    cy.get('#report').should('contain', 'Clean');
    cy.get('#raw-output').should('contain.value', '💬 Reply thread 1');
  });

  it('date review: first row pre-ticked, blocks apply on missing date, then applies (§5.3)', () => {
    cy.get('input[name="mode"][value="4"]').check();
    cy.get('#channel-file').selectFile(channelFile());
    cy.get('#run').click();

    cy.get('#date-table tbody tr').should('have.length', 2);
    cy.get('#date-table tbody tr').eq(0).find('.tick').should('be.checked');
    cy.get('#date-table tbody tr').eq(1).find('.tick').should('not.be.checked');

    // First row ticked but no date → blocking error, no output.
    cy.get('#apply-dates').click();
    cy.get('#date-error').should('be.visible').and('contain', 'valid date');
    cy.get('#output-section').should('not.be.visible');

    cy.get('#date-table tbody tr').eq(0).find('.date').type('2025-08-26');
    cy.get('#apply-dates').click();
    cy.get('#date-error').should('not.be.visible');
    cy.get('#raw-output').should('contain.value', '## Tuesday, 26 August 2025');
  });

  it('cancel abandons the date review without producing output (§5.3)', () => {
    cy.get('input[name="mode"][value="4"]').check();
    cy.get('#channel-file').selectFile(channelFile());
    cy.get('#run').click();
    cy.get('#cancel-dates').click();
    cy.get('#date-review').should('not.be.visible');
    cy.get('#output-section').should('not.be.visible');
  });

  it('toggles Raw and Preview tabs and renders markdown (§7)', () => {
    cy.get('input[name="mode"][value="3"]').check();
    cy.get('#channel-file').selectFile(channelFile());
    cy.get('#reply-files').selectFile(replyFile());
    cy.get('#run').click();
    cy.get('#raw-output').should('be.visible');
    cy.get('#tab-preview').click();
    cy.get('#preview-output').should('be.visible');
    cy.get('#preview-output blockquote strong').should(
      'contain',
      'Reply thread 1',
    );
  });
});
