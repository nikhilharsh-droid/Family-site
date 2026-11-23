/* Chess rules for the family site. No dependencies.
   Board: 64 squares, index = row*8 + col, row 0 is rank 8 (top, from White's side).
   Pieces: 'PNBRQK' white, 'pnbrqk' black, '' empty. */
(function (root) {
  'use strict';
  var FILES = 'abcdefgh';
  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  var KG = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  var DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]];
  var ORTH = [[-1,0],[1,0],[0,-1],[0,1]];

  function isW(p) { return p !== '' && p === p.toUpperCase(); }
  function colorOf(p) { return p === '' ? '' : (isW(p) ? 'w' : 'b'); }
  function sqName(i) { return FILES[i % 8] + (8 - Math.floor(i / 8)); }
  function sqIndex(n) { return (8 - parseInt(n[1], 10)) * 8 + FILES.indexOf(n[0]); }
  function on(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  function parseFEN(fen) {
    var parts = fen.trim().split(/\s+/);
    var b = [], rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Bad FEN');
    for (var r = 0; r < 8; r++) {
      for (var k = 0; k < rows[r].length; k++) {
        var ch = rows[r][k];
        if (/\d/.test(ch)) { for (var n = 0; n < +ch; n++) b.push(''); }
        else b.push(ch);
      }
    }
    if (b.length !== 64) throw new Error('Bad FEN');
    return {
      board: b,
      turn: parts[1] || 'w',
      castling: (parts[2] && parts[2] !== '-') ? parts[2] : '',
      ep: (parts[3] && parts[3] !== '-') ? sqIndex(parts[3]) : -1,
      half: parseInt(parts[4] || '0', 10),
      full: parseInt(parts[5] || '1', 10)
    };
  }

  function toFEN(st) {
    var out = '';
    for (var r = 0; r < 8; r++) {
      var e = 0;
      for (var c = 0; c < 8; c++) {
        var p = st.board[r * 8 + c];
        if (p === '') e++; else { if (e) { out += e; e = 0; } out += p; }
      }
      if (e) out += e;
      if (r < 7) out += '/';
    }
    return out + ' ' + st.turn + ' ' + (st.castling || '-') + ' ' + (st.ep >= 0 ? sqName(st.ep) : '-') + ' ' + st.half + ' ' + st.full;
  }

  // Is square i attacked by side `by` ('w' or 'b')?
  function attacked(b, i, by) {
    var r = Math.floor(i / 8), c = i % 8, k, rr, cc, p;
    var pr = by === 'w' ? r + 1 : r - 1; // attacking pawn sits one row "behind" from its view
    var pawn = by === 'w' ? 'P' : 'p';
    if (on(pr, c - 1) && b[pr * 8 + c - 1] === pawn) return true;
    if (on(pr, c + 1) && b[pr * 8 + c + 1] === pawn) return true;
    var kn = by === 'w' ? 'N' : 'n', kg = by === 'w' ? 'K' : 'k';
    for (k = 0; k < 8; k++) {
      rr = r + KN[k][0]; cc = c + KN[k][1];
      if (on(rr, cc) && b[rr * 8 + cc] === kn) return true;
      rr = r + KG[k][0]; cc = c + KG[k][1];
      if (on(rr, cc) && b[rr * 8 + cc] === kg) return true;
    }
    var bq = by === 'w' ? 'BQ' : 'bq', rq = by === 'w' ? 'RQ' : 'rq';
    for (k = 0; k < 4; k++) {
      rr = r + DIAG[k][0]; cc = c + DIAG[k][1];
      while (on(rr, cc)) { p = b[rr * 8 + cc]; if (p !== '') { if (bq.indexOf(p) >= 0) return true; break; } rr += DIAG[k][0]; cc += DIAG[k][1]; }
      rr = r + ORTH[k][0]; cc = c + ORTH[k][1];
      while (on(rr, cc)) { p = b[rr * 8 + cc]; if (p !== '') { if (rq.indexOf(p) >= 0) return true; break; } rr += ORTH[k][0]; cc += ORTH[k][1]; }
    }
    return false;
  }

  function kingSq(b, color) { var k = color === 'w' ? 'K' : 'k'; return b.indexOf(k); }
  function inCheck(st, color) { color = color || st.turn; var k = kingSq(st.board, color); return k >= 0 && attacked(st.board, k, color === 'w' ? 'b' : 'w'); }

  function pseudo(st) {
    var b = st.board, me = st.turn, them = me === 'w' ? 'b' : 'w', mv = [];
    function add(f, t, extra) {
      var m = { from: f, to: t, piece: b[f], captured: b[t] };
      if (extra) for (var x in extra) m[x] = extra[x];
      mv.push(m);
    }
    for (var i = 0; i < 64; i++) {
      var p = b[i];
      if (p === '' || colorOf(p) !== me) continue;
      var r = Math.floor(i / 8), c = i % 8, t = p.toLowerCase(), k, rr, cc, j;
      if (t === 'p') {
        var dir = me === 'w' ? -1 : 1, startRow = me === 'w' ? 6 : 1, lastRow = me === 'w' ? 0 : 7;
        var pushAdd = function (f, to, ex) {
          if (Math.floor(to / 8) === lastRow) {
            ['q', 'r', 'b', 'n'].forEach(function (pp) { var e = { promo: me === 'w' ? pp.toUpperCase() : pp }; if (ex) for (var y in ex) e[y] = ex[y]; add(f, to, e); });
          } else add(f, to, ex);
        };
        rr = r + dir;
        if (on(rr, c) && b[rr * 8 + c] === '') {
          pushAdd(i, rr * 8 + c);
          if (r === startRow && b[(rr + dir) * 8 + c] === '') add(i, (rr + dir) * 8 + c, { flag: 'double' });
        }
        for (k = -1; k <= 1; k += 2) {
          cc = c + k;
          if (!on(rr, cc)) continue;
          j = rr * 8 + cc;
          if (b[j] !== '' && colorOf(b[j]) === them) pushAdd(i, j);
          else if (j === st.ep) add(i, j, { flag: 'ep', captured: me === 'w' ? 'p' : 'P' });
        }
      } else if (t === 'n' || t === 'k') {
        var offs = t === 'n' ? KN : KG;
        for (k = 0; k < 8; k++) {
          rr = r + offs[k][0]; cc = c + offs[k][1];
          if (!on(rr, cc)) continue;
          j = rr * 8 + cc;
          if (b[j] === '' || colorOf(b[j]) === them) add(i, j);
        }
        if (t === 'k') {
          var home = me === 'w' ? 60 : 4, cs = st.castling;
          var K = me === 'w' ? 'K' : 'k', Q = me === 'w' ? 'Q' : 'q', R = me === 'w' ? 'R' : 'r';
          if (i === home && !attacked(b, home, them)) {
            if (cs.indexOf(K) >= 0 && b[home + 1] === '' && b[home + 2] === '' && b[home + 3] === R &&
                !attacked(b, home + 1, them) && !attacked(b, home + 2, them)) add(i, home + 2, { flag: 'castle' });
            if (cs.indexOf(Q) >= 0 && b[home - 1] === '' && b[home - 2] === '' && b[home - 3] === '' && b[home - 4] === R &&
                !attacked(b, home - 1, them) && !attacked(b, home - 2, them)) add(i, home - 2, { flag: 'castle' });
          }
        }
      } else {
        var dirs = t === 'b' ? DIAG : t === 'r' ? ORTH : DIAG.concat(ORTH);
        for (k = 0; k < dirs.length; k++) {
          rr = r + dirs[k][0]; cc = c + dirs[k][1];
          while (on(rr, cc)) {
            j = rr * 8 + cc;
            if (b[j] === '') add(i, j);
            else { if (colorOf(b[j]) === them) add(i, j); break; }
            rr += dirs[k][0]; cc += dirs[k][1];
          }
        }
      }
    }
    return mv;
  }

  function makeMove(st, m) {
    var b = st.board.slice(), me = st.turn;
    b[m.to] = m.promo || b[m.from];
    b[m.from] = '';
    if (m.flag === 'ep') b[m.to + (me === 'w' ? 8 : -8)] = '';
    if (m.flag === 'castle') {
      if (m.to > m.from) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = ''; }
      else { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = ''; }
    }
    var cs = st.castling;
    function drop(ch) { cs = cs.replace(ch, ''); }
    if (m.piece === 'K') { drop('K'); drop('Q'); }
    if (m.piece === 'k') { drop('k'); drop('q'); }
    [m.from, m.to].forEach(function (s) {
      if (s === 63) drop('K'); if (s === 56) drop('Q'); if (s === 7) drop('k'); if (s === 0) drop('q');
    });
    var isPawn = m.piece === 'P' || m.piece === 'p';
    return {
      board: b,
      turn: me === 'w' ? 'b' : 'w',
      castling: cs,
      ep: m.flag === 'double' ? (m.from + m.to) / 2 : -1,
      half: (isPawn || m.captured) ? 0 : st.half + 1,
      full: st.full + (me === 'b' ? 1 : 0)
    };
  }

  function legalMoves(st) {
    var me = st.turn, them = me === 'w' ? 'b' : 'w';
    return pseudo(st).filter(function (m) {
      var n = makeMove(st, m);
      var k = kingSq(n.board, me);
      return !attacked(n.board, k, them);
    });
  }

  function san(st, m, legal) {
    legal = legal || legalMoves(st);
    var s, t = m.piece.toUpperCase();
    if (m.flag === 'castle') s = m.to > m.from ? 'O-O' : 'O-O-O';
    else if (t === 'P') {
      s = (m.captured ? FILES[m.from % 8] + 'x' : '') + sqName(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
    } else {
      var amb = legal.filter(function (o) { return o.piece === m.piece && o.to === m.to && o.from !== m.from; });
      var dis = '';
      if (amb.length) {
        var sameFile = amb.some(function (o) { return o.from % 8 === m.from % 8; });
        var sameRow = amb.some(function (o) { return Math.floor(o.from / 8) === Math.floor(m.from / 8); });
        if (!sameFile) dis = FILES[m.from % 8];
        else if (!sameRow) dis = sqName(m.from)[1];
        else dis = sqName(m.from);
      }
      s = t + dis + (m.captured ? 'x' : '') + sqName(m.to);
    }
    var n = makeMove(st, m);
    if (inCheck(n)) s += legalMoves(n).length ? '+' : '#';
    return s;
  }

  function uci(m) { return sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : ''); }

  function findUci(st, u, legal) {
    legal = legal || legalMoves(st);
    var f = sqIndex(u.slice(0, 2)), t = sqIndex(u.slice(2, 4)), pr = u[4] || '';
    for (var i = 0; i < legal.length; i++) {
      var m = legal[i];
      if (m.from === f && m.to === t && (m.promo ? m.promo.toLowerCase() === pr : pr === '')) return m;
    }
    return null;
  }

  function findSan(st, token, legal) {
    legal = legal || legalMoves(st);
    var clean = function (x) { return x.replace(/[+#!?]/g, '').replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O'); };
    var want = clean(token);
    for (var i = 0; i < legal.length; i++) if (clean(san(st, legal[i], legal)) === want) return legal[i];
    return null;
  }

  function insufficient(b) {
    var minors = [], other = 0;
    for (var i = 0; i < 64; i++) {
      var p = b[i].toLowerCase();
      if (p === '' || p === 'k') continue;
      if (p === 'n' || p === 'b') minors.push({ p: p, sq: i }); else other++;
    }
    if (other) return false;
    if (minors.length <= 1) return true;
    // only bishops, all on the same color squares
    if (minors.every(function (m) { return m.p === 'b'; })) {
      var col = function (sq) { return (Math.floor(sq / 8) + sq % 8) % 2; };
      return minors.every(function (m) { return col(m.sq) === col(minors[0].sq); });
    }
    return false;
  }

  function posKey(st) { return toFEN(st).split(' ').slice(0, 4).join(' '); }

  // Status of a position. history = array of posKeys seen so far (for threefold).
  function status(st, history) {
    var legal = legalMoves(st), check = inCheck(st);
    if (!legal.length) return { over: true, result: check ? 'checkmate' : 'stalemate', winner: check ? (st.turn === 'w' ? 'b' : 'w') : '', check: check };
    if (insufficient(st.board)) return { over: true, result: 'material', check: check };
    if (st.half >= 100) return { over: true, result: 'fifty', check: check };
    if (history) {
      var k = posKey(st), n = 0;
      history.forEach(function (h) { if (h === k) n++; });
      if (n >= 3) return { over: true, result: 'repetition', check: check };
    }
    return { over: false, check: check, legal: legal };
  }

  // Can the side to move force mate within n of its own moves?
  function canMateIn(st, n) {
    var moves = legalMoves(st);
    for (var i = 0; i < moves.length; i++) if (moveKeepsMate(st, moves[i], n)) return true;
    return false;
  }
  function moveKeepsMate(st, m, n) {
    var a = makeMove(st, m), replies = legalMoves(a);
    if (!replies.length) return inCheck(a);
    if (n <= 1) return false;
    for (var j = 0; j < replies.length; j++) if (!canMateIn(makeMove(a, replies[j]), n - 1)) return false;
    return true;
  }
  // Best defence for the side to move when facing mate: the reply that delays mate longest (or escapes).
  function bestDefence(st, n) {
    var replies = legalMoves(st), best = null, bestDepth = -1;
    for (var i = 0; i < replies.length; i++) {
      var a = makeMove(st, replies[i]), d = 0;
      for (var k = 1; k <= n; k++) { if (canMateIn(a, k)) { d = k; break; } }
      var score = d === 0 ? 99 : d;
      if (score > bestDepth) { bestDepth = score; best = replies[i]; }
    }
    return best;
  }

  function perft(st, d) {
    if (d === 0) return 1;
    var ms = legalMoves(st), n = 0;
    if (d === 1) return ms.length;
    for (var i = 0; i < ms.length; i++) n += perft(makeMove(st, ms[i]), d - 1);
    return n;
  }

  var api = {
    START: START, parseFEN: parseFEN, toFEN: toFEN, legalMoves: legalMoves, makeMove: makeMove,
    san: san, uci: uci, findUci: findUci, findSan: findSan, inCheck: inCheck, status: status,
    posKey: posKey, sqName: sqName, sqIndex: sqIndex, colorOf: colorOf, canMateIn: canMateIn,
    moveKeepsMate: moveKeepsMate, bestDefence: bestDefence, perft: perft
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Chess = api;
})(this);
