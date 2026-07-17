const BHR = (() => {
  'use strict';

  const RECEIPTS_KEY = 'bhr_submission_receipts_v3';
  const CONSENT_VERSION = '2026-07-16-v1';

  const banks = [
    'Bank of America, N.A.',
    'JPMorgan Chase Bank, National Association',
    'Capital One, National Association',
    'Capital One Bank (USA), National Association',
    'Wells Fargo Bank, National Association',
    'Citibank, National Association',
    'U.S. Bank National Association',
    'PNC Bank, National Association',
    'Truist Bank',
    'Discover Bank',
    'Other / not sure'
  ];

  const issues = [
    'Credit reporting error',
    'Debt collection not owed',
    'Checking/savings account problem',
    'Account freeze or closure',
    'Unauthorized transfer or scam',
    'Credit card billing/rewards dispute',
    'Mortgage or loan servicing',
    'Identity theft/account takeover',
    'Discrimination/unfair treatment',
    'Other'
  ];

  const remedies = [
    'Refund/reimburse loss',
    'Correct credit reporting',
    'Unfreeze/reopen account',
    'Provide written explanation',
    'Stop collection/negative reporting',
    'Investigate unauthorized transfer',
    'Preserve records',
    'Escalate to executive office',
    'Other'
  ];

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

  function optionHtml(value) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    return option;
  }

  function fillSelects() {
    qsa('[data-banks]').forEach((select) => {
      select.replaceChildren(...banks.map(optionHtml));
    });
    qsa('[data-issues]').forEach((select) => {
      select.replaceChildren(...issues.map(optionHtml));
    });
    qsa('[data-remedies]').forEach((select) => {
      select.replaceChildren(...remedies.map(optionHtml));
    });
  }

  function toast(message, isError = false) {
    const element = qs('#toast');
    if (!element) return;
    element.textContent = message;
    element.dataset.kind = isError ? 'error' : 'success';
    element.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => element.classList.remove('show'), 4200);
  }

  function hasSensitiveNumber(text) {
    return /(\b\d{3}-\d{2}-\d{4}\b)|(\b\d{9}\b)|(\b(?:\d[ -]*?){12,19}\b)/.test(text || '');
  }

  function sensitiveUserText(data) {
    const fields = [
      'name', 'institution', 'issue', 'state', 'amount', 'timeline',
      'evidence', 'story', 'summary', 'remedy', 'credentials', 'area',
      'conflictDisclosure', 'mediaOutlet'
    ];
    return fields.map((field) => data?.[field] || '').join('\n');
  }

  function evidenceScore(data) {
    let score = 0;
    if ((data.timeline || '').trim().length > 10) score += 15;
    if (data.institution) score += 10;
    if (data.issue) score += 10;
    if ((data.amount || '').trim()) score += 10;
    if ((data.evidence || '').trim().length > 15) score += 20;
    if (data.priorContact) score += 10;
    if (data.remedy) score += 15;
    if (!hasSensitiveNumber(sensitiveUserText(data))) score += 10;
    return Math.min(100, score);
  }

  function readReceipts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECEIPTS_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveReceipt(receipt) {
    const receipts = readReceipts();
    receipts.unshift(receipt);
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts.slice(0, 25)));
  }

  function renderReceipts() {
    const receipts = readReceipts();
    qsa('[data-count="reports"]').forEach((element) => {
      element.textContent = String(receipts.length);
    });
    qsa('[data-count="declarations"]').forEach((element) => {
      element.textContent = String(receipts.filter((item) => item.declarationConsent).length);
    });

    const list = qs('#localReports');
    if (!list) return;
    list.replaceChildren();

    if (!receipts.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'No submission receipts saved on this device.';
      list.append(empty);
      return;
    }

    receipts.slice(0, 8).forEach((receipt) => {
      const card = document.createElement('article');
      card.className = 'card receipt-card';

      const heading = document.createElement('strong');
      heading.textContent = receipt.institution || receipt.type || 'Submission';

      const meta = document.createElement('p');
      meta.className = 'muted small';
      meta.textContent = `${receipt.reportId} · ${new Date(receipt.createdAt).toLocaleDateString()}`;

      const score = document.createElement('span');
      score.className = 'tag';
      score.textContent = `Evidence score ${receipt.evidenceScore || 0}/100`;

      card.append(heading, meta, score);
      list.append(card);
    });
  }

  async function loadPublicConfig() {
    try {
      const response = await fetch('/api/public-config', { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const config = await response.json();
      if (!config.turnstileSiteKey) return;

      await loadTurnstileScript();
      qsa('[data-turnstile-slot]').forEach((slot) => {
        if (slot.dataset.rendered === 'true' || !window.turnstile) return;
        window.turnstile.render(slot, {
          sitekey: config.turnstileSiteKey,
          theme: 'dark',
          callback(token) {
            const form = slot.closest('form');
            const field = qs('input[name="turnstileToken"]', form);
            if (field) field.value = token;
          },
          'expired-callback'() {
            const form = slot.closest('form');
            const field = qs('input[name="turnstileToken"]', form);
            if (field) field.value = '';
          }
        });
        slot.dataset.rendered = 'true';
      });
    } catch {
      // The form remains usable when Turnstile is not configured.
    }
  }

  function loadTurnstileScript() {
    return new Promise((resolve, reject) => {
      if (window.turnstile) return resolve();
      const existing = qs('script[data-turnstile-script]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = 'true';
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.append(script);
    });
  }

  function formPayload(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    data.type = form.dataset.type || 'consumer-report';
    data.consentVersion = CONSENT_VERSION;
    data.pageUrl = window.location.href;
    data.evidenceScoreClient = evidenceScore(data);
    return data;
  }

  async function submitForm(form) {
    const button = qs('button[type="submit"]', form);
    const status = qs('[data-form-status]', form);
    const data = formPayload(form);

    if (data.website) {
      form.reset();
      return;
    }

    if (hasSensitiveNumber(sensitiveUserText(data))) {
      toast('Remove SSNs, full account/card numbers, or other long sensitive numbers.', true);
      if (status) status.textContent = 'Submission blocked until sensitive numbers are removed.';
      return;
    }

    if (button) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = 'Submitting securely…';
    }
    if (status) status.textContent = 'Submitting. Do not close this page yet.';

    try {
      const response = await fetch('/api/submit-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      });
      const output = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(output.error || 'Submission failed.');
      }

      saveReceipt({
        reportId: output.reportId,
        type: data.type,
        institution: data.institution || '',
        issue: data.issue || '',
        evidenceScore: output.evidenceScore || data.evidenceScoreClient,
        declarationConsent: data.consentDeclaration === 'on',
        createdAt: new Date().toISOString()
      });

      form.reset();
      renderReceipts();
      toast(`Submitted privately. Receipt: ${output.reportId}`);
      if (status) {
        status.textContent = `Submission received. Save this receipt number: ${output.reportId}.`;
      }
    } catch (error) {
      toast(error.message || 'Submission failed. Your private story was not stored locally.', true);
      if (status) {
        status.textContent = `${error.message || 'Submission failed.'} Your form remains filled so you can retry.`;
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Submit';
      }
    }
  }

  function clearReceipts() {
    localStorage.removeItem(RECEIPTS_KEY);
    renderReceipts();
    toast('Submission receipts cleared from this device.');
  }

  function routeWizard() {
    const issue = qs('#wizardIssue')?.value || '';
    let route = 'Start with the company, CFPB, and a bank-charter regulator lookup.';
    if (/checking|freeze|transfer|scam/i.test(issue)) {
      route = 'Possible route: company escalation + CFPB + OCC/FDIC/Federal Reserve depending charter; FTC/IdentityTheft.gov if fraud or identity theft.';
    } else if (/credit reporting/i.test(issue)) {
      route = 'Possible route: dispute with bureau/furnisher + CFPB; IdentityTheft.gov if identity theft is involved.';
    } else if (/debt/i.test(issue)) {
      route = 'Possible route: collector dispute + CFPB; FTC or state attorney general depending the company and facts.';
    } else if (/mortgage|loan/i.test(issue)) {
      route = 'Possible route: servicer/lender escalation + CFPB + applicable prudential or state regulator.';
    } else if (/discrimination/i.test(issue)) {
      route = 'Possible route: CFPB plus an appropriate federal/state civil-rights or fair-lending channel after fact-specific review.';
    }
    const output = qs('#wizardOutput');
    if (output) output.textContent = route;
  }


  function initDonationLinks() {
    const links = window.BHR_CONFIG?.donationLinks || {};
    qsa('[data-donation-tier]').forEach((element) => {
      const key = element.dataset.donationTier;
      const url = links[key] || '';
      if (url) {
        element.href = url;
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
        element.removeAttribute('aria-disabled');
        element.classList.remove('disabled-link');
      } else {
        element.removeAttribute('href');
        element.setAttribute('aria-disabled', 'true');
        element.classList.add('disabled-link');
        element.textContent = 'Payment link not configured';
      }
    });
  }

  function init() {
    fillSelects();
    renderReceipts();
    routeWizard();
    loadPublicConfig();
    initDonationLinks();

    qsa('form[data-bhr-form]').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submitForm(form);
      });
    });

    qs('#wizardIssue')?.addEventListener('change', routeWizard);
    qs('#clearReceipts')?.addEventListener('click', clearReceipts);
    qs('#copyPacket')?.addEventListener('click', async () => {
      const text = qs('#packetTemplate')?.value || '';
      try {
        await navigator.clipboard.writeText(text);
        toast('Packet template copied.');
      } catch {
        toast('Copy was blocked by this browser.', true);
      }
    });
  }

  return { init, _test: { hasSensitiveNumber, evidenceScore } };
})();

document.addEventListener('DOMContentLoaded', BHR.init);
