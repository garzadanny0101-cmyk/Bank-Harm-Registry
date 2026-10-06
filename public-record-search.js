(() => {
  'use strict';

  const form = document.getElementById('publicRecordSearch');
  const input = document.getElementById('publicSearchInput');
  if (!form || !input) return;

  const intentTerms = [
    '"enforcement action"',
    '"consent order"',
    '"civil money penalty"',
    '"consumer redress"',
    'complaint',
    'settlement'
  ];

  function selectedSources() {
    const selected = [...form.querySelectorAll('input[name="sources"]:checked')]
      .map((el) => el.value)
      .filter(Boolean);
    return selected.length ? selected : ['consumerfinance.gov', 'occ.gov', 'fdic.gov', 'federalreserve.gov'];
  }

  function quoteTerm(value) {
    const clean = value.replace(/[“”"]/g, '').trim();
    return clean.includes(' ') ? `"${clean}"` : clean;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const term = input.value.trim();
    if (!term) {
      input.focus();
      return;
    }

    const sourceQuery = selectedSources().map((domain) => `site:${domain}`).join(' OR ');
    const intentQuery = intentTerms.join(' OR ');
    const query = `${quoteTerm(term)} (${sourceQuery}) (${intentQuery})`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
})();
