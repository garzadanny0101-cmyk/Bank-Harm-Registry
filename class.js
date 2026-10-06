/* Config-driven class page. No payment processing, intake, or storage. */
(() => {
  'use strict';

  function httpsUrl(value, hosts) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
      if (hosts && !hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return '';
      return url.href;
    } catch { return ''; }
  }

  function localAsset(value, extensions, origin) {
    if (typeof value !== 'string' || !value || /[?#\\]/.test(value)) return '';
    try {
      const url = new URL(value, origin);
      if (url.origin !== new URL(origin).origin || !url.pathname.startsWith('/assets/')) return '';
      if (!extensions.some((extension) => url.pathname.toLowerCase().endsWith(extension))) return '';
      return url.href;
    } catch { return ''; }
  }

  function eventDateLabel(value, timeZone) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'full', timeStyle: 'short', timeZone
      }).format(date) + ` (${timeZone})`;
    } catch { return ''; }
  }

  function validConfig(config) {
    const fields = ['donationAmount', 'portfolioAddOnAmount', 'minimumConfirmed', 'targetConfirmed', 'plannedDurationHours', 'maximumDurationHours'];
    return config && fields.every((field) => Number.isFinite(config[field]) && config[field] > 0)
      && Number.isInteger(config.minimumConfirmed) && Number.isInteger(config.targetConfirmed)
      && config.minimumConfirmed <= config.targetConfirmed
      && config.plannedDurationHours <= config.maximumDurationHours;
  }

  const helpers = { httpsUrl, localAsset, eventDateLabel, validConfig };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (typeof document === 'undefined') return;

  const config = window.BHR_CONFIG?.classEvent;
  const all = (selector) => [...document.querySelectorAll(selector)];
  if (!validConfig(config)) {
    all('.class-facts,.cohort-strip,.portfolio-price,.portfolio-note,.class-details,.access-steps').forEach((element) => { element.hidden = true; });
    const message = document.createElement('p');
    message.className = 'notice';
    message.textContent = 'Class registration details are unavailable. Please check back before donating.';
    document.querySelector('.class-cta-group').replaceChildren(message);
    return;
  }

  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const money = (amount) => Number.isInteger(amount) ? `$${amount}` : currency.format(amount);
  all('[data-class]').forEach((element) => {
    const value = config[element.dataset.class];
    if (typeof value === 'number') element.textContent = element.hasAttribute('data-money') ? money(value) : String(value);
  });

  function externalLink(element, url) {
    element.href = url;
    element.target = '_blank';
    element.rel = 'noopener noreferrer';
    element.hidden = false;
  }

  const cashAppUrl = httpsUrl(config.cashAppUrl, ['cash.app']);
  if (cashAppUrl && new URL(cashAppUrl).hostname === 'cash.app' && /^\/\$[a-z0-9]+$/i.test(new URL(cashAppUrl).pathname)) {
    all('[data-class-cta]').forEach((element) => {
      element.textContent = element.hasAttribute('data-compact')
        ? `RESERVE ACCESS — ${money(config.donationAmount)}`
        : `DONATE ${money(config.donationAmount)} — RESERVE MY CLASS ACCESS`;
      externalLink(element, cashAppUrl);
      element.setAttribute('aria-label', `${element.textContent} (opens Cash App in a new tab)`);
    });
    document.getElementById('class-sticky').hidden = false;
    document.body.classList.add('has-class-cta');
  }

  const date = eventDateLabel(config.eventDate, config.eventTimeZone);
  all('[data-class-date]').forEach((element) => { element.textContent = date || 'Date to be announced'; });
  if (typeof config.cohortPolicy === 'string' && config.cohortPolicy.trim()) {
    document.getElementById('cohort-policy').textContent = config.cohortPolicy.trim();
  }

  if (typeof config.contactEmail === 'string' && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(config.contactEmail)) {
    all('[data-contact-link]').forEach((element) => {
      element.href = `mailto:${encodeURIComponent(config.contactEmail)}?subject=Consumer%20Rights%20Evidence%20Class`;
      element.textContent = config.contactEmail;
    });
  }
  const telegramUrl = httpsUrl(config.telegramUrl, ['t.me', 'telegram.me']);
  if (telegramUrl && new URL(telegramUrl).pathname !== '/') {
    externalLink(document.getElementById('telegram-link'), telegramUrl);
    document.getElementById('telegram-help').hidden = false;
  }

  const tiktokCandidate = httpsUrl(config.tiktokProofUrl, ['tiktok.com']);
  const tiktokUrl = tiktokCandidate && new URL(tiktokCandidate).pathname !== '/' ? tiktokCandidate : '';
  if (tiktokUrl) externalLink(document.getElementById('tiktok-proof'), tiktokUrl);
  const proofGrid = document.getElementById('proof-grid');
  const proofLink = document.querySelector('[data-proof-link]');
  const principles = document.getElementById('evidence-principles');

  function updateProofVisibility() {
    const hasCards = [...proofGrid.children].some((card) => !card.hidden);
    proofGrid.hidden = !hasCards;
    principles.hidden = hasCards;
    proofLink.hidden = !hasCards && !tiktokUrl;
    if (hasCards) {
      proofLink.href = '#proof';
      document.getElementById('proof-title').textContent = 'See the record. Then learn the framework.';
    } else if (tiktokUrl) {
      externalLink(proofLink, tiktokUrl);
    } else {
      proofLink.removeAttribute('href');
      document.getElementById('proof-title').textContent = 'The record comes before the claim.';
    }
  }

  function videoElement(item) {
    if (!item || typeof item !== 'object') return null;
    const src = localAsset(item.src, ['.mp4', '.webm'], window.location.origin);
    const captions = localAsset(item.captions, ['.vtt'], window.location.origin);
    const transcript = localAsset(item.transcript, ['.txt'], window.location.origin);
    if (!src || !captions || !transcript) return null;
    const video = document.createElement('video');
    video.controls = true;
    video.preload = 'none';
    video.playsInline = true;
    video.src = src;
    video.setAttribute('aria-label', item.title || 'Class evidence video');
    const poster = localAsset(item.poster, ['.jpg', '.jpeg', '.png', '.webp', '.avif'], window.location.origin);
    if (poster) video.poster = poster;
    const track = document.createElement('track');
    track.kind = 'captions';
    track.srclang = 'en';
    track.label = 'English';
    track.src = captions;
    track.default = true;
    video.append(track);
    const link = document.createElement('a');
    link.className = 'text-action';
    link.href = transcript;
    link.textContent = 'Read the video transcript';
    return { video, link };
  }

  const proofItems = Array.isArray(config.proofItems) ? config.proofItems : [];
  for (const item of proofItems) {
    if (!item || item.reviewed !== true || typeof item.title !== 'string' || !item.title.trim() || typeof item.summary !== 'string' || !item.summary.trim()) continue;
    const sourceUrl = httpsUrl(item.sourceUrl) || localAsset(item.sourceUrl, ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.pdf'], window.location.origin);
    if (!sourceUrl) continue;
    const card = document.getElementById('proof-card-template').content.firstElementChild.cloneNode(true);
    card.querySelector('h3').textContent = item.title;
    card.querySelector('.eyebrow').textContent = item.category || 'Documented example';
    card.querySelector('.proof-summary').textContent = item.summary;
    externalLink(card.querySelector('a'), sourceUrl);
    const media = card.querySelector('.proof-media');
    const image = item.image;
    const imageUrl = localAsset(image?.src, ['.jpg', '.jpeg', '.png', '.webp', '.avif'], window.location.origin);
    if (imageUrl && typeof image.alt === 'string' && image.alt.trim() && Number.isInteger(image.width) && image.width > 0 && Number.isInteger(image.height) && image.height > 0) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = image.alt;
      img.width = image.width;
      img.height = image.height;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => { card.hidden = true; updateProofVisibility(); }, { once: true });
      media.append(img);
    } else if (item.video) {
      const mediaParts = videoElement(item.video);
      if (!mediaParts) continue;
      mediaParts.video.addEventListener('error', () => { card.hidden = true; updateProofVisibility(); }, { once: true });
      media.append(mediaParts.video, mediaParts.link);
    } else {
      media.hidden = true;
    }
    proofGrid.append(card);
  }
  updateProofVisibility();
  if (!proofGrid.hidden) {
    document.getElementById('proof-intro').textContent = 'Selected screenshots supplied by the organizer. These individual records are not independently authenticated or a promise of results from attending the class.';
  }

  const preview = videoElement(config.previewVideo);
  if (preview) {
    const container = document.getElementById('preview-media');
    container.append(preview.video, preview.link);
    container.hidden = false;
    document.getElementById('preview-art').hidden = true;
    preview.video.addEventListener('error', () => {
      container.hidden = true;
      document.getElementById('preview-art').hidden = false;
    }, { once: true });
  }
})();
