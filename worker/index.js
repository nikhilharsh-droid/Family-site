import { handleChess } from './chess-api.js';
// Harsh family site. Cloudflare serves the page files straight from this repo (see wrangler.jsonc);
// this script only runs for the live routes: Chess Club stats, the featured art wall and /status.json.
// The same security headers are set for page files in _headers.
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Strict-Transport-Security': 'max-age=31536000',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://lichess.org; media-src 'self' data: blob:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'"
};

export default {
  async fetch(request, env, ctx) {
    const res = await route(request, env).catch(() => new Response('Something went wrong. Try again in a minute.', { status: 500 }));
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY)) out.headers.set(k, v);
    return out;
  }
};

async function route(request, env) {
  const url = new URL(request.url);
  // Chess Club stats (players, results, puzzle streaks, coin-toss turns)
  const chess = await handleChess(request, env).catch(() => new Response(JSON.stringify({ error: 'chess api failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
  if (chess) return chess;
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const path = url.pathname;

  // a small health check: which version of each page is being served, the art wall and the last backup
  if (path === '/status.json') {
    const pages = {};
    for (const p of ['/', '/draw/']) {
      const r = await env.ASSETS.fetch(new URL(p, url)).catch(() => null);
      if (r && r.ok) {
        const b = await r.arrayBuffer();
        const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map((x) => x.toString(16).padStart(2, '0')).join('');
        pages[p] = { sha256: h.slice(0, 12), bytes: b.byteLength };
      } else pages[p] = { error: r ? r.status : 'fetch failed' };
    }
    const f = await env.DB.prepare('SELECT COUNT(*) AS n FROM art WHERE featured = 1 AND deleted IS NULL').first().catch(() => null);
    // the nightly backup is switched off for now (its cron trigger on family-private was removed on Nov 25)
    const lastBackup = 'off';
    let music = null;
    try {
      const m = await fetch('https://itunes.apple.com/search?term=happy&media=music&entity=song&limit=3&explicit=No&country=US', { cf: { cacheTtl: 3600, cacheEverything: true } });
      const md = m.ok ? await m.json() : null;
      music = md ? { ok: true, songs: (md.results || []).length, embed: md.results && md.results[0] ? String(md.results[0].trackViewUrl).slice(0, 40) : null } : { ok: false, status: m.status };
    } catch (e) { music = { ok: false }; }
    return new Response(JSON.stringify({ ok: true, checked: new Date().toISOString(), pages, featured_art: f ? f.n : null, last_backup: lastBackup, music_search: music }, null, 1), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }

  // featured drawings from the family art wall: picture only, and only ones a family member chose to show
  if (path === '/api/featured') {
    const { results } = await env.DB.prepare('SELECT id FROM art WHERE featured = 1 AND deleted IS NULL ORDER BY featured_at DESC LIMIT 8').all().catch(() => ({ results: [] }));
    return new Response(JSON.stringify({ ok: true, art: results.map((r) => ({ id: r.id })) }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
  }
  const fm = path.match(/^\/featured\/(\d+)\.jpg$/);
  if (fm) {
    const row = await env.DB.prepare('SELECT full FROM art WHERE id = ?1 AND featured = 1 AND deleted IS NULL').bind(+fm[1]).first();
    if (!row) return new Response('Not found', { status: 404 });
    return new Response(new Uint8Array(row.full), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=300' } });
  }
  if (path.startsWith('/api/')) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  // anything else: the page files, with the friendly missing page for wrong addresses
  return env.ASSETS.fetch(request);
}
