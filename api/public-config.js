function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }
  return json(res, 200, {
    turnstileSiteKey: (process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY) ? process.env.TURNSTILE_SITE_KEY : ''
  });
};
