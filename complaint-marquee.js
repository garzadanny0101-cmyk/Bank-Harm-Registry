(() => {
  'use strict';

  const shell = document.querySelector('[data-complaint-marquee]');
  if (!shell) return;

  const lanes = [...shell.querySelectorAll('[data-lane]')];

  function safe(value, fallback = 'Not listed') {
    const text = String(value || '').trim();
    return text || fallback;
  }

  function cardMarkup(item) {
    const article = document.createElement('article');
    article.className = 'complaint-card';
    article.tabIndex = 0;

    const top = document.createElement('div');
    top.className = 'complaint-card-top';

    const badge = document.createElement('span');
    badge.className = 'complaint-source-badge';
    badge.textContent = 'CFPB complaint';

    const id = document.createElement('span');
    id.className = 'complaint-id';
    id.textContent = item.complaintId ? `#${item.complaintId}` : 'Public record';

    top.append(badge,id);

    const company = document.createElement('h3');
    company.textContent = safe(item.company, 'Financial company');

    const issue = document.createElement('p');
    issue.className = 'complaint-issue';
    issue.textContent = safe(item.issue, 'Consumer-reported issue');

    const meta = document.createElement('div');
    meta.className = 'complaint-meta';
    const product = document.createElement('span');
    product.textContent = safe(item.product, 'Financial product');
    const state = document.createElement('span');
    state.textContent = safe(item.state, 'US');
    const date = document.createElement('span');
    date.textContent = safe(item.dateReceived, 'Recent');
    meta.append(product,state,date);

    const response = document.createElement('div');
    response.className = 'complaint-response';
    response.innerHTML = '<span>Company response</span>';
    const responseValue = document.createElement('strong');
    responseValue.textContent = safe(item.companyResponse, 'Not listed');
    response.append(responseValue);

    article.append(top,company,issue,meta,response);
    return article;
  }

  function fallbackCard() {
    const article = document.createElement('article');
    article.className = 'complaint-card complaint-card-fallback';
    const badge = document.createElement('span');
    badge.className = 'complaint-source-badge';
    badge.textContent = 'CFPB public data';
    const title = document.createElement('h3');
    title.textContent = 'Live complaint feed unavailable';
    const body = document.createElement('p');
    body.className = 'complaint-issue';
    body.textContent = 'Open the official CFPB Consumer Complaint Database to explore current complaint data.';
    const link = document.createElement('a');
    link.href = 'https://www.consumerfinance.gov/data-research/consumer-complaints/';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'text-action';
    link.textContent = 'Open CFPB database';
    article.append(badge,title,body,link);
    return article;
  }

  function fill(items) {
    lanes.forEach((lane, laneIndex) => {
      lane.replaceChildren();
      const slice = items.filter((_, index) => index % lanes.length === laneIndex).slice(0, 8);
      const source = slice.length ? slice : items.slice(0, 6);

      if (!source.length) {
        lane.append(fallbackCard());
        return;
      }

      // Two identical groups create a seamless vertical loop without fake records.
      for (let repeat = 0; repeat < 2; repeat += 1) {
        const group = document.createElement('div');
        group.className = 'complaint-lane-group';
        source.forEach((item) => group.append(cardMarkup(item)));
        lane.append(group);
      }
    });
  }

  async function load() {
    shell.classList.add('is-loading');
    try {
      const response = await fetch('/api/cfpb-signals?size=30', {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('CFPB feed unavailable');
      const payload = await response.json();
      if (!payload?.ok || !Array.isArray(payload.items)) throw new Error('Invalid CFPB response');
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