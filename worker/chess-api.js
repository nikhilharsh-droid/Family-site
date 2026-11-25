const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS chess_players ( name TEXT PRIMARY KEY COLLATE NOCASE, w INTEGER NOT NULL DEFAULT 0, l INTEGER NOT NULL DEFAULT 0, d INTEGER NOT NULL DEFAULT 0, pz INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, best INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (unixepoch()))',
  'CREATE TABLE IF NOT EXISTS chess_calls (pair TEXT PRIMARY KEY, name TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS chess_games ( id INTEGER PRIMARY KEY AUTOINCREMENT, white TEXT NOT NULL, black TEXT NOT NULL, result TEXT NOT NULL, k INTEGER NOT NULL, at INTEGER NOT NULL)'
];
let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  ready = true;
}
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
function cleanName(n) {
  if (typeof n !== 'string') return '';
  return n.trim().replace(/\s+/g, ' ').slice(0, 14);
}
const n0 = (x) => (Number.isFinite(x) && x >= 0 ? Math.min(Math.floor(x), 100000) : 0);
function statementsFor(db, ev) {
  const out = [];
  const add = (name) => out.push(db.prepare('INSERT OR IGNORE INTO chess_players (name) VALUES (?)').bind(name));
  switch (ev.t) {
    case 'add': { const n = cleanName(ev.name); if (n) add(n); break; }
    case 'del': { const n = cleanName(ev.name); if (n) out.push(db.prepare('DELETE FROM chess_players WHERE name = ?').bind(n)); break; }
    case 'seed': {
      for (const p of (Array.isArray(ev.players) ? ev.players : []).slice(0, 50)) {
        const n = cleanName(p && p.name); if (!n) continue;
        out.push(db.prepare('INSERT OR IGNORE INTO chess_players (name,w,l,d,pz,streak,best) VALUES (?,?,?,?,?,?,?)')
          .bind(n, n0(p.w), n0(p.l), n0(p.d), n0(p.pz), n0(p.streak), n0(p.best)));
      }
      break;
    }
    case 'game': {
      const w = cleanName(ev.white), b = cleanName(ev.black), k = ev.k === -1 ? -1 : 1;
      if (!w || !b || !['w', 'b', 'd'].includes(ev.r)) break;
      add(w); add(b);
      const bump = (col, name) => out.push(db.prepare('UPDATE chess_players SET ' + col + ' = MAX(0, ' + col + ' + ?) WHERE name = ?').bind(k, name));
      if (ev.r === 'w') { bump('w', w); bump('l', b); }
      else if (ev.r === 'b') { bump('w', b); bump('l', w); }
      else { bump('d', w); bump('d', b); }
      out.push(db.prepare('INSERT INTO chess_games (white,black,result,k,at) VALUES (?,?,?,?,?)').bind(w, b, ev.r, k, n0(ev.at) || Date.now()));
      break;
    }
    case 'puz': {
      const n = cleanName(ev.name); if (!n) break;
      add(n);
      out.push(ev.clean
        ? db.prepare('UPDATE chess_players SET pz = pz + 1, streak = streak + 1, best = MAX(best, streak + 1) WHERE name = ?').bind(n)
        : db.prepare('UPDATE chess_players SET pz = pz + 1 WHERE name = ?').bind(n));
      break;
    }
    case 'miss': { const n = cleanName(ev.name); if (n) out.push(db.prepare('UPDATE chess_players SET streak = 0 WHERE name = ?').bind(n)); break; }
    case 'call': {
      const n = cleanName(ev.name), pair = typeof ev.pair === 'string' ? ev.pair.slice(0, 40).toLowerCase() : '';
      if (n && pair) out.push(db.prepare('INSERT INTO chess_calls (pair,name) VALUES (?,?) ON CONFLICT(pair) DO UPDATE SET name = excluded.name').bind(pair, n));
      break;
    }
  }
  return out;
}
export async function handleChess(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/chess/')) return null;
  const db = env.DB;
  await ensure(db);
  if (url.pathname === '/api/chess/state' && request.method === 'GET') {
    const players = (await db.prepare('SELECT name,w,l,d,pz,streak,best FROM chess_players ORDER BY name COLLATE NOCASE').all()).results;
    const calls = {};
    for (const r of (await db.prepare('SELECT pair,name FROM chess_calls').all()).results) calls[r.pair] = r.name;
    return json({ players, calls });
  }
  if (url.pathname === '/api/chess/events' && request.method === 'POST') {
    const len = Number(request.headers.get('content-length') || 0);
    if (len > 64000) return json({ error: 'too big' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
    const events = Array.isArray(body && body.events) ? body.events.slice(0, 50) : [];
    const stmts = events.flatMap((ev) => (ev && typeof ev === 'object' ? statementsFor(db, ev) : []));
    if (stmts.length) await db.batch(stmts);
    return json({ ok: true, applied: events.length });
  }
  return json({ error: 'not found' }, 404);
}
