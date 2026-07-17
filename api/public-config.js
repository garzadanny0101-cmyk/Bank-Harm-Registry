function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }
  const turnstileConfigured = Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
  return json(res, 200, {
    turnstileSiteKey: turnstileConfigured ? process.env.TURNSTILE_SITE_KEY : '',
    turnstileRequired: String(process.env.TURNSTILE_REQUIRED || '').toLowerCase() === 'true'
  });
};
