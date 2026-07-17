const BHR = (() => {
  'use strict';

  const RECEIPTS_KEY = 'bhr_submission_receipts_v4';
  const CONSENT_VERSION = '2026-07-17-v2';
  const banks = ['Bank of America, N.A.','JPMorgan Chase Bank, National Association','Capital One, National Association','Wells Fargo Bank, National Association','Citibank, National Association','U.S. Bank National Association','PNC Bank, National Association','Truist Bank','Discover Bank','Credit union','Other / not sure'];
  const issues = ['Credit reporting error','Debt collection not owed','Checking/savings account problem','Account freeze or closure','Unauthorized transfer or scam','Credit card billing/rewards dispute','Mortgage or loan servicing','Identity theft/account takeover','Discrimination/unfair treatment','Other'];
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

  function optionNode(value) { const option = document.createElement('option'); option.value = value; option.textContent = value; return option; }
  function fillSelects() {
    qsa('[data-banks]').forEach((select) => select.replaceChildren(optionNode(''), ...banks.map(optionNode)));
    qsa('[data-issues]').forEach((select) => select.replaceChildren(optionNode(''), ...issues.map(optionNode)));
  }
  function toast(message, isError = false) {
    const element = qs('#toast'); if (!element) return;
    element.textContent = message; element.dataset.kind = isError ? 'error' : 'success'; element.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 4500);
  }
  function hasSensitiveNumber(text) {
    return /(\b\d{3}-\d{2}-\d{4}\b)|(\b\d{9}\b)|(\b(?:\d[ -]*?){12,19}\b)|\b(?:account|acct|routing|card)\s*(?:number|no\.?|#)?\s*[:=-]?\s*\d{6,19}\b/i.test(text || '');
  }
  function sensitiveUserText(data) {
    return ['name','institution','issue','category','state','amount','timeline','evidence','story','summary','remedy','credentials','area','conflictDisclosure','mediaOutlet'].map((field) => data?.[field] || '').join('\n');
  }
  function readReceipts() {
    try { const parsed = JSON.parse(localStorage.getItem(RECEIPTS_KEY) || '[]'); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  function saveReceipt(receipt) {
    const safeReceipt = {
      reportId: String(receipt.reportId || ''),
      createdAt: String(receipt.createdAt || ''),
      type: String(receipt.type || ''),
      institution: String(receipt.institution || ''),
      category: String(receipt.category || ''),
      state: String(receipt.state || ''),
      evidenceScore: Number(receipt.evidenceScore || 0),
      remedyScore: Number(receipt.remedyScore || 0),
      supportMatchReadinessScore: Number(receipt.supportMatchReadinessScore || 0),
      riskFlags: Array.isArray(receipt.riskFlags) ? receipt.riskFlags.slice(0, 12).map(String) : [],
      consentMatrix: receipt.consentMatrix && typeof receipt.consentMatrix === 'object' ? {
        contact: Boolean(receipt.consentMatrix.contact),
        publicSummary: Boolean(receipt.consentMatrix.publicSummary),
        attorneyContact: Boolean(receipt.consentMatrix.attorneyContact),
        journalistContact: Boolean(receipt.consentMatrix.journalistContact),
        declarationSupport: Boolean(receipt.consentMatrix.declarationSupport),
        consumerSupportMatching: Boolean(receipt.consentMatrix.consumerSupportMatching)
      } : {},
      status: String(receipt.status || 'new-intake')
    };
    const receipts = readReceipts(); receipts.unshift(safeReceipt);
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts.slice(0, 25)));
  }
  function renderReceipts() {
    const receipts = readReceipts(); const list = qs('#localReports'); if (!list) return;
    list.replaceChildren();
    if (!receipts.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'No safe submission receipts saved on this device.'; list.append(p); return; }
    receipts.slice(0, 8).forEach((r) => {
      const card = document.createElement('article'); card.className = 'card receipt-card';
      const title = document.createElement('strong'); title.textContent = r.institution || r.type || 'Submission';
      const meta = document.createElement('p'); meta.className = 'muted small'; meta.textContent = `${r.reportId} · ${new Date(r.createdAt).toLocaleDateString()} · ${r.status}`;
      const scores = document.createElement('div'); scores.className = 'kpi';
      [ `Evidence ${r.evidenceScore}/100`, `Remedy ${r.remedyScore}/100`, `Support ${r.supportMatchReadinessScore}/100` ].forEach((text) => { const span = document.createElement('span'); span.className = 'tag'; span.textContent = text; scores.append(span); });
      card.append(title, meta, scores); list.append(card);
    });
  }
  function formPayload(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    data.type = form.dataset.type || 'consumer-report'; data.consentVersion = CONSENT_VERSION; data.pageUrl = location.href;
    return data;
  }
  async function loadPublicConfig() {
    try {
      const response = await fetch('/api/public-config', { headers: { Accept: 'application/json' } }); if (!response.ok) return;
      const config = await response.json(); if (!config.turnstileSiteKey) return;
      await new Promise((resolve, reject) => { if (window.turnstile) return resolve(); const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.defer = true; script.onload = resolve; script.onerror = reject; document.head.append(script); });
      qsa('[data-turnstile-slot]').forEach((slot) => { if (!window.turnstile || slot.dataset.rendered) return; window.turnstile.render(slot, { sitekey: config.turnstileSiteKey, theme: 'dark', callback(token) { const field = qs('[name="turnstileToken"]', slot.closest('form')); if (field) field.value = token; } }); slot.dataset.rendered = 'true'; });
    } catch { /* Optional unless TURNSTILE_REQUIRED is enforced server-side. */ }
  }
  function initWizard(form) {
    const steps = qsa('[data-step]', form); if (!steps.length) return;
    let current = 0; const next = qs('[data-wizard-next]', form); const back = qs('[data-wizard-back]', form); const submit = qs('[data-wizard-submit]', form); const progress = qs('#wizardProgress'); const bar = qs('[data-progress-bar]');
    function show() { steps.forEach((step, i) => { step.hidden = i !== current; }); if (back) back.hidden = current === 0; if (next) next.hidden = current === steps.length - 1; if (submit) submit.hidden = current !== steps.length - 1; if (progress) progress.textContent = `Step ${current + 1} of ${steps.length}`; if (bar) bar.style.width = `${((current + 1) / steps.length) * 100}%`; }
    function validStep() { const fields = qsa('input,select,textarea', steps[current]).filter((field) => !field.disabled && field.type !== 'hidden'); for (const field of fields) { if (!field.checkValidity()) { field.reportValidity(); return false; } } return true; }
    next?.addEventListener('click', () => { if (validStep()) { current = Math.min(steps.length - 1, current + 1); show(); } });
    back?.addEventListener('click', () => { current = Math.max(0, current - 1); show(); });
    show();
  }
  async function submitForm(form) {
    const button = qs('[data-wizard-submit],button[type="submit"]', form); const status = qs('[data-form-status]', form); const data = formPayload(form);
    if (data.website) { form.reset(); return; }
    if (hasSensitiveNumber(sensitiveUserText(data))) { toast('Remove SSNs, account/card numbers, or other long sensitive identifiers.', true); if (status) status.textContent = 'Submission blocked until sensitive identifiers are removed.'; return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = 'Submitting securely…'; }
    if (status) status.textContent = 'Submitting. Do not close this page yet.';
    try {
      const response = await fetch('/api/submit-report', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
      const output = await response.json().catch(() => ({})); if (!response.ok) throw new Error(output.error || 'Submission failed.');
      saveReceipt({
        reportId: output.reportId, createdAt: output.createdAt, type: data.type,
        institution: data.institution, category: data.category, state: data.state,
        evidenceScore: output.evidenceScore, remedyScore: output.remedyScore,
        supportMatchReadinessScore: output.supportMatchReadinessScore,
        riskFlags: output.riskFlags, consentMatrix: output.consentMatrix, status: output.status
      });
      form.reset(); renderReceipts(); toast(`Private intake accepted. Receipt: ${output.reportId}`);
      if (status) status.textContent = `Accepted. Save receipt ${output.reportId}. No public posting occurred.`;
    } catch (error) { toast(error.message || 'Submission failed. Your story was not stored locally.', true); if (status) status.textContent = `${error.message || 'Submission failed.'} Your form remains filled so you can retry.`; }
    finally { if (button) { button.disabled = false; button.textContent = button.dataset.originalText || 'Build My Evidence Packet'; } }
  }
  function routeWizard() {
    const issue = qs('#wizardIssue')?.value || ''; let route = 'Start with the company and CFPB, then verify the institution charter before choosing OCC, FDIC, Federal Reserve, NCUA, or a state regulator.';
    if (/credit reporting/i.test(issue)) route = 'Likely route: dispute with the bureau/furnisher, CFPB, and IdentityTheft.gov if identity theft is involved.';
    else if (/debt collection/i.test(issue)) route = 'Likely route: collector dispute, CFPB, and possibly the FTC or state attorney general.';
    else if (/identity theft|unauthorized|scam/i.test(issue)) route = 'Likely route: company fraud escalation, CFPB, IdentityTheft.gov/FTC, and the appropriate bank regulator after charter review.';
    else if (/mortgage|loan/i.test(issue)) route = 'Likely route: servicer or lender escalation, CFPB, and the applicable prudential or state regulator.';
    const output = qs('#wizardOutput'); if (output) output.textContent = route;
  }
  function init() {
    fillSelects(); renderReceipts(); routeWizard(); loadPublicConfig();
    qsa('form[data-bhr-form]').forEach((form) => { initWizard(form); form.addEventListener('submit', (event) => { event.preventDefault(); submitForm(form); }); });
    qs('#wizardIssue')?.addEventListener('change', routeWizard);
  }
  return { init, _test: { hasSensitiveNumber, readReceipts } };
})();
document.addEventListener('DOMContentLoaded', BHR.init);
