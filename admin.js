(() => {
  'use strict';
  const RECEIPTS_KEY = 'bhr_submission_receipts_v4';
  const SECTIONS = [
    ['Intake Inbox', () => true],
    ['Evidence Ready', (r) => r.evidenceScore >= 65],
    ['Regulator Ready', (r) => r.status === 'regulator-ready'],
    ['Support Match Eligible', (r) => r.status === 'support-match-review' && r.consentMatrix?.consumerSupportMatching],
    ['Declaration Ready', (r) => r.consentMatrix?.declarationSupport && r.evidenceScore >= 65],
    ['Donation/Support Notes', () => false],
    ['Volunteer Expert Applicants', (r) => r.type === 'volunteer-application'],
    ['Risk Queue', (r) => Array.isArray(r.riskFlags) && r.riskFlags.length > 0]
  ];
  const read = () => { try { const data = JSON.parse(localStorage.getItem(RECEIPTS_KEY) || '[]'); return Array.isArray(data) ? data : []; } catch { return []; } };
  const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  function consentSummary(matrix = {}) { return Object.entries(matrix).filter(([, value]) => value === true).map(([key]) => key).join(', ') || 'contact only / none recorded'; }
  function download(name, type, content) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 500); }
  function safeExportRows(receipts) { return receipts.map((r) => ({ reportId:r.reportId,createdAt:r.createdAt,type:r.type,institution:r.institution,category:r.category,state:r.state,evidenceScore:r.evidenceScore,remedyScore:r.remedyScore,supportMatchReadinessScore:r.supportMatchReadinessScore,riskFlags:r.riskFlags,status:r.status,consentMatrix:r.consentMatrix })); }
  function render() {
    const receipts = read(); const rows = document.querySelector('#adminRows'); const sections = document.querySelector('#adminSections'); const kpis = document.querySelector('#adminKpis');
    document.querySelector('#receiptCount').textContent = `${receipts.length} receipt${receipts.length === 1 ? '' : 's'}`;
    kpis.replaceChildren();
    [['Total', receipts.length],['Evidence ready', receipts.filter(r=>r.evidenceScore>=65).length],['Support review', receipts.filter(r=>r.status==='support-match-review').length],['Risk queue', receipts.filter(r=>r.riskFlags?.length).length]].forEach(([label,value])=>{const card=document.createElement('article');card.className='metric';const b=document.createElement('b');b.textContent=value;const span=document.createElement('span');span.textContent=label;card.append(b,span);kpis.append(card);});
    sections.replaceChildren(); SECTIONS.forEach(([name, predicate])=>{ const card=document.createElement('article'); card.className='card admin-section-card'; const h=document.createElement('h3'); h.textContent=name; const p=document.createElement('p'); p.textContent=`${receipts.filter(predicate).length} safe receipt record(s)`; card.append(h,p); sections.append(card); });
    rows.replaceChildren();
    if (!receipts.length) { const tr=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=14; td.textContent='No safe receipt metadata is stored in this browser.'; tr.append(td); rows.append(tr); return; }
    receipts.forEach((r)=>{ const values=[r.reportId,new Date(r.createdAt).toLocaleString(),'Protected—requires authenticated database','Protected—requires authenticated database',r.institution,r.category,r.state,'Protected',r.evidenceScore,r.remedyScore,r.supportMatchReadinessScore,consentSummary(r.consentMatrix),(r.riskFlags||[]).join(', ')||'none',r.status]; const tr=document.createElement('tr'); values.forEach((value)=>{const td=document.createElement('td');td.textContent=String(value ?? '');tr.append(td);}); rows.append(tr); });
  }
  document.addEventListener('DOMContentLoaded', () => {
    render();
    document.querySelector('#exportJson')?.addEventListener('click',()=>download(`bhr-safe-receipts-${Date.now()}.json`,'application/json',JSON.stringify(safeExportRows(read()),null,2)));
    document.querySelector('#exportCsv')?.addEventListener('click',()=>{const rows=safeExportRows(read());const headers=['reportId','createdAt','type','institution','category','state','evidenceScore','remedyScore','supportMatchReadinessScore','riskFlags','status','consentMatrix'];const csv=[headers.map(escapeCsv).join(','),...rows.map(r=>headers.map(h=>escapeCsv(typeof r[h]==='object'?JSON.stringify(r[h]):r[h])).join(','))].join('\n');download(`bhr-safe-receipts-${Date.now()}.csv`,'text/csv',csv);});
    document.querySelector('#clearReceipts')?.addEventListener('click',()=>{if(confirm('Clear safe receipt metadata from this browser?')){localStorage.removeItem(RECEIPTS_KEY);render();}});
  });
})();
