// Full-flow acceptance (spec §8, §10): upload sample-input.md + 28 reply
// files → 28/28 matched by number, preview correct, download names the file.

const REPLY_PATHS = Array.from({ length: 28 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return `markdown/sample-reply-threads/ReplyThread${n}.md`;
});

describe('Full flow on the sample data', () => {
  it('merges 28/28 by number and downloads merged-channel.md (mode 3)', () => {
    cy.visit('/');
    cy.get('input[name="mode"][value="3"]').check();
    cy.get('#channel-file').selectFile('markdown/sample-input.md');
    cy.get('#reply-files').selectFile(REPLY_PATHS);
    cy.get('#run').click();

    cy.get('[data-testid="inserted-ratio"]')
      .should('have.text', '28 / 28')
      .parent()
      .should('have.class', 'report-good');
    cy.get('#report').should('contain', 'Matched by number: 28');
    cy.get('#report').should('contain', 'Matched by order/fallback: 0');
    cy.get('#report').should('contain', 'Unused reply files: none');
    cy.get('#report').should('contain', 'Clean');

    cy.get('#raw-output')
      .should('contain.value', '💬 Reply thread 1')
      .and('contain.value', '💬 Reply thread 28');
    cy.get('#raw-output').should('not.contain.value', 'Thread 01 >>>');
    cy.get('#raw-output').should('not.contain.value', 'View thread');

    cy.get('#tab-preview').click();
    cy.get('#preview-output blockquote').should('have.length.greaterThan', 20);

    // Verify the download filename without a download plugin.
    cy.window().then((win) => {
      cy.stub(win.HTMLAnchorElement.prototype, 'click').callsFake(function (
        this: HTMLAnchorElement,
      ) {
        win.document.title = `dl:${this.download}`;
      });
    });
    cy.get('#download').click();
    cy.title().should('eq', 'dl:merged-channel.md');
  });

  it('mode 1 inserts dated headers above usernames after merge (§5.4)', () => {
    cy.visit('/');
    cy.get('input[name="mode"][value="1"]').check();
    cy.get('#channel-file').selectFile('markdown/sample-input.md');
    cy.get('#reply-files').selectFile(REPLY_PATHS);
    cy.get('#run').click();

    // ~30 timestamps detected on the merged text.
    cy.get('#date-table tbody tr').should('have.length.greaterThan', 25);
    cy.get('#date-table tbody tr').eq(0).find('.tick').should('be.checked');
    cy.get('#date-table tbody tr').eq(0).find('.date').type('2025-08-26');
    cy.get('#apply-dates').click();

    cy.get('#raw-output').should('contain.value', '## Tuesday, 26 August 2025');
    cy.get('[data-testid="inserted-ratio"]').should('have.text', '28 / 28');
  });
});
