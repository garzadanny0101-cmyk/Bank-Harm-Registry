(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const entityInput = $('#researchEntity');
  const form = $('#researchForm');
  if (!form || !entityInput) return;
  const sourceResults = $('#sourceResults');
  const heading = $('#researchHeading');
  const summary = $('#researchSummary');
  const issue = $('#researchIssue');
  const windowSelect = $('#researchWindow');
  const today = new Date();
  const fmt = d => d.toISOString().slice(0,10);
  const quote = v => `"${String(v).replaceAll('"','').trim()}"`;
  const g = q => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  const portal = {
    OCC:'https://occ.treas.gov/topics/charters-and-licensing/financial-institution-lists/index-financial-institution-lists.html',
    FDIC:'https://banks.data.fdic.gov/bankfind-suite/bankfind',
    FFIEC:'https://www.ffiec.gov/npw/Institution/Index',
    CFPB:'https://www.consumerfinance.gov/enforcement/actions/',
    FED:'https://www.federalreserve.gov/supervisionreg/enforcement-actions.htm',
    SEC:'https://www.sec.gov/edgar/search/',
    FTC:'https://www.ftc.gov/legal-library/browse/cases-proceedings',
    DOJ:'https://www.justice.gov/news',
    PACER:'https://pcl.uscourts.gov/pcl/index.jsf'
  };
  function daysAgo(days){const d=new Date(today);d.setDate(d.getDate()-Number(days||3650));return fmt(d)}
  function resolveEntity(value){
    const key=value.toLowerCase().trim();
    return (window.BHR_INSTITUTIONS||[]).find(x=>x.name.toLowerCase()===key || (x.aliases||[]).some(a=>a.toLowerCase()===key));
  }
  function searches(entityName, focus, days){
    const exact=quote(entityName), after=`after:${daysAgo(days)}`, f=focus?quote(focus):'';
    const combine=(domain, terms='')=>[exact, `site:${domain}`, terms, f, after].filter(Boolean).join(' ');
    return [
      {tier:'PRIMARY',name:'FFIEC / NIC entity verification',desc:'Resolve institution identity and related banking organizations before attribution.',query:combine('ffiec.gov','institution RSSD'),url:g(combine('ffiec.gov','institution RSSD')),portal:portal.FFIEC},
      {tier:'PRIMARY',name:'OCC institution + enforcement',desc:'National-bank charter, institution and enforcement discovery.',query:combine('occ.treas.gov','enforcement charter consent order'),url:g(combine('occ.treas.gov','enforcement charter consent order')),portal:portal.OCC},
      {tier:'PRIMARY',name:'FDIC BankFind + enforcement',desc:'Institution history, insurance status and FDIC enforcement discovery.',query:combine('fdic.gov','BankFind enforcement consent order'),url:g(combine('fdic.gov','BankFind enforcement consent order')),portal:portal.FDIC},
      {tier:'PRIMARY',name:'Federal Reserve actions',desc:'Board orders, enforcement and holding-company records.',query:combine('federalreserve.gov','enforcement order'),url:g(combine('federalreserve.gov','enforcement order')),portal:portal.FED},
      {tier:'PRIMARY',name:'CFPB enforcement',desc:'Official CFPB enforcement records. Complaint information is context, not proof.',query:combine('consumerfinance.gov','enforcement action order'),url:g(combine('consumerfinance.gov','enforcement action order')),portal:portal.CFPB},
      {tier:'PRIMARY',name:'SEC EDGAR / enforcement',desc:'Public-company filings, exhibits and SEC actions when applicable.',query:combine('sec.gov','EDGAR enforcement 10-K 8-K'),url:g(combine('sec.gov','EDGAR enforcement 10-K 8-K')),portal:portal.SEC},
      {tier:'PRIMARY',name:'FTC cases',desc:'FTC cases and proceedings involving the exact-name entity.',query:combine('ftc.gov','case complaint order settlement'),url:g(combine('ftc.gov','case complaint order settlement')),portal:portal.FTC},
      {tier:'PRIMARY',name:'DOJ cases + settlements',desc:'Justice Department public cases, settlements and announcements.',query:combine('justice.gov','settlement indictment complaint civil'),url:g(combine('justice.gov','settlement indictment complaint civil')),portal:portal.DOJ},
      {tier:'COURTS',name:'Federal court discovery',desc:'Discover opinions and dockets; PACER is the authoritative federal docket system when needed.',query:[exact,'(site:law.justia.com OR site:govinfo.gov)',f,after].filter(Boolean).join(' '),url:g([exact,'(site:law.justia.com OR site:govinfo.gov)',f,after].filter(Boolean).join(' ')),portal:portal.PACER},
      {tier:'DISCOVERY',name:'Recent exact-name news',desc:'Current reporting for leads. Confirm material claims against primary records when possible.',query:[exact,f,'(enforcement OR lawsuit OR settlement OR complaint OR investigation)',after].filter(Boolean).join(' '),url:g([exact,f,'(enforcement OR lawsuit OR settlement OR complaint OR investigation)',after].filter(Boolean).join(' ')),portal:''}
    ];
  }
  function render(){
    const raw=entityInput.value.trim(); if(!raw){sourceResults.innerHTML='<div class="empty-state">Enter an institution or company name.</div>';return}
    const resolved=resolveEntity(raw); const name=resolved?.name||raw; const rows=searches(name,issue.value,windowSelect.value);
    heading.textContent=`Research: ${name}`;
    summary.textContent=resolved?`${resolved.type} · ${resolved.regulator}. ${resolved.note}`:'Entity not in the starter registry. Verify the exact legal entity before attributing results.';
    sourceResults.replaceChildren(...rows.map(row=>{
      const article=document.createElement('article'); article.className='source-card';
      const copy=document.createElement('div');
      const status=document.createElement('span');status.className=`status ${row.tier==='PRIMARY'?'verified':row.tier==='COURTS'?'reported':'alleged'}`;status.textContent=row.tier;
      const h=document.createElement('h3');h.textContent=row.name;const p=document.createElement('p');p.textContent=row.desc;const q=document.createElement('div');q.className='query';q.textContent=row.query;copy.append(status,h,p,q);
      const actions=document.createElement('div');actions.className='source-actions';
      const a=document.createElement('a');a.className='btn slim';a.href=row.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Search';actions.append(a);
      if(row.portal){const b=document.createElement('a');b.className='btn slim';b.href=row.portal;b.target='_blank';b.rel='noopener noreferrer';b.textContent='Official portal';actions.append(b)}
      article.append(copy,actions);return article;
    }));
    const u=new URL(location.href);u.searchParams.set('q',raw);history.replaceState({},'',u);
  }
  form.addEventListener('submit',e=>{e.preventDefault();render()});
  const params=new URLSearchParams(location.search); if(params.get('q')){entityInput.value=params.get('q');render()}
})();
