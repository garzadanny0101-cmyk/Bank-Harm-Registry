function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function clampSize(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return 30;
  return Math.max(9, Math.min(36, n));
}

function mapComplaint(source = {}) {
  return {
    complaintId: source.complaint_id || '',
    company: source.company || '',
    product: source.product || '',
    issue: source.issue || '',
    subIssue: source.sub_issue || '',
    state: source.state || '',
    dateReceived: source.date_received || '',
    companyResponse: source.company_response || '',
    timely: source.timely || ''
  };
}

module.exports = async function handler(req, res) {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const size = clampSize(req.query?.size);
  const params = new URLSearchParams({
    size: String(size),
    sort: 'created_date_desc',
    no_aggs: 'true',
    no_highlight: 'true'
  });

  const url = `https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?${params.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Bank-Harm-Registry/1.0'
      },
      signal: controller.signal
    });

    if (!upstream.ok) {
      return json(res, 502, { ok: false, error: 'CFPB data source unavailable' });
    }

    const data = await upstream.json();
    const hits = Array.isArray(data?.hits?.hits) ? data.hits.hits : [];
    const items = hits.map((hit) => mapComplaint(hit?._source)).filter((item) => item.company || item.issue);

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=900, stale-while-revalidate=3600');
    return json(res, 200, {
      ok: true,
      source: 'Consumer Financial Protection Bureau Consumer Complaint Database',
      sourceUrl: 'https://www.consumerfinance.gov/data-research/consumer-complaints/',
      lastUpdated: data?._meta?.last_updated || data?._meta?.last_indexed || '',
      items
    });
  } catch {
    return json(res, 502, { ok: false, error: 'CFPB data source unavailable' });
  } finally {
    clearTimeout(timeout);
  }
};

module.exports._test = { clampSize, mapComplaint };
