/* Simulador PAUT: telas 2D (S-scan, A-scan, topo, lateral, final) */
(function () {
'use strict';
const PA = window.PA, DEG = PA.DEG;
const MONO = '"IBM Plex Mono",ui-monospace,monospace';

const PALETTES = {
  amp: [[0, '#ffffff'], [.08, '#dce8ff'], [.2, '#7fa6ff'], [.33, '#2a49f0'], [.47, '#00c3ff'], [.58, '#1fcf5f'], [.7, '#f4ef12'], [.84, '#ff9500'], [1, '#e3001b']],
  escuro: [[0, '#05070a'], [.15, '#12245c'], [.3, '#1b4fd1'], [.45, '#10b5e8'], [.6, '#2ed47a'], [.74, '#f1e819'], [.88, '#ff8a00'], [1, '#ff1f3d']],
  cinza: [[0, '#ffffff'], [1, '#000000']]
};
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const LUTS = {};
Object.keys(PALETTES).forEach(k => { const S = PALETTES[k], L = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) { const t = i / 255; let j = 0; while (j < S.length - 2 && t > S[j + 1][0]) j++;
    const [t0, c0] = S[j], [t1, c1] = S[j + 1], f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0))), a = hex(c0), b = hex(c1);
    for (let c = 0; c < 3; c++) L[i * 3 + c] = Math.round(a[c] + (b[c] - a[c]) * f); }
  LUTS[k] = L; });
PA.paletteCss = k => 'linear-gradient(90deg,' + PALETTES[k].map(s => s[1] + ' ' + s[0] * 100 + '%').join(',') + ')';
const lutOf = cfg => LUTS[cfg.disp.palette] || LUTS.amp;
const darkPal = cfg => cfg.disp.palette === 'escuro';

function fit(cv) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(1.75, window.devicePixelRatio || 1);
  const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; cv._map = null; }
  return { W: w, H: h, dpr: w / Math.max(1, r.width) };
}
const f1 = v => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
PA.f1 = f1;
function txt(ctx, s, x, y, col, al, bl, size, dpr) { ctx.font = (size || 11) * dpr + 'px ' + MONO; ctx.fillStyle = col; ctx.textAlign = al || 'left'; ctx.textBaseline = bl || 'alphabetic'; ctx.fillText(s, x, y); }
function niceStep(range, px, minPx) { const raw = range / Math.max(1, px / minPx), p = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p; return 10 * p; }

/* ===== S-scan / E-scan ===== */
PA.drawSector = function (cv, C, S, st) {
  const { W, H, dpr } = fit(cv), ctx = cv.getContext('2d'), cfg = C.cfg, T = C.T, dir = C.L.dir, list = C.L.list;
  ctx.fillStyle = '#15181c'; ctx.fillRect(0, 0, W, H);
  if (!list.length) { txt(ctx, 'Nenhuma lei focal válida', 12 * dpr, 24 * dpr, '#e9ecef', 'left', 'alphabetic', 13, dpr); return; }
  const fold = cfg.disp.fold;
  const zmaxU = Math.min(C.legs * T, C.range * Math.max(...list.map(l => l.cth)));
  const zTop = -(Math.max(...list.map(l => l.hc)) + cfg.probe.nAct * cfg.probe.pitch * Math.sin(cfg.wedge.angle * DEG) / 2 + 2), zBot = fold ? T + Math.max(2, C.W.botH + 1) : zmaxU + 1;
  const Lsel = list[st.law] || list[0], eA = C.L.el(Lsel.k0), eB = C.L.el(Lsel.k0 + Lsel.n - 1);
  let xs = [C.L.xf, eA.x, eB.x];
  list.forEach(L => { xs.push(L.xe); xs.push(L.xe + dir * (fold ? Math.min(C.range * L.sth, zmaxU * L.sth / L.cth) : zmaxU * L.sth / L.cth)); });
  if (C.W.capHalf) xs.push(-C.W.capHalf - 3, C.W.capHalf + 3);
  let xl = Math.min(...xs) - 2, xh = Math.max(...xs) + 2;
  
  const m = { l: 34 * dpr, r: 10 * dpr, t: 8 * dpr, b: 22 * dpr };
  { const kw = (W - m.l - m.r) / (xh - xl), want = Math.max(220, Math.min(460, Math.round(((zBot - zTop) * kw + m.t + m.b) / dpr))), fig = cv.parentElement;
    if (!cv.dataset.fixed && Math.abs(fig.clientHeight - want) > 6) { fig.style.height = want + 'px'; } }
  const k = Math.min((W - m.l - m.r) / (xh - xl), (H - m.t - m.b) / (zBot - zTop));
  const ox = m.l + ((W - m.l - m.r) - (xh - xl) * k) / 2, oy = m.t;
  const X = x => ox + (x - xl) * k, Z = z => oy + (z - zTop) * k;
  const key = [W, H, fold, C.id, cfg.scan.mode === 'E' ? st.law : ''].join('|');
  if (cv._key !== key) { cv._key = key; cv._map = buildMap(C, W, H, X, Z, k, xl, zTop, fold, zBot); }
  const M = cv._map, lut = lutOf(cfg), img = ctx.getImageData(0, 0, W, H), Dd = img.data, gm = st.gmul;
  for (let p = 0; p < M.n; p++) {
    const px = M.px[p]; let best = 0;
    for (let j = 0; j < M.nc; j++) {
      const f = M.f[p * M.nc + j]; if (f < 0) continue;
      const i0 = f | 0, i1 = Math.min(list.length - 1, i0 + 1), fr = f - i0, zu = M.zu[p * M.nc + j];
      const s0 = zu / list[i0].cth / C.DS, s1 = zu / list[i1].cth / C.DS;
      if (s0 >= C.NS - 1 || s1 >= C.NS - 1) continue;
      const a = S[i0].env, b = S[i1].env, q0 = s0 | 0, q1 = s1 | 0;
      const v = (a[q0] + (a[q0 + 1] - a[q0]) * (s0 - q0)) * (1 - fr) + (b[q1] + (b[q1 + 1] - b[q1]) * (s1 - q1)) * fr;
      if (v > best) best = v;
    }
    const c = Math.min(255, Math.max(0, best * gm * 255 | 0)) * 3, o = px * 4;
    Dd[o] = lut[c]; Dd[o + 1] = lut[c + 1]; Dd[o + 2] = lut[c + 2]; Dd[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const ink = darkPal(cfg) ? 'rgba(230,235,240,.75)' : '#5d6873';
  ctx.lineWidth = 1 * dpr;
  // superfícies
  ctx.strokeStyle = 'rgba(150,160,170,.5)'; ctx.setLineDash([4 * dpr, 4 * dpr]);
  const bands = fold ? [0, T] : Array.from({ length: C.legs + 1 }, (_, i) => i * T);
  bands.forEach(z => { ctx.beginPath(); ctx.moveTo(X(xl), Z(z)); ctx.lineTo(X(xh), Z(z)); ctx.stroke(); });
  ctx.setLineDash([]);
  // cunha e elementos
  ctx.save(); ctx.beginPath(); ctx.rect(m.l, 0, W - m.l, H - m.b); ctx.clip(); drawWedge2D(ctx, C, X, Z, dpr, st); ctx.restore();
  // sobreposição da solda
  if (cfg.disp.overlay && cfg.weld.type !== 'none') {
    ctx.strokeStyle = ink; ctx.lineWidth = 1.3 * dpr;
    const nb = fold ? 1 : C.legs;
    for (let b = 1; b <= nb; b++) {
      ctx.beginPath(); C.W.poly.forEach(([x, z], i) => { const zz = PA.unfold(z, b, T); i ? ctx.lineTo(X(x), Z(zz)) : ctx.moveTo(X(x), Z(zz)); }); ctx.closePath(); ctx.stroke();
      ctx.setLineDash([2 * dpr, 3 * dpr]); ctx.beginPath(); ctx.moveTo(X(0), Z((b - 1) * T)); ctx.lineTo(X(0), Z(b * T)); ctx.stroke(); ctx.setLineDash([]);
    }
    // cobertura
    if (st.showCov) { ctx.fillStyle = 'rgba(255,40,80,.45)'; const cs = .5 * k;
      C.cov.forEach(c => { if (!c[2]) ctx.fillRect(X(c[0]) - cs / 2, Z(c[1]) - cs / 2, cs, cs); }); }
  }
  // gate A (iso-percurso ou iso-profundidade)
  const g = cfg.disp.gate, gy = cfg.disp.gate.mode === 'depth';
  ctx.strokeStyle = '#d6c400'; ctx.lineWidth = 1.2 * dpr; ctx.setLineDash([6 * dpr, 4 * dpr]);
  for (const sv of [C.gs, C.ge]) {
    ctx.beginPath(); let started = false;
    list.forEach(L => { const s = gy ? sv / L.cth : sv; if (s > C.range) return; const zu = s * L.cth, x = L.xe + dir * s * L.sth, z = fold ? PA.fold(zu, T) : zu;
      if ((fold && zu > T) || zu > zBot) { started = false; return; }
      started ? ctx.lineTo(X(x), Z(z)) : (ctx.moveTo(X(x), Z(z)), started = true); });
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // defeitos (gabarito)
  if (!st.train && st.showDef) drawDefects2D(ctx, C, st.yp, X, Z, dpr, fold ? 1 : C.legs, k);
  // pontos focais
  if (cfg.scan.focus !== 'none') { ctx.fillStyle = 'rgba(255,255,255,.75)';
    list.forEach((L, i) => { if (i % Math.max(1, Math.round(list.length / 12))) return; const s = Math.min(L.Fs, C.range); if (!isFinite(s)) return;
      const zu = s * L.cth; if (fold && zu > T) return; ctx.fillRect(X(L.xe + dir * s * L.sth) - 1.5 * dpr, Z(zu) - 1.5 * dpr, 3 * dpr, 3 * dpr); }); }
  // lei selecionada
  const L = list[st.law];
  if (L) {
    ctx.strokeStyle = '#ff6a3d'; ctx.lineWidth = 1.6 * dpr; ctx.beginPath();
    ctx.moveTo(X(L.xc), Z(L.zc)); ctx.lineTo(X(L.xe), Z(0));
    const pts = rayPts(L, C, dir, fold); pts.forEach(p => ctx.lineTo(X(p[0]), Z(p[1]))); ctx.stroke();
    if (L.gl) { ctx.strokeStyle = 'rgba(255,80,220,.8)'; ctx.setLineDash([3 * dpr, 3 * dpr]); ctx.beginPath(); ctx.moveTo(X(L.xe), Z(0));
      const s = Math.min(C.range, T / Math.cos(L.gl.th)); ctx.lineTo(X(L.xe + dir * s * Math.sin(L.gl.th)), Z(s * Math.cos(L.gl.th))); ctx.stroke(); ctx.setLineDash([]); }
    if (st.peak && st.peak.ok) { const p = st.peak, zz = fold ? p.depth : p.zu; ctx.strokeStyle = darkPal(cfg) ? '#fff' : '#111'; ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath(); ctx.arc(X(p.x), Z(zz), 5 * dpr, 0, 7); ctx.stroke(); }
  }
  // eixos
  const xstep = niceStep(xh - xl, X(xh) - X(xl), 46 * dpr);
  for (let x = Math.ceil(xl / xstep) * xstep; x <= xh; x += xstep) { txt(ctx, (x > 0 ? '+' : '') + Math.round(x), X(x), H - 6 * dpr, '#9aa3ad', 'center', 'alphabetic', 11, dpr);
    ctx.fillStyle = '#4a525b'; ctx.fillRect(X(x), H - m.b + 2 * dpr, 1 * dpr, 4 * dpr); }
  const zstep = niceStep(zBot, Z(zBot) - Z(0), 28 * dpr);
  for (let z = 0; z <= zBot; z += zstep) txt(ctx, String(z), m.l - 6 * dpr, Z(z), '#9aa3ad', 'right', 'middle', 11, dpr);
  cv._geom = { X, Z, k, xl, zTop, dir, fold };
};
function rayPts(L, C, dir, fold) {
  const pts = [], T = C.T; let s = 0;
  for (let b = 1; b <= C.legs; b++) { const sb = Math.min(C.range, b * T / L.cth); const x = L.xe + dir * sb * L.sth, zu = sb * L.cth;
    pts.push([x, fold ? PA.fold(zu, T) : zu]); s = sb; if (sb >= C.range) break; }
  return pts;
}
PA.rayPts = rayPts;
function buildMap(C, W, H, X, Z, k, xl, zTop, fold, zBot) {
  const list = C.L.list, T = C.T, dir = C.L.dir, nc = fold ? C.legs : 1, n0 = W * H;
  const px = new Int32Array(n0), F = new Float32Array(n0 * nc), ZU = new Float32Array(n0 * nc); let n = 0;
  const tan = list.map(L => L.sth / L.cth), Xs = new Float64Array(list.length);
  const y0 = Math.max(0, Math.floor(Z(0))), y1 = Math.min(H - 1, Math.ceil(Z(zBot)));
  for (let py = y0; py <= y1; py++) {
    const zv = zTop + (py - Z(zTop)) / k; if (zv < 0) continue;
    const zus = fold ? [zv, 2 * T - zv, 2 * T + zv].slice(0, C.legs) : [zv];
    const rowF = [], rowOK = [];
    zus.forEach(zu => {
      for (let i = 0; i < list.length; i++) Xs[i] = list[i].xe + dir * zu * tan[i];
      const inc = Xs[list.length - 1] >= Xs[0];
      rowF.push({ zu, xs: Float64Array.from(Xs), inc, lo: Math.min(Xs[0], Xs[list.length - 1]), hi: Math.max(Xs[0], Xs[list.length - 1]) });
    });
    for (let pxx = 0; pxx < W; pxx++) {
      const x = xl + (pxx - X(xl)) / k; let any = false;
      for (let j = 0; j < zus.length; j++) {
        const R = rowF[j]; let f = -1;
        if ((fold && zus[j] > C.legs * T) || zus[j] / Math.min(...[list[0].cth, list[list.length - 1].cth]) > C.range * 1.3) { }
        if (x >= R.lo && x <= R.hi && list.length > 1) {
          let a = 0, b = list.length - 1;
          while (b - a > 1) { const mI = (a + b) >> 1; ((R.xs[mI] <= x) === R.inc) ? a = mI : b = mI; }
          const d = R.xs[b] - R.xs[a]; f = a + (Math.abs(d) > 1e-9 ? (x - R.xs[a]) / d : 0);
          const L0 = list[Math.min(list.length - 1, Math.round(f))]; if (R.zu / L0.cth > C.range) f = -1;
        } else if (list.length === 1 && Math.abs(x - R.xs[0]) < .6) f = 0;
        F[n * nc + j] = f; ZU[n * nc + j] = R.zu; if (f >= 0) any = true;
      }
      if (any) { px[n] = py * W + pxx; n++; }
    }
  }
  return { n, nc, px, f: F, zu: ZU };
}
function drawWedge2D(ctx, C, X, Z, dpr, st) {
  const cfg = C.cfg, wd = cfg.wedge, dir = C.L.dir, om = wd.angle * DEG, xf = C.L.xf;
  const h0 = wd.h1 - wd.u1 * Math.tan(om), hL = wd.h1 + (wd.len - wd.u1) * Math.tan(om);
  const P = [[0, 0], [wd.len, 0], [wd.len, hL], [0, Math.max(.5, h0)]].map(([u, h]) => [xf - dir * u, -h]);
  ctx.fillStyle = 'rgba(214,160,80,.22)'; ctx.strokeStyle = 'rgba(214,160,80,.8)'; ctx.lineWidth = 1 * dpr;
  ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Z(p[1])) : ctx.moveTo(X(p[0]), Z(p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
  const L = C.L.list[st.law];
  for (let e = 0; e < cfg.probe.nTot; e++) { const q = C.L.el(e), act = L && e >= L.k0 && e < L.k0 + L.n;
    ctx.fillStyle = act ? '#ff6a3d' : '#59616b'; ctx.fillRect(X(q.x) - 1.2 * dpr, Z(q.z) - 1.2 * dpr, 2.4 * dpr, 2.4 * dpr); }
}
function drawDefects2D(ctx, C, yp, X, Z, dpr, nb, k, all) {
  const T = C.T, cols = {}; C.cfg.defects.forEach(d => cols[d.id] = PA.DEF_TYPES[d.type].cor);
  C.prims.forEach(P => {
    if (P.def === 'geo' || P.hidden) return;
    if (!all && (yp < P.y1 - 2.5 || yp > P.y2 + 2.5)) return;
    ctx.strokeStyle = ctx.fillStyle = cols[P.def] || '#fff'; ctx.lineWidth = 2 * dpr;
    for (let b = 1; b <= nb; b++) {
      ctx.globalAlpha = b === 1 ? 1 : .55;
      if (P.kind === 'pt') { ctx.beginPath(); ctx.arc(X(P.x), Z(PA.unfold(P.z, b, T)), Math.max(1.6 * dpr, P.r * k), 0, 7); P.tip ? ctx.stroke() : ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(X(P.x1), Z(PA.unfold(P.z1, b, T))); ctx.lineTo(X(P.x2), Z(PA.unfold(P.z2, b, T))); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  });
}

/* ===== A-scan ===== */
PA.drawAscan = function (cv, C, S, st) {
  const { W, H, dpr } = fit(cv), ctx = cv.getContext('2d'), cfg = C.cfg, L = C.L.list[st.law];
  ctx.fillStyle = '#15181c'; ctx.fillRect(0, 0, W, H);
  if (!L) return;
  const rf = cfg.disp.rf, m = { l: 36 * dpr, r: (cfg.disp.corr === 'tcg' ? 34 : 10) * dpr, t: 8 * dpr, b: 22 * dpr }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const ax = cfg.disp.axis, conv = s => ax === 'depth' ? s * L.cth : ax === 'time' ? 2 * (L.tW + s / (C.L.v / 1000)) : s;
  const lo = conv(0), hi = conv(C.range), Xs = s => m.l + (conv(s) - lo) / (hi - lo) * pw;
  const Y = a => rf ? m.t + ph / 2 * (1 - Math.max(-1.04, Math.min(1.04, a))) : m.t + ph * (1 - Math.min(1.04, a));
  ctx.fillStyle = '#0d0f12'; ctx.fillRect(m.l, m.t, pw, ph);
  ctx.strokeStyle = '#262b31'; ctx.lineWidth = 1;
  const grid = rf ? [-1, -.5, 0, .5, 1] : [0, .2, .4, .6, .8, 1];
  grid.forEach(a => { ctx.beginPath(); ctx.moveTo(m.l, Y(a)); ctx.lineTo(m.l + pw, Y(a)); ctx.stroke(); txt(ctx, String(Math.round(a * 100)), m.l - 5 * dpr, Y(a), '#9aa3ad', 'right', 'middle', 11, dpr); });
  const step = niceStep(hi - lo, pw, 56 * dpr);
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) { const x = m.l + (v - lo) / (hi - lo) * pw; ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke();
    txt(ctx, String(Math.round(v * 10) / 10).replace('.', ','), x, H - 6 * dpr, '#9aa3ad', 'center', 'alphabetic', 11, dpr); }
  // pernas
  ctx.setLineDash([3 * dpr, 3 * dpr]); ctx.strokeStyle = '#59616b';
  for (let b = 1; b <= C.legs; b++) { const s = b * C.T / L.cth; if (s > C.range) break; const x = Xs(s); ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke(); txt(ctx, b + 'T', x + 3 * dpr, m.t + 12 * dpr, '#7d8792', 'left', 'alphabetic', 11, dpr); }
  ctx.setLineDash([]);
  // TCG
  if (cfg.disp.corr === 'tcg') {
    const K = L.K, k0 = K[Math.min(C.NS - 1, Math.round((C.T / 2 / L.cth) / C.DS))];
    ctx.strokeStyle = 'rgba(120,200,255,.7)'; ctx.setLineDash([5 * dpr, 3 * dpr]); ctx.beginPath();
    for (let k = 0; k < C.NS; k += 4) { const db = 20 * Math.log10(K[k] / k0), y = m.t + ph * (1 - (db + 10) / 50); const x = Xs(k * C.DS); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
    [-10, 0, 20, 40].forEach(db => txt(ctx, (db > 0 ? '+' : '') + db, W - 4 * dpr, m.t + ph * (1 - (db + 10) / 50), 'rgba(120,200,255,.85)', 'right', 'middle', 10, dpr));
  }
  // sinal
  const n = rf ? 3000 : C.NS, ds = C.range / n, sig = rf ? PA.synth(C, S[st.law].ev, L, n, ds, true) : S[st.law].env, gm = st.gmul;
  ctx.strokeStyle = '#5fd38d'; ctx.lineWidth = 1.2 * dpr; ctx.beginPath();
  for (let k = 0; k < n; k++) { const x = Xs(k * ds), y = Y(sig[k] * gm); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
  // gate A
  const g = cfg.disp.gate, gy = g.mode === 'depth', gsP = gy ? C.gs / L.cth : C.gs, geP = Math.min(C.range, gy ? C.ge / L.cth : C.ge);
  const yt = Y(g.thr / 100); ctx.strokeStyle = '#d6c400'; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.moveTo(Xs(gsP), yt); ctx.lineTo(Xs(geP), yt); ctx.stroke();
  txt(ctx, 'A', Xs(gsP) + 2 * dpr, yt - 4 * dpr, '#d6c400', 'left', 'alphabetic', 11, dpr);
  if (st.peak && st.peak.ok) { ctx.fillStyle = '#ff6a3d'; ctx.beginPath(); ctx.arc(Xs(st.peak.s), Y(Math.min(1.04, st.peak.a)), 3.5 * dpr, 0, 7); ctx.fill(); }
};

/* pico no gate A da lei selecionada */
PA.peak = function (C, S, st) {
  const L = C.L.list[st.law]; if (!L) return null;
  const env = S[st.law].env, g = C.cfg.disp.gate, gy = g.mode === 'depth';
  const a0 = Math.max(0, Math.floor((gy ? C.gs / L.cth : C.gs) / C.DS)), a1 = Math.min(C.NS - 1, Math.ceil(Math.min(gy ? C.ge / L.cth : C.ge, C.legs * C.T / L.cth) / C.DS));
  let mx = 0, kk = a0; for (let k = a0; k <= a1; k++) if (env[k] > mx) { mx = env[k]; kk = k; }
  const a = mx * st.gmul, s = kk * C.DS, zu = s * L.cth, depth = PA.fold(zu, C.T), x = L.xe + C.L.dir * s * L.sth;
  return { a, s, zu, depth, x, leg: Math.max(1, Math.floor((zu - .3) / C.T) + 1), ok: a * 100 >= g.thr, L };
};

/* ===== vistas de volume ===== */
function heat(ctx, data, nx, ny, W, H, m, map, gm, lut) {
  const pw = Math.max(1, Math.round(W - m.l - m.r)), ph = Math.max(1, Math.round(H - m.t - m.b)), img = ctx.createImageData(pw, ph), D = img.data;
  for (let py = 0; py < ph; py++) for (let px = 0; px < pw; px++) {
    const idx = map(px / pw, py / ph), o = (py * pw + px) * 4;
    if (idx === -2) { D[o] = 38; D[o + 1] = 42; D[o + 2] = 48; D[o + 3] = 255; continue; }
    const v = idx < 0 ? 0 : data[idx] * gm, c = Math.min(255, Math.max(0, v * 255 | 0)) * 3;
    D[o] = lut[c]; D[o + 1] = lut[c + 1]; D[o + 2] = lut[c + 2]; D[o + 3] = 255; }
  ctx.putImageData(img, Math.round(m.l), Math.round(m.t));
  return { pw, ph };
}
PA.drawTop = function (cv, C, V, st) {
  const { W, H, dpr } = fit(cv), ctx = cv.getContext('2d'), cfg = C.cfg, m = { l: 36 * dpr, r: 10 * dpr, t: 8 * dpr, b: 20 * dpr };
  ctx.fillStyle = '#15181c'; ctx.fillRect(0, 0, W, H);
  const lenY = C.len, Yp = y => m.l + y / lenY * (W - m.l - m.r), Xp = x => m.t + (H - m.t - m.b) * (1 - (x + C.XR) / (2 * C.XR));
  if (V) heat(ctx, V.top, V.nx, V.ny, W, H, m, (u, v) => { const yi = Math.min(V.ny - 1, Math.floor(u * V.ny)), xb = Math.min(V.nx - 1, Math.floor((1 - v) * V.nx)); if (V.vis && !V.vis[yi]) return -2; return yi * V.nx + xb; }, st.gmul, lutOf(cfg));
  const ink = darkPal(cfg) ? 'rgba(230,235,240,.6)' : 'rgba(20,24,30,.55)';
  ctx.strokeStyle = ink; ctx.lineWidth = 1 * dpr;
  const lines = cfg.weld.type === 'none' ? [0] : [-C.W.capHalf, -C.W.g2, 0, C.W.g2, C.W.capHalf];
  lines.forEach((x, i) => { ctx.setLineDash(x === 0 ? [2 * dpr, 3 * dpr] : [5 * dpr, 4 * dpr]); ctx.beginPath(); ctx.moveTo(m.l, Xp(x)); ctx.lineTo(W - m.r, Xp(x)); ctx.stroke(); });
  ctx.setLineDash([]);
  [-20, -10, 0, 10, 20].filter(x => Math.abs(x) < C.XR).forEach(x => txt(ctx, (x > 0 ? '+' : '') + x, m.l - 5 * dpr, Xp(x), '#9aa3ad', 'right', 'middle', 11, dpr));
  axisY(ctx, W, H, m, Yp, lenY, dpr);
  overlayY(ctx, C, st, m, H, Yp, dpr);
  cv._geom = { m, W, lenY, dpr };
};
PA.drawSide = function (cv, C, V, st) {
  const { W, H, dpr } = fit(cv), ctx = cv.getContext('2d'), cfg = C.cfg, m = { l: 36 * dpr, r: 10 * dpr, t: 8 * dpr, b: 20 * dpr };
  ctx.fillStyle = '#15181c'; ctx.fillRect(0, 0, W, H);
  const lenY = C.len, Yp = y => m.l + y / lenY * (W - m.l - m.r), Zp = z => m.t + (H - m.t - m.b) * z / C.T;
  if (V) heat(ctx, V.side, V.nz, V.ny, W, H, m, (u, v) => { const yi = Math.min(V.ny - 1, Math.floor(u * V.ny)), zb = Math.min(V.nz - 1, Math.floor(v * V.nz)); if (V.vis && !V.vis[yi]) return -2; return yi * V.nz + zb; }, st.gmul, lutOf(cfg));
  const step = niceStep(C.T, H - m.t - m.b, 22 * dpr);
  for (let z = 0; z <= C.T + 1e-6; z += step) txt(ctx, String(z), m.l - 5 * dpr, Zp(z), '#9aa3ad', 'right', 'middle', 11, dpr);
  axisY(ctx, W, H, m, Yp, lenY, dpr);
  overlayY(ctx, C, st, m, H, Yp, dpr);
  cv._geom = { m, W, lenY, dpr };
};
PA.drawEnd = function (cv, C, V, st) {
  const { W, H, dpr } = fit(cv), ctx = cv.getContext('2d'), cfg = C.cfg, m = { l: 34 * dpr, r: 8 * dpr, t: 8 * dpr, b: 20 * dpr };
  ctx.fillStyle = '#15181c'; ctx.fillRect(0, 0, W, H);
  const pwA = W - m.l - m.r, phA = H - m.t - m.b, k = Math.min(pwA / (2 * C.XR), phA / C.T);
  const pw = 2 * C.XR * k, ph = C.T * k, mm = { l: m.l + (pwA - pw) / 2, r: W - (m.l + (pwA - pw) / 2) - pw, t: m.t, b: H - m.t - ph };
  const Xp = x => mm.l + (x + C.XR) * k, Zp = z => mm.t + z * k;
  if (V) heat(ctx, V.end, V.nx, V.nz, W, H, mm, (u, v) => { const xb = Math.min(V.nx - 1, Math.floor(u * V.nx)), zb = Math.min(V.nz - 1, Math.floor(v * V.nz)); return zb * V.nx + xb; }, st.gmul, lutOf(cfg));
  const ink = darkPal(cfg) ? 'rgba(230,235,240,.75)' : 'rgba(20,24,30,.8)';
  if (cfg.weld.type !== 'none' && cfg.disp.overlay) {
    ctx.save(); ctx.beginPath(); ctx.rect(mm.l, mm.t, pw, ph); ctx.clip();
    ctx.strokeStyle = ink; ctx.lineWidth = 1.3 * dpr; ctx.beginPath(); C.W.poly.forEach(([x, z], i) => i ? ctx.lineTo(Xp(x), Zp(z)) : ctx.moveTo(Xp(x), Zp(z))); ctx.closePath(); ctx.stroke();
    if (st.showCov) { ctx.fillStyle = 'rgba(255,40,80,.45)'; C.cov.forEach(c => { if (!c[2]) ctx.fillRect(Xp(c[0]) - .25 * k, Zp(c[1]) - .25 * k, .5 * k, .5 * k); }); }
    ctx.restore();
  }
  if (!st.train && st.showDef) { ctx.save(); ctx.beginPath(); ctx.rect(mm.l, mm.t, pw, ph); ctx.clip(); drawDefects2D(ctx, C, -1e9, Xp, Zp, dpr, 1, k, true); ctx.restore(); }
  [-20, -10, 0, 10, 20].filter(x => Math.abs(x) < C.XR).forEach(x => txt(ctx, (x > 0 ? '+' : '') + x, Xp(x), H - 5 * dpr, '#9aa3ad', 'center', 'alphabetic', 11, dpr));
  const step = niceStep(C.T, ph, 22 * dpr);
  for (let z = 0; z <= C.T + 1e-6; z += step) txt(ctx, String(z), mm.l - 5 * dpr, Zp(z), '#9aa3ad', 'right', 'middle', 11, dpr);
};
function axisY(ctx, W, H, m, Yp, lenY, dpr) {
  const step = niceStep(lenY, W - m.l - m.r, 60 * dpr);
  for (let y = 0; y <= lenY + 1e-6; y += step) txt(ctx, String(y), Math.min(Yp(y), W - m.r - 10 * dpr), H - 5 * dpr, '#9aa3ad', 'center', 'alphabetic', 11, dpr);
}
function overlayY(ctx, C, st, m, H, Yp, dpr) {
  if (!st.train && st.showDef) C.cfg.defects.forEach(d => { if (!d.on) return; ctx.fillStyle = PA.DEF_TYPES[d.type].cor; ctx.fillRect(Yp(d.y), m.t, Math.max(2 * dpr, Yp(d.y + d.comp) - Yp(d.y)), 3 * dpr); });
  if (st.y1 != null) { ctx.strokeStyle = '#7ad3ff'; ctx.lineWidth = 1.3 * dpr; ctx.beginPath(); ctx.moveTo(Yp(st.y1), m.t); ctx.lineTo(Yp(st.y1), H - m.b); ctx.stroke(); }
  if (st.y2 != null) { ctx.strokeStyle = '#7ad3ff'; ctx.setLineDash([4 * dpr, 3 * dpr]); ctx.beginPath(); ctx.moveTo(Yp(st.y2), m.t); ctx.lineTo(Yp(st.y2), H - m.b); ctx.stroke(); ctx.setLineDash([]); }
  ctx.strokeStyle = '#ff6a3d'; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.moveTo(Yp(st.yp), m.t); ctx.lineTo(Yp(st.yp), H - m.b); ctx.stroke();
}
/* comprimento a −6 dB a partir da vista de topo */
PA.length6dB = function (C, V, yp, xPeak) {
  if (!V) return null;
  const xb = Math.floor((xPeak + C.XR) / C.dx), w = Math.round(4 / C.dx), col = y => { let m = 0; for (let b = Math.max(0, xb - w); b <= Math.min(V.nx - 1, xb + w); b++) m = Math.max(m, V.top[y * V.nx + b]); return m; };
  const yi = Math.min(V.ny - 1, Math.round(yp / C.dy)); let pk = yi, pv = col(yi);
  for (let d = -6; d <= 6; d++) { const j = yi + d; if (j >= 0 && j < V.ny && col(j) > pv) { pv = col(j); pk = j; } }
  if (pv <= 0) return null;
  let a = pk, b = pk; while (a > 0 && col(a - 1) >= pv / 2) a--; while (b < V.ny - 1 && col(b + 1) >= pv / 2) b++;
  return { y1: a * C.dy, y2: b * C.dy, len: (b - a + 1) * C.dy };
};
})();
