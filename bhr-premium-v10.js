(() => {
  'use strict';

  // Pointer spotlight / low-cost glow coordinates.
  document.querySelectorAll('.premium-spotlight,[data-glow-card]').forEach((el) => {
    el.addEventListener('pointermove', (event) => {
      const r = el.getBoundingClientRect();
      const x = event.clientX - r.left; const y = event.clientY - r.top;
      el.style.setProperty('--spot-x', `${x}px`); el.style.setProperty('--spot-y', `${y}px`);
      el.style.setProperty('--glow-x', `${x}px`); el.style.setProperty('--glow-y', `${y}px`);
      const angle = Math.atan2(y - r.height / 2, x - r.width / 2) * 180 / Math.PI + 90;
      el.style.setProperty('--glow-angle', `${angle}deg`);
    }, { passive: true });
  });

  const issues = [
    { title:'Bank account frozen or closed', aliases:['account frozen','bank froze account','account closed','locked account','freeze'], href:'guides/bank-account-frozen.html', meta:'Issue guide · notices, identity requests, transaction history' },
    { title:'Credit reporting inconsistencies', aliases:['credit report wrong','credit error','bureau error','credit reporting','tradeline'], href:'guides/credit-reporting-errors.html', meta:'Issue guide · reports, balances, statuses, dates, disputes' },
    { title:'Unauthorized transfer or scam', aliases:['unauthorized transfer','fraud transfer','scam','zelle','wire fraud','money transfer'], href:'guides/money-transfer-fraud.html', meta:'Issue guide · transaction timeline and authorization facts' },
    { title:'Unexpected or disputed bank fees', aliases:['bank fees','unexpected fee','overdraft','fee dispute'], href:'guides/unauthorized-bank-fees.html', meta:'Issue guide · agreement, schedule, statements and notices' },
    { title:'Debt collection not owed', aliases:['debt not mine','collector','collection','debt collection'], href:'guides/debt-collection-not-owed.html', meta:'Issue guide · collector identity, validation and dispute history' },
    { title:'Preparing a CFPB complaint', aliases:['cfpb','complaint','consumer complaint'], href:'guides/cfpb-bank-complaint-help.html', meta:'Issue guide · dates, prior contact, documents and requested remedy' },
  ];
  const actions = [
    { title:'Research an institution', aliases:['research bank','research institution','fact lock'], href:'research.html', meta:'Action · build a source-restricted public-record search' },
    { title:'Browse the Institution Registry', aliases:['registry','banks','institutions'], href:'registry.html', meta:'Action · resolve a canonical institution profile' },
    { title:'Open official resources', aliases:['resources','regulator','official sources'], href:'resources.html', meta:'Action · issue guides and official starting points' },
    { title:'Build my evidence packet', aliases:['evidence','submit','report','private intake'], href:'#submit', meta:'Action · organize a private intake record' },
  ];

  const normalize = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const institutions = () => (window.BHR_INSTITUTIONS || []).map((x) => ({
    title:x.name, aliases:[...(x.aliases || []), x.regulator || '', x.type || ''], href:`banks/${x.slug}.html`, meta:`Institution · ${x.type} · ${x.regulator}`
  }));
  const corpus = () => [
    ...institutions().map(x => ({...x,type:'INSTITUTION'})),
    ...issues.map(x => ({...x,type:'ISSUE'})),
    ...actions.map(x => ({...x,type:'ACTION'})),
  ];

  const overlay = document.querySelector('[data-command-overlay]');
  const input = document.querySelector('[data-command-input]');
  const results = document.querySelector('[data-command-results]');
  const openers = [...document.querySelectorAll('[data-command-open]')];
  if (!overlay || !input || !results) return;

  let active = 0;
  let previousFocus = null;
  let currentRows = [];

  function score(item, query) {
    if (!query) return item.type === 'INSTITUTION' ? 30 : item.type === 'ISSUE' ? 20 : 10;
    const q = normalize(query); const title = normalize(item.title); const aliases = item.aliases.map(normalize);
    if (title === q) return 100;
    if (title.startsWith(q)) return 90;
    if (aliases.some(a => a === q)) return 88;
    if (aliases.some(a => a.startsWith(q))) return 82;
    if (title.includes(q)) return 74;
    if (aliases.some(a => a.includes(q))) return 68;
    const words = q.split(' ').filter(Boolean);
    const hay = [title,...aliases].join(' ');
    const hits = words.filter(w => hay.includes(w)).length;
    return hits ? 40 + hits * 6 : 0;
  }

  function getRows(query) {
    return corpus().map(item => ({ item, s:score(item,query) })).filter(x => x.s > 0).sort((a,b) => b.s - a.s || a.item.title.localeCompare(b.item.title)).slice(0,9).map(x => x.item);
  }

  function render(query='') {
    currentRows = getRows(query); active = Math.min(active, Math.max(0,currentRows.length - 1));
    if (!currentRows.length) { results.innerHTML = '<div class="command-empty">No matching BHR route yet. Try an institution name or a shorter issue phrase.</div>'; return; }
    results.replaceChildren(...currentRows.map((item,index) => {
      const button = document.createElement('button'); button.type='button'; button.className=`command-result${index===active?' is-active':''}`; button.setAttribute('role','option'); button.setAttribute('aria-selected',String(index===active));
      const copy = document.createElement('span'); const strong=document.createElement('strong'); strong.textContent=item.title; const small=document.createElement('small'); small.textContent=item.meta; copy.append(strong,small);
      const type=document.createElement('span'); type.className='command-type'; type.textContent=item.type; button.append(copy,type);
      button.addEventListener('mouseenter',()=>{active=index;syncActive()}); button.addEventListener('click',()=>go(item)); return button;
    }));
  }
  function syncActive(){[...results.querySelectorAll('.command-result')].forEach((el,i)=>{el.classList.toggle('is-active',i===active);el.setAttribute('aria-selected',String(i===active))});results.querySelector('.is-active')?.scrollIntoView({block:'nearest'})}
  function go(item){close(); if(item.href.startsWith('#')) document.querySelector(item.href)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}); else location.href=item.href}
  function open(){previousFocus=document.activeElement;overlay.hidden=false;document.body.classList.add('command-open');input.value='';active=0;render('');requestAnimationFrame(()=>input.focus())}
  function close(){overlay.hidden=true;document.body.classList.remove('command-open');previousFocus?.focus?.()}
  openers.forEach(el=>el.addEventListener('click',open));
  overlay.addEventListener('pointerdown',(e)=>{if(e.target===overlay)close()});
  input.addEventListener('input',()=>{active=0;render(input.value)});
  document.addEventListener('keydown',(e)=>{
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); overlay.hidden?open():close(); return; }
    if (overlay.hidden) return;
    if (e.key==='Escape') { e.preventDefault(); close(); }
    else if (e.key==='ArrowDown') { e.preventDefault(); active=Math.min(currentRows.length-1,active+1); syncActive(); }
    else if (e.key==='ArrowUp') { e.preventDefault(); active=Math.max(0,active-1); syncActive(); }
    else if (e.key==='Enter' && currentRows[active]) { e.preventDefault(); go(currentRows[active]); }
    else if (e.key==='Tab') { const focusables=[...overlay.querySelectorAll('input,button,[href]')].filter(x=>!x.disabled); if(!focusables.length)return; const first=focusables[0],last=focusables[focusables.length-1]; if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()} else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()} }
  });

  // Current delivery status: replaces the old static warning with health-aware copy.
  const delivery = document.getElementById('deliveryStatus');
  if (delivery) {
    fetch('/api/health',{headers:{Accept:'application/json'},cache:'no-store'})
      .then(r=>r.ok?r.json():Promise.reject(new Error('health')))
      .then(h=>{
        const ready=Boolean(h?.delivery?.github||h?.delivery?.email); delivery.classList.toggle('is-ready',ready); delivery.classList.toggle('is-warn',!ready);
        const p=delivery.querySelector('p'); if(p) p.textContent=ready?'Private delivery channel is configured and available.':'Private delivery is not currently reporting as ready.';
      })
      .catch(()=>{delivery.classList.add('is-warn');const p=delivery.querySelector('p');if(p)p.textContent='Delivery status could not be checked. The form will still verify delivery before showing success.'});
  }

  render('');
})();
