(() => {
  'use strict';

  const shell = document.querySelector('[data-complaint-marquee]');
  if (!shell) return;

  const lanes = [...shell.querySelectorAll('[data-lane]')];

  function clean(value, fallback = 'Not listed') {
    const text = String(value || '').trim();
    return text || fallback;
  }

  function formatDate(value) {
    if (!value) return 'Recent';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return clean(value, 'Recent');
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function field(label, value) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cfpb-paper-field';

    const key = document.createElement('span');
    key.textContent = label;

    const val = document.createElement('strong');
    val.textContent = clean(value);

    wrapper.append(key, val);
    return wrapper;
  }

  function cardMarkup(item, accessible = true) {
    const article = document.createElement('article');
    article.className = 'complaint-card cfpb-paper-card';
    article.tabIndex = accessible ? 0 : -1;

    const source = document.createElement('div');
    source.className = 'cfpb-paper-source';

    const sourceMark = document.createElement('span');
    sourceMark.className = 'cfpb-paper-mark';
    sourceMark.textContent = 'CFPB';

    const sourceName = document.createElement('span');
    sourceName.className = 'cfpb-paper-source-name';
    sourceName.textContent = 'Consumer complaint public data';

    source.append(sourceMark, sourceName);

    const greenRule = document.createElement('div');
    greenRule.className = 'cfpb-paper-rule';
    greenRule.setAttribute('aria-hidden', 'true');

    const head = document.createElement('div');
    head.className = 'cfpb-paper-head';

    const complaint = document.createElement('div');
    complaint.className = 'cfpb-paper-complaint';
    const idLabel = document.createElement('span');
    idLabel.textContent = 'COMPLAINT';
    const idValue = document.createElement('strong');
    idValue.textContent = item.complaintId ? `#${item.complaintId}` : 'Public record';
    complaint.append(idLabel, idValue);

    const status = document.createElement('span');
    status.className = 'cfpb-paper-status';
    status.textContent = 'Published record';

    head.append(complaint, status);

    const company = document.createElement('h3');
    company.textContent = clean(item.company, 'Financial company');

    const fieldGrid = document.createElement('div');
    fieldGrid.className = 'cfpb-paper-fields';
    fieldGrid.append(
      field('PRODUCT', item.product),
      field('ISSUE', item.issue),
      field('STATE', item.state),
      field('RECEIVED', formatDate(item.dateReceived))
    );

    const response = document.createElement('div');
    response.className = 'cfpb-paper-response';
    const responseLabel = document.createElement('span');
    responseLabel.textContent = 'COMPANY RESPONSE';
    const responseValue = document.createElement('strong');
    responseValue.textContent = clean(item.companyResponse, 'Not listed');
    response.append(responseLabel, responseValue);

    const footer = document.createElement('div');
    footer.className = 'cfpb-paper-footer';
    footer.textContent = 'Public data preview • Source: consumerfinance.gov';

    article.append(source, greenRule, head, company, fieldGrid, response, footer);
    return article;
  }

  function fallbackCard() {
    const article = document.createElement('article');
    article.className = 'complaint-card cfpb-paper-card complaint-card-fallback';

    const source = document.createElement('div');
    source.className = 'cfpb-paper-source';

    const sourceMark = document.createElement('span');
    sourceMark.className = 'cfpb-paper-mark';
    sourceMark.textContent = 'CFPB';

    const sourceName = document.createElement('span');
    sourceName.className = 'cfpb-paper-source-name';
    sourceName.textContent = 'Consumer complaint public data';
    source.append(sourceMark, sourceName);

    const greenRule = document.createElement('div');
    greenRule.className = 'cfpb-paper-rule';

    const title = document.createElement('h3');
    title.textContent = 'Live complaint feed unavailable';

    const body = document.createElement('p');
    body.className = 'cfpb-paper-fallback-copy';
    body.textContent = 'Use the official CFPB Consumer Complaint Database for current records.';

    const link = document.createElement('a');
    link.href = 'https://www.consumerfinance.gov/data-research/consumer-complaints/';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'cfpb-paper-link';
    link.textContent = 'Open official CFPB database';

    article.append(source, greenRule, title, body, link);
    return article;
  }

  function buildLane(items, laneIndex) {
    const lane = lanes[laneIndex];
    if (!lane) return;
    lane.replaceChildren();

    const laneItems = items.filter((_, index) => index % lanes.length === laneIndex);
    const source = laneItems.length ? laneItems : items;

    if (!source.length) {
      lane.append(fallbackCard());
      return;
    }

    // Three repeated groups keep the entire viewport filled while the columns move.
    for (let repeat = 0; repeat < 3; repeat += 1) {
      const group = document.createElement('div');
      group.className = 'complaint-lane-group';
      const accessible = repeat === 0;
      if (!accessible) group.setAttribute('aria-hidden', 'true');
      source.slice(0, 7).forEach((item) => group.append(cardMarkup(item, accessible)));
      lane.append(group);
    }
  }

  function fill(items) {
    lanes.forEach((_, laneIndex) => buildLane(items, laneIndex));
  }

  async function load() {
    shell.classList.add('is-loading');

    try {
      const response = await fetch('/api/cfpb-signals?size=30', {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('CFPB feed unavailable');

      const payload = await response.json();
      if (!payload?.ok || !Array.isArray(payload.items)) {
        throw new Error('Invalid CFPB response');
      }

      fill(payload.items);
      shell.dataset.lastUpdated = payload.lastUpdated || '';
    } catch {
      fill([]);
      shell.classList.add('has-fallback');
    } finally {
      shell.classList.remove('is-loading');
    }
  }

  load();
})();