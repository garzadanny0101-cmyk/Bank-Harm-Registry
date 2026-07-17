function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function isTrue(value) {
  return String(value || '').toLowerCase() === 'true';
}

module.exports = async function handler(req, res) {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const resend = Boolean(process.env.RESEND_API_KEY && process.env.REPORT_TO_EMAIL);
  const githubEnabled = isTrue(process.env.GITHUB_INTAKE_ENABLED);
  const github = Boolean(
    githubEnabled &&
    process.env.GITHUB_TOKEN &&
    process.env.GITHUB_OWNER &&
    process.env.GITHUB_REPO &&
    isTrue(process.env.GITHUB_REPO_PRIVATE_CONFIRMED)
  );
  const turnstile = Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY);
  const turnstileRequired = isTrue(process.env.TURNSTILE_REQUIRED);
  const demoMode = isTrue(process.env.DEMO_ACCEPT_WITHOUT_DELIVERY);
  const deploymentEnvironment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';

  return json(res, 200, {
    ok: true,
    service: 'Bank Harm Registry API',
    readyToAcceptPrivateIntake: resend || github || demoMode,
    configured: {
      resend,
      githubIntakeEnabled: githubEnabled,
      githubPrivateIssueHandoff: github,
      turnstile,
      turnstileRequired,
      demoMode
    },
    deploymentEnvironment,
    warnings: [
      ...(resend || github || demoMode ? [] : ['No successful delivery path or demo acceptance is configured.']),
      ...(githubEnabled && !github ? ['GitHub intake is enabled but incomplete or private-repository confirmation is missing.'] : []),
      ...(turnstileRequired && !turnstile ? ['Turnstile is required but both keys are not configured.'] : []),
      ...(!turnstileRequired && !turnstile ? ['Turnstile is optional and not configured.'] : [])
    ],
    timestamp: new Date().toISOString()
  });
};

module.exports._test = { isTrue };
