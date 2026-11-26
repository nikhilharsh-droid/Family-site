// Hello Hatch saves: one row per player, shared by every computer in the house. No sign-in.
// The game sends each player's whole save; the newer copy (by updated_at, ms) wins.
// Its own table in the shared database; nothing else in the database is touched.
const SCHEMA = 'CREATE TABLE IF NOT EXISTS hellohatch_players ( id TEXT PRIMARY KEY, data TEXT, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0 )';
const MAX_PLAYERS = 30;      // live players kept at most (the game itself allows 6)
const MAX_BYTES = 100000;    // one player's save is a few KB
let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.prepare(SCHEMA).run();
  ready = true;
}
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function handleHelloHatch(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path !== '/api/hellohatch' && !path.startsWith('/api/hellohatch/')) return null;
  await ensure(env.DB);

  if (path === '/api/hellohatch') {
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);
    const { results } = await env.DB.prepare('SELECT id, data, updated_at, deleted FROM hellohatch_players ORDER BY updated_at').all();
    return json(results.map((r) => ({ id: r.id, data: r.deleted ? null : r.data, updated_at: r.updated_at, deleted: !!r.deleted })));
  }

  const id = decodeURIComponent(path.slice('/api/hellohatch/'.length));
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return json({ error: 'bad id' }, 400);
  if (request.method !== 'PUT') return json({ error: 'method not allowed' }, 405);
  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: 'too big' }, 413);
  let body;
  try { body = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400); }
  const ts = body && body.updated_at;
  if (!Number.isFinite(ts) || ts <= 0 || ts > Date.now() + 7 * 864e5) return json({ error: 'bad time' }, 400);
  const at = Math.floor(ts);

  if (body.deleted === true) {
    await env.DB.prepare('INSERT INTO hellohatch_players (id, data, updated_at, deleted) VALUES (?1, NULL, ?2, 1) ON CONFLICT(id) DO UPDATE SET data = NULL, updated_at = excluded.updated_at, deleted = 1 WHERE excluded.updated_at > hellohatch_players.updated_at')
      .bind(id, at).run();
    return json({ ok: true });
  }

  if (typeof body.data !== 'string') return json({ error: 'no data' }, 400);
  let save;
  try { save = JSON.parse(body.data); } catch (e) { return json({ error: 'bad data' }, 400); }
  if (!save || typeof save !== 'object' || Array.isArray(save)) return json({ error: 'bad data' }, 400);

  const known = await env.DB.prepare('SELECT 1 FROM hellohatch_players WHERE id = ?1').bind(id).first();
  if (!known) {
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM hellohatch_players WHERE deleted = 0').first();
    if (c && c.n >= MAX_PLAYERS) return json({ error: 'too many players' }, 409);
  }
  await env.DB.prepare('INSERT INTO hellohatch_players (id, data, updated_at, deleted) VALUES (?1, ?2, ?3, 0) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0 WHERE excluded.updated_at > hellohatch_players.updated_at')
    .bind(id, body.data, at).run();
  return json({ ok: true });
}
