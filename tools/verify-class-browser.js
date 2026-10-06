/* Dependency-free Chromium QA. Uses a fresh local headless profile, never your browser profile. */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.qa');
const base = process.env.CLASS_PREVIEW_URL || 'http://127.0.0.1:4173';
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = path.join(out, `chrome-${process.pid}`);
fs.mkdirSync(profile, { recursive: true });
const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let browserError;
child.on('error', (error) => { browserError = error; });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws;
let seq = 0;
let sessionId;
const pending = new Map();
const errors = [];
const report = { viewports: [], checks: [], errors };
function send(method, params = {}, session = sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }));
  });
}
async function evaluate(expression) {
  const output = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (output.exceptionDetails) throw new Error(output.exceptionDetails.text);
  return output.result.value;
}
async function load() {
  await send('Page.navigate', { url: `${base}/class/` });
  for (let i = 0; i < 100; i++) {
    if (await evaluate("document.readyState === 'complete' && !!document.querySelector('.has-class-cta')")) break;
    await pause(50);
  }
  await evaluate("Promise.all([...document.images].map(img => { img.loading = 'eager'; return img.decode().catch(() => {}); }))");
  await evaluate('document.fonts.ready.then(() => true)');
}
async function capture(name, fullPage = false) {
  const { cssContentSize } = await send('Page.getLayoutMetrics');
  const options = fullPage ? { captureBeyondViewport: true, clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 } } : {};
  const result = await send('Page.captureScreenshot', { format: 'png', ...options });
  fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(result.data, 'base64'));
}
async function main() {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) { if (browserError) throw browserError; await pause(100); }
  assert(fs.existsSync(portFile), 'Chrome did not start its test debugging endpoint');
  const [port, endpoint] = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
  ws = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(String(data));
    if (pending.has(message.id)) {
      const request = pending.get(message.id); pending.delete(message.id); clearTimeout(request.timer);
      if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }, null));
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  for (const [width, height, name] of [[1440, 1000, 'desktop'], [390, 844, 'mobile'], [320, 740, 'small-mobile']]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 760 });
    await load();
    const state = await evaluate(`(() => {
      const visible = e => !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
      const ctas = [...document.querySelectorAll('[data-class-cta]')].filter(visible);
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        ctas: ctas.map(e => ({ text: e.textContent, href: e.href, rel: e.rel, height: e.getBoundingClientRect().height })),
        imageFailures: [...document.images].filter(e => !e.complete || !e.naturalWidth).map(e => e.src),
        visibleProof: [...document.querySelectorAll('.proof-card')].filter(visible).length,
        telegramHidden: document.querySelector('#telegram-help').hidden,
        tiktokHidden: document.querySelector('#tiktok-proof').hidden,
        emptyLinks: [...document.querySelectorAll('a')].filter(e => visible(e) && !e.getAttribute('href')).map(e => e.textContent),
        bottomPadding: parseFloat(getComputedStyle(document.body).paddingBottom),
        stickyHeight: document.querySelector('#class-sticky').getBoundingClientRect().height,
        hasPlaceholder: /(?:lorem ipsum|coming soon|placeholder)/i.test(document.body.innerText)
      };
    })()`);
    if (state.scrollWidth > width) console.error(await evaluate(`Array.from(document.querySelectorAll('body *')).filter(e => e.getClientRects().length && e.getBoundingClientRect().right > ${width}+1).map(e => ({tag: e.tagName, class: e.className, right: e.getBoundingClientRect().right})).slice(0,12)`));
    assert(state.scrollWidth <= width, `${name}: horizontal overflow (${state.scrollWidth} > ${width})`);
    assert.equal(state.imageFailures.length, 0, `${name}: failed images`);
    assert.equal(state.visibleProof, 3);
    assert.equal(state.emptyLinks.length, 0);
    assert(!state.hasPlaceholder);
    assert(state.telegramHidden && state.tiktokHidden);
    for (const cta of state.ctas) { assert.equal(cta.href, 'https://cash.app/$dginktattoos'); assert(cta.rel.includes('noopener')); assert(cta.height >= 44); }
    if (width < 760) assert(state.bottomPadding >= state.stickyHeight);
    report.viewports.push({ name, ...state });
    await capture(`${name}-hero`);
    if (width !== 320) await capture(`${name}-full`, true);
    if (width !== 320) {
      for (const section of ['proof', 'portfolio']) {
        const clip = await evaluate(`(() => { const r = document.getElementById('${section}').getBoundingClientRect(); return {x: 0, y: r.top + scrollY, width: ${width}, height: r.height, scale: 1}; })()`);
        const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
        fs.writeFileSync(path.join(out, `${name}-${section}.png`), Buffer.from(screenshot.data, 'base64'));
      }
    }
    await evaluate("document.querySelector('.portfolio-contents').open = true");
    assert.equal(await evaluate("document.querySelectorAll('.document-list li').length"), 13);
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await load();
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert(await evaluate("document.activeElement.classList.contains('skip-link')"), 'skip link is first keyboard stop');
  report.checks.push('Keyboard: first Tab reaches skip link');
  await evaluate("document.querySelector('.portfolio-contents').open = false; document.querySelector('.portfolio-contents summary').focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert(await evaluate("document.querySelector('.portfolio-contents').open"));
  report.checks.push('Keyboard: Enter opens document portfolio');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert(await evaluate("[...document.getAnimations()].every(a => a.playState !== 'running' || a.effect.getTiming().duration <= 1)"));
  report.checks.push('Reduced motion: no ongoing long animations');
  const hrefs = await evaluate("[...new Set([...document.querySelectorAll('a[href],link[href],script[src],img[src]')].map(e => e.href || e.src).filter(u => u.startsWith(location.origin)))].filter(u => !new URL(u).hash)");
  for (const href of hrefs) { const response = await fetch(href); assert(response.ok, `Broken local resource: ${href}`); }
  report.checks.push(`Local links/assets: ${hrefs.length} destinations returned OK`);
  const redirect = await fetch(`${base}/class.html`, { redirect: 'manual' });
  assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/class/');
  report.checks.push('Local routing: /class/ returns page; /class.html redirects to /class/');
  assert.equal(errors.length, 0, 'Browser errors');
  fs.writeFileSync(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: 'PASS', viewports: report.viewports.map(v => v.name), checks: report.checks, errors, screenshots: '.qa/' }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (ws?.readyState === WebSocket.OPEN) { try { await send('Browser.close', {}, null); } catch {} ws.close(); }
  child.kill();
});
