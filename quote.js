export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const symbol = (url.searchParams.get('symbol') || 'AAPL').toUpperCase();
  const period = url.searchParams.get('period') || 'daily';

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const rows = await fetchStooqBars(symbol);
    if (!rows.length) return json({ ok: false, error: '没有取到数据，请确认股票代码。当前版本优先支持美股七巨头。' }, 400);

    const aggregated = aggregateBars(rows, period).slice(-220);
    const response = json({ ok: true, symbol, name: symbol, source: 'Stooq via Cloudflare Function', rows: aggregated }, 200, {
      'Cache-Control': 'public, max-age=60, s-maxage=300'
    });
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (e) {
    return json({ ok: false, error: '数据接口暂时不可用，请稍后再试。' }, 500);
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'access-control-allow-origin': '*',
      ...extraHeaders,
    },
  });
}

function toStooqSymbol(symbol) {
  const map = {
    AAPL: 'aapl.us',
    MSFT: 'msft.us',
    NVDA: 'nvda.us',
    META: 'meta.us',
    AMZN: 'amzn.us',
    GOOGL: 'googl.us',
    TSLA: 'tsla.us'
  };
  return map[symbol] || `${symbol.toLowerCase()}.us`;
}

async function fetchStooqBars(symbol) {
  const stooq = toStooqSymbol(symbol);
  const resp = await fetch(`https://stooq.com/q/d/l/?s=${stooq}&i=d`, {
    headers: { 'user-agent': 'Mozilla/5.0' }
  });
  if (!resp.ok) throw new Error('upstream failed');
  const text = await resp.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, open, high, low, close, volume] = lines[i].split(',');
    const o = Number(open), h = Number(high), l = Number(low), c = Number(close), v = Number(volume);
    if (!date || [o, h, l, c].some(Number.isNaN)) continue;
    rows.push({ date, open: o, high: h, low: l, close: c, volume: Number.isNaN(v) ? 0 : v });
  }
  return rows;
}

function aggregateBars(rows, mode) {
  if (mode === 'daily') return rows;
  const buckets = new Map();
  for (const r of rows) {
    const d = new Date(r.date + 'T00:00:00Z');
    const key = mode === 'weekly'
      ? `${d.getUTCFullYear()}-W${String(getWeek(d)).padStart(2, '0')}`
      : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  }
  const out = [];
  for (const arr of buckets.values()) {
    out.push({
      date: arr[arr.length - 1].date,
      open: arr[0].open,
      high: Math.max(...arr.map(x => x.high)),
      low: Math.min(...arr.map(x => x.low)),
      close: arr[arr.length - 1].close,
      volume: arr.reduce((a, b) => a + b.volume, 0)
    });
  }
  return out;
}

function getWeek(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
