(() => {
  'use strict';

  const form = document.getElementById('cfpbFilterForm');
  const results = document.getElementById('cfpbResults');
  const totalEl = document.getElementById('cfpbTotal');
  const updatedEl = document.getElementById('cfpbUpdated');

  if (!form || !results || !totalEl || !updatedEl) return;

  const number = new Intl.NumberFormat('en-US');

  function text(value, fallback = 'Not listed') {
    const out = String(value || '').trim();
    return out || fallback;
  }

  function safeDate(value) {
    if (!value) return 'Not listed';
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function makeCard(item) {
    const card = document.createElement('article');
    card.className = 'cfpb-result-card';

    const title = document.createElement('h3');
    title.textContent = text(item.company, 'Financial company');

    const issue = document.createElement('p');
    issue.textContent = text(item.issue, 'Consumer-reported issue');

    const meta = document.createElement('div');
    meta.className = 'cfpb-result-meta';
    [
      text(item.product, 'Product not listed'),
      text(item.state, 'State not listed'),
      safeDate(item.dateReceived)
    ].forEach((value) => {
      const span = document.createElement('span');
      span.textContent = value;
      meta.appendChild(span);
    });

    card.append(title, issue, meta);
    return card;
  }

  function setLoading() {
    totalEl.textContent = 'Loading...';
    updatedEl.textContent = 'Checking...';
    results.replaceChildren();
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Loading CFPB public records...';
    results.appendChild(p);
  }

  function setError(message) {
    totalEl.textContent = 'Unavailable';
    updatedEl.textContent = 'Try again';
    results.replaceChildren();
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = message || 'The CFPB data source is temporarily unavailable.';
    results.appendChild(p);
  }

  async function load() {
    setLoading();
    const data = new FormData(form);
    const params = new URLSearchParams({ size: '6' });

    for (const key of ['company','product','issue','state','dateMin','dateMax']) {
      const value = String(data.get(key) || '').trim();
      if (value) params.set(key, key === 'state' ? value.toUpperCase() : value);
    }

    try {
      const response = await fetch(`/api/cfpb-signals?${params.toString()}`, {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('CFPB request failed');
      const payload = await response.json();
      if (!payload?.ok) throw new Error(payload?.error || 'CFPB request failed');

      totalEl.textContent = number.format(Number(payload.total || 0));
      updatedEl.textContent = payload.lastUpdated
        ? new Date(payload.lastUpdated).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : 'Current public data';

      results.replaceChildren();
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = 'No published CFPB complaints matched those filters. Try fewer filters or a broader company name.';
        results.appendChild(p);
        return;
      }
      items.slice(0, 6).forEach((item) => results.appendChild(makeCard(item)));
    } catch {
      setError('The live CFPB feed is temporarily unavailable. You can still use the official CFPB database from the Resources page.');
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    load();
  });

  load();
})();