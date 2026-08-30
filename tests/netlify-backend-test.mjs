import assert from 'node:assert';
process.env.DEMO_ACCEPT_WITHOUT_DELIVERY='true';delete process.env.RESEND_API_KEY;delete process.env.REPORT_TO_EMAIL;delete process.env.GITHUB_INTAKE_ENABLED;
const health=(await import('../netlify/functions/health.mjs')).default;let res=await health(new Request('https://example.net/api/health'));let j=await res.json();assert(res.status===200&&j.ok&&j.platform==='netlify');
const submit=(await import('../netlify/functions/submit-report.mjs')).default;const good={type:'consumer-report',name:'Alias',email:'a@example.com',institution:'Test Bank',issue:'Other',story:'A factual test narrative.',consentContact:true,accuracy:true};
res=await submit(new Request('https://example.net/api/submit-report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(good)}));j=await res.json();assert(res.status===200&&j.ok&&j.demoAccepted===true);
res=await submit(new Request('https://example.net/api/submit-report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...good,story:'card 4111 1111 1111 1111'})}));j=await res.json();assert(res.status===400&&/Remove SSNs/.test(j.error));
console.log('Netlify backend behavior tests passed.');
