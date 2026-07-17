function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const email = Boolean(process.env.RESEND_API_KEY && process.env.REPORT_TO_EMAIL);
  const github = Boolean(
    process.env.GITHUB_TOKEN &&
    process.env.GITHUB_OWNER &&
    process.env.GITHUB_REPO &&
    process.env.GITHUB_REPO_PRIVATE_CONFIRMED === 'true'
  );
  const turnstile = Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY);

  return json(res, 200, {
    ok: true,
    service: 'Bank Harm Registry API',
    readyToAcceptPrivateIntake: email || github,
    configured: { email, githubPrivateIssueHandoff: github, turnstile },
    warnings: [
      ...(email || github ? [] : ['No private delivery channel is configured.']),
      ...(turnstile ? [] : ['Turnstile is not configured; do not promote to high traffic yet.'])
    ],
    timestamp: new Date().toISOString()
  });
};
