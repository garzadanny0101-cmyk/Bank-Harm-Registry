const assert=require('assert');
function mockRes(){return {statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}}}
(async()=>{
  const old={...process.env};
  try{
    const health=require('../api/health.js');let r=mockRes();health({headers:{}},r);assert(r.statusCode===200&&r.body.ok===true);
    const cfg=require('../api/public-config.js');r=mockRes();cfg({headers:{}},r);assert(r.statusCode===200&&Object.hasOwn(r.body,'turnstileSiteKey'));
    const submit=require('../api/submit-report.js');
    process.env.DEMO_ACCEPT_WITHOUT_DELIVERY='true';delete process.env.RESEND_API_KEY;delete process.env.REPORT_TO_EMAIL;delete process.env.GITHUB_INTAKE_ENABLED;
    const good={type:'consumer-report',name:'Alias',email:'a@example.com',institution:'Test Bank',issue:'Other',story:'A factual test narrative.',consentContact:true,accuracy:true};
    r=mockRes();await submit({method:'POST',headers:{host:'localhost','x-forwarded-proto':'https'},body:good},r);assert(r.statusCode===200&&r.body.ok&&r.body.demoAccepted===true&&/^BHR-/.test(r.body.reportId));
    r=mockRes();await submit({method:'POST',headers:{host:'localhost','x-forwarded-proto':'https'},body:{...good,story:'SSN 123-45-6789'}},r);assert(r.statusCode===400&&/Remove SSNs/.test(r.body.error));
    process.env.DEMO_ACCEPT_WITHOUT_DELIVERY='false';r=mockRes();await submit({method:'POST',headers:{host:'localhost','x-forwarded-proto':'https'},body:good},r);assert(r.statusCode===503&&/not configured/.test(r.body.error));
    console.log('Vercel backend behavior tests passed.');
  } finally { process.env=old; }
})().catch(e=>{console.error(e);process.exit(1)});
