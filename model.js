/* Simulador PAUT: modelo físico (raios + feixe gaussiano) */
(function () {
'use strict';
const PA = window.PA = window.PA || {};
const DEG = Math.PI / 180, SQ2 = Math.SQRT2;
PA.DEG = DEG;

PA.erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + .3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x)); };
PA.rng = seed => { let h = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (h = h * 16807 % 2147483647) / 2147483647; };
const unfold = (z, k, T) => k === 1 ? z : k === 2 ? 2 * T - z : 2 * T + z;
const fold = (zu, T) => { const m = ((zu % (2 * T)) + 2 * T) % (2 * T); return m <= T ? m : 2 * T - m; };
PA.fold = fold; PA.unfold = unfold;

PA.MATERIALS = {
  'aco-carbono': { nome: 'Aço carbono', vL: 5920, vT: 3240, grain: 25, absorp: .0015, aniso: false },
  'aco-baixa-liga': { nome: 'Aço baixa liga (Cr-Mo)', vL: 5900, vT: 3230, grain: 30, absorp: .0018, aniso: false },
  'inox-austenitico': { nome: 'Inox austenítico (304/316)', vL: 5740, vT: 3130, grain: 120, absorp: .003, aniso: true },
  'duplex': { nome: 'Inox duplex', vL: 5800, vT: 3200, grain: 50, absorp: .0025, aniso: false },
  'niquel': { nome: 'Liga de níquel (625)', vL: 5820, vT: 3020, grain: 100, absorp: .003, aniso: true },
  'aluminio': { nome: 'Alumínio', vL: 6320, vT: 3130, grain: 60, absorp: .0008, aniso: false }
};
PA.WEDGE_MATS = { rexolite: { nome: 'Rexolite', v: 2330 }, acrilico: { nome: 'Acrílico', v: 2730 }, polisulfona: { nome: 'Polisulfona', v: 2240 } };

/* tipos de defeito: [chave, rótulo, padrão, unidade, min, max, passo] ou [chave, rótulo, padrão, 'sel', opções] */
const LADO = [['esq', 'Esquerdo'], ['dir', 'Direito']];
PA.DEF_TYPES = {
  'trinca-raiz': { nome: 'Trinca na raiz', cor: '#ff4d6d', p: [['h', 'Altura', 3, 'mm', .5, 30, .5], ['x', 'Posição X', .5, 'mm', -20, 20, .1], ['incl', 'Inclinação', 0, '°', -45, 45, 1]] },
  'trinca-superficie': { nome: 'Trinca na margem', cor: '#ff8fa3', p: [['lado', 'Lado', 'dir', 'sel', LADO], ['h', 'Altura', 2, 'mm', .3, 20, .1], ['incl', 'Inclinação', 0, '°', -45, 45, 1]] },
  'trinca-interna': { nome: 'Trinca interna', cor: '#e5383b', p: [['h', 'Altura', 3, 'mm', .5, 30, .5], ['x', 'Posição X', 0, 'mm', -20, 20, .1], ['z', 'Profundidade do centro', 10, 'mm', 1, 80, .5], ['incl', 'Inclinação', 10, '°', -60, 60, 1]] },
  'trinca-transversal': { nome: 'Trinca transversal', cor: '#ffb3c1', p: [['h', 'Altura', 4, 'mm', .5, 30, .5], ['z', 'Profundidade do topo', 4, 'mm', 0, 80, .5]] },
  'lof-bisel': { nome: 'Falta de fusão no bisel', cor: '#ffd23f', p: [['lado', 'Lado', 'esq', 'sel', LADO], ['z1', 'Profundidade inicial', 5, 'mm', 0, 80, .5], ['z2', 'Profundidade final', 12, 'mm', 0, 80, .5]] },
  'lof-entrepasses': { nome: 'Falta de fusão entre passes', cor: '#f9c74f', p: [['z', 'Profundidade', 8, 'mm', 1, 80, .5], ['x', 'Centro X', 0, 'mm', -20, 20, .1], ['larg', 'Largura', 6, 'mm', 1, 30, .5]] },
  'lop': { nome: 'Falta de penetração', cor: '#c77dff', p: [['lado', 'Face sem fusão', 'ambos', 'sel', [['ambos', 'Ambas'], ['esq', 'Esquerda'], ['dir', 'Direita']]]] },
  'poro': { nome: 'Poro isolado', cor: '#3fc1ff', p: [['d', 'Diâmetro', 1.5, 'mm', .2, 6, .1], ['x', 'Posição X', 0, 'mm', -20, 20, .1], ['z', 'Profundidade', 10, 'mm', .5, 80, .5]] },
  'poro-agrupado': { nome: 'Porosidade agrupada', cor: '#4cc9f0', p: [['n', 'Quantidade', 9, '', 2, 40, 1], ['d', 'Diâmetro médio', 1, 'mm', .2, 4, .1], ['x', 'Centro X', 0, 'mm', -20, 20, .1], ['z', 'Profundidade', 9, 'mm', .5, 80, .5], ['raio', 'Raio do grupo', 3, 'mm', .5, 10, .5]] },
  'escoria': { nome: 'Inclusão de escória', cor: '#7ae582', p: [['x', 'Centro X', 1, 'mm', -20, 20, .1], ['z', 'Profundidade', 10, 'mm', 1, 80, .5], ['h', 'Altura', 1.5, 'mm', .3, 6, .1]] },
  'mordedura': { nome: 'Mordedura', cor: '#ff9f1c', p: [['lado', 'Lado', 'dir', 'sel', LADO], ['prof', 'Profundidade', .8, 'mm', .1, 3, .1]] },
  'sdh': { nome: 'Furo lateral (SDH)', cor: '#ced4da', p: [['d', 'Diâmetro', 2, 'mm', .5, 6, .1], ['x', 'Posição X', 0, 'mm', -60, 60, .5], ['z', 'Profundidade', 10, 'mm', 1, 80, .5]] }
};
PA.newDefect = (type, y, comp, over) => {
  const t = PA.DEF_TYPES[type], d = { id: 'd' + Math.random().toString(36).slice(2, 8), type, y, comp, on: true };
  t.p.forEach(q => d[q[0]] = q[2]); return Object.assign(d, over || {});
};

/* ---------- geometria da solda ---------- */
PA.weld = function (w) {
  const T = w.T, tb = Math.tan(w.bevel * DEG), g2 = w.gap / 2, RF = Math.min(w.rootFace, T * .8);
  const G = { T, type: w.type, len: w.len };
  if (w.type === 'none') {
    Object.assign(G, { half: () => 0, inside: () => false, capHalf: 0, capH: 0, botHalf: 0, botH: 0, topHalf: 0, poly: [], zs: [0, T], landA: T, landB: T, g2: 0 });
    return G;
  }
  let zs;
  if (w.type === 'X') {
    const m = T * w.xMid, a = Math.max(.5, m - RF / 2), b = Math.min(T - .5, m + RF / 2);
    G.mid = m; G.landA = a; G.landB = b; zs = [0, a, b, T];
    G.half = z => z < a ? g2 + (a - z) * tb : z > b ? g2 + (z - b) * tb : g2;
  } else {
    const a = T - RF; G.landA = a; G.landB = T; zs = [0, a, T];
    G.half = z => z < a ? g2 + (a - z) * tb : g2;
  }
  G.g2 = g2; G.zs = zs;
  G.topHalf = G.half(0); G.capHalf = G.topHalf + w.capOver; G.capH = w.capH;
  if (w.type === 'X') { G.botHalf = G.half(T) + w.capOver; G.botH = w.capH; }
  else { G.botHalf = g2 + w.rootOver; G.botH = w.rootH; }
  G.inside = (x, z) => z >= 0 && z <= T && Math.abs(x) <= G.half(z);
  const P = [], n = 20;
  for (let i = 0; i <= n; i++) { const t = i / n; P.push([-G.capHalf + 2 * G.capHalf * t, -G.capH * Math.sin(Math.PI * t)]); }
  zs.forEach(z => P.push([G.half(z), z]));
  for (let i = 0; i <= n; i++) { const t = i / n; P.push([G.botHalf - 2 * G.botHalf * t, T + G.botH * Math.sin(Math.PI * t)]); }
  zs.slice().reverse().forEach(z => P.push([-G.half(z), z]));
  G.poly = P;
  return G;
};

/* ---------- leis focais ---------- */
PA.laws = function (cfg) {
  const p = cfg.probe, wd = cfg.wedge, sc = cfg.scan, mat = cfg.mat;
  const v = sc.wave === 'L' ? mat.vL : mat.vT, vW = wd.vW, f = p.f;
  const lam = v / (f * 1000), lamW = vW / (f * 1000), om = wd.angle * DEG, dir = +sc.side;
  const xf = -dir * sc.index;
  const el = k => { const u = wd.u1 + k * p.pitch * Math.cos(om), h = wd.h1 + k * p.pitch * Math.sin(om); return { u, h, x: xf - dir * u, z: -h }; };
  const e = .9 * p.pitch, sinc = x => Math.abs(x) < 1e-6 ? 1 : Math.sin(x) / x;
  const Del = b => Math.abs(sinc(Math.PI * e * Math.sin(b) / lamW)) * Math.max(0, Math.cos(b));
  const ac1 = vW < mat.vL ? Math.asin(vW / mat.vL) : Math.PI / 2, ac2 = vW < mat.vT ? Math.asin(vW / mat.vT) : Math.PI / 2;
  const thc = Math.asin(mat.vT / mat.vL);
  const Tc = th => sc.wave === 'L' ? .9 * Math.sqrt(Math.max(0, Math.cos(th))) :
    (th <= thc ? .05 : Math.pow((th - thc) / (Math.PI / 2 - thc), .4) * Math.pow(Math.cos(th), .6) * 1.9);
  const warn = new Set();
  const mk = (th, k0, n) => {
    const sa = vW / v * Math.sin(th); if (Math.abs(sa) >= 1) { warn.add('Ângulo acima do 2º ângulo crítico: lei descartada.'); return null; }
    const al = Math.asin(sa), be = al - om;
    let uc = 0, hc = 0; for (let k = k0; k < k0 + n; k++) { const q = el(k); uc += q.u; hc += q.h; } uc /= n; hc /= n;
    const xc = xf - dir * uc, xe = xc + dir * hc * Math.tan(al), wpath = hc / Math.cos(al);
    const Da = n * p.pitch, Deff = Math.max(.5, Da * Math.cos(be) * Math.cos(th) / Math.cos(al)), a = Deff / 2;
    const sw = wpath * (vW / v) * (Math.cos(th) ** 2) / (Math.cos(al) ** 2), swe = wpath * vW / v;
    const N = Deff * Deff / (4 * lam);
    const Fs = sc.focus === 'depth' ? sc.fVal / Math.cos(th) : sc.focus === 'path' ? sc.fVal : Infinity;
    const gfoc = (rad, F) => { const z0 = Math.PI * rad * rad / lam; if (!isFinite(F)) return [rad, 0, z0]; const w = rad / Math.sqrt(1 + (z0 / F) ** 2), zw = F / (1 + (F / z0) ** 2); return [w, zw, Math.PI * w * w / lam]; };
    const [w0, Fe, zR] = gfoc(a, Fs + sw);
    const b = p.elev / 2, [we0, Fee, zRe] = gfoc(b, Infinity);
    const ang = (Tc(th) * Del(be)) ** 2;
    let gl = null;
    for (const m of [1, -1]) {
      const sb = Math.sin(be) - m * lamW / p.pitch; if (Math.abs(sb) >= 1) continue;
      const bg = Math.asin(sb), ag = om + bg; if (ag <= .02) continue;
      const stg = v / vW * Math.sin(ag); if (stg >= 1) continue;
      const tg = Math.asin(stg), g = Del(bg) / Math.max(1e-3, Del(be)), gg = Math.min(1, g * g * (Tc(tg) / Math.max(.05, Tc(th))) ** 2);
      if (!gl || gg > gl.g) gl = { th: tg, g: gg };
    }
    if (gl && gl.g < .015) gl = null;
    if (sc.wave === 'T' && al < ac1) warn.add('Incidência abaixo do 1º ângulo crítico: a onda longitudinal também entra na peça.');
    if ((xe - xf) * dir > .5) warn.add('Ponto de saída à frente da cunha em alguns ângulos.');
    return { th, al, be, xe, xc, zc: -hc, uc, hc, wpath, tW: wpath / (vW / 1000), Deff, a, N, Fe, Fs, sw, swe, w0, zR, b, we0, zRe, Fee, ang, gl, k0, n, cth: Math.cos(th), sth: Math.sin(th) };
  };
  const list = [];
  if (p.first - 1 + p.nAct > p.nTot) warn.add('A abertura passa do último elemento do cabeçote.');
  if (sc.mode === 'S') {
    const a0 = Math.min(sc.a0, sc.a1), a1 = Math.max(sc.a0, sc.a1), st = Math.max(.1, sc.astep);
    for (let a = a0; a <= a1 + 1e-6; a += st) { const L = mk(a * DEG, Math.max(0, p.first - 1), Math.min(p.nAct, p.nTot)); if (L) list.push(L); }
  } else {
    const th = sc.eAng * DEG;
    for (let k0 = 0; k0 + p.nAct <= p.nTot; k0 += Math.max(1, sc.eStep)) { const L = mk(th, k0, p.nAct); if (L) list.push(L); }
  }
  list.forEach((L, i) => {
    L.i = i;
    L.wa = s => { const q = s + L.sw - L.Fe; return L.w0 * Math.sqrt(1 + (q / L.zR) ** 2); };
    L.we = s => { const q = s + L.swe - L.Fee; return L.we0 * Math.sqrt(1 + (q / L.zRe) ** 2); };
  });
  if (list.some(L => L.gl)) warn.add('Lóbulo de grade presente: pitch grande para esta frequência e deflexão.');
  const thNat = Math.asin(Math.min(1, v / vW * Math.sin(om)));
  return { list, v, vW, lam, lamW, dir, xf, el, ac1, ac2, thc, Del, Tc, om, thNat, warn: [...warn] };
};

/* ---------- atenuação e ruído ---------- */
PA.atten = function (cfg) {
  const f = cfg.probe.f, g = cfg.mat.grain / 25, ff = f / 5, L = cfg.scan.wave === 'L';
  const R = .008 * g ** 3 * ff ** 4, S = .03 * g * ff ** 2;
  let scat = 1 / (1 / R + 1 / S); if (L) scat *= .3;
  return { a: cfg.mat.absorp * f + scat, scat, noise: .008 * Math.pow(scat / .0063, .35),
    weldA: cfg.mat.aniso ? (L ? .015 : .05) * ff : 0, weldN: cfg.mat.aniso ? (L ? 1.4 : 2) : 1 };
};

/* ---------- refletores ---------- */
PA.prims = function (cfg, W) {
  const w = cfg.weld, T = w.T, out = [];
  const pt = o => out.push(Object.assign({ kind: 'pt', vis: 0, legs: null, ph: Math.PI, r: .5 }, o));
  const fc = o => out.push(Object.assign({ kind: 'fac', vis: 0, legs: null, corner: null, R: .35, Rc: 1.0, ph: Math.PI }, o));
  if (cfg.disp.geo && w.type !== 'none') {
    for (const s of [1, -1]) {
      pt({ def: 'geo', x: s * W.botHalf * .8, z: T + W.botH * .55, y1: 0, y2: w.len, R: w.type === 'X' ? .2 : .35, legs: [1, 3], vis: s, r: .6 });
      pt({ def: 'geo', x: s * (W.capHalf - .6), z: -W.capH * .5, y1: 0, y2: w.len, R: .18, legs: [2], vis: s, r: .6 });
    }
    if (w.hilo) { const s = Math.sign(w.hilo), h = Math.abs(w.hilo);
      pt({ def: 'geo', x: s * (W.g2 + .6), z: T + h * .8, y1: 0, y2: w.len, R: .25 + .2 * h, legs: [1, 3], vis: s, r: .6 }); }
  }
  for (const d of cfg.defects) {
    if (!d.on) continue;
    const y1 = d.y, y2 = d.y + d.comp, id = d.id, sd = d.lado === 'dir' ? 1 : -1;
    const r = PA.rng(parseInt(id.replace(/\D/g, '') || '7', 10) * 31 + d.y * 7 + 3);
    switch (d.type) {
      case 'trinca-raiz': {
        const zb = w.type === 'X' ? W.landB : T, h = Math.min(d.h, zb - .3), x2 = d.x + h * Math.tan(d.incl * DEG);
        fc({ def: id, x1: d.x, z1: zb, x2, z2: zb - h, y1, y2, R: 2.4, corner: w.type === "X" ? null : "bot", rough: 1 });
        pt({ def: id, x: x2, z: zb - h, y1: y1 + 1, y2: y2 - 1, R: .15, ph: 0, r: .3, tip: 1 });
        if (w.type === 'X') pt({ def: id, x: d.x, z: zb, y1: y1 + 1, y2: y2 - 1, R: .15, ph: 0, r: .3, tip: 1 });
        break; }
      case 'trinca-superficie': {
        const x0 = w.type === 'none' ? 0 : sd * W.capHalf, h = Math.min(d.h, T - .5), x2 = x0 + sd * h * Math.tan(d.incl * DEG);
        fc({ def: id, x1: x0, z1: 0, x2, z2: h, y1, y2, R: 2.4, corner: "top", rough: 1 });
        pt({ def: id, x: x2, z: h, y1: y1 + 1, y2: y2 - 1, R: .15, ph: 0, r: .3, tip: 1 });
        break; }
      case 'trinca-interna': {
        const h = Math.min(d.h, T - 1), z = Math.min(Math.max(d.z, h / 2 + .3), T - h / 2 - .3), dx = h / 2 * Math.tan(d.incl * DEG);
        fc({ def: id, x1: d.x - dx, z1: z + h / 2, x2: d.x + dx, z2: z - h / 2, y1, y2, R: 2.4, rough: 1 });
        pt({ def: id, x: d.x + dx, z: z - h / 2, y1: y1 + 1, y2: y2 - 1, R: .15, ph: 0, r: .3, tip: 1 });
        pt({ def: id, x: d.x - dx, z: z + h / 2, y1: y1 + 1, y2: y2 - 1, R: .15, ph: 0, r: .3, tip: 1 });
        break; }
      case 'trinca-transversal': {
        const z0 = Math.min(d.z, T - .5), z1 = Math.min(T, z0 + d.h), yy2 = y1 + Math.min(d.comp, 2);
        for (let z = z0; z <= z1 + 1e-6; z += Math.max(1, (z1 - z0) / 4)) {
          const hw = Math.max(1, W.half ? W.half(z) : 3);
          for (let x = -hw; x <= hw + 1e-6; x += 1.5) pt({ def: id, x, z, y1, y2: yy2, R: .07, ph: 0, r: .25, trans: 1 });
        }
        break; }
      case 'lof-bisel': {
        let z1 = Math.max(0, Math.min(d.z1, d.z2)), z2 = Math.min(T, Math.max(d.z1, d.z2)); if (z2 - z1 < .3) z2 = Math.min(T, z1 + .3);
        const hx = z => w.type === 'none' ? 0 : sd * W.half(z), cut = W.zs.filter(z => z > z1 && z < z2), zz = [z1, ...cut, z2];
        for (let i = 0; i < zz.length - 1; i++) fc({ def: id, x1: hx(zz[i]), z1: zz[i], x2: hx(zz[i + 1]), z2: zz[i + 1], y1, y2, R: .5, rough: .04, corner: zz[i + 1] >= T - .01 && w.type === 'V' ? 'bot' : null });
        pt({ def: id, x: hx(z1), z: z1, y1: y1 + 1, y2: y2 - 1, R: .12, ph: 0, r: .3, tip: 1 });
        pt({ def: id, x: hx(z2), z: z2, y1: y1 + 1, y2: y2 - 1, R: .12, ph: 0, r: .3, tip: 1 });
        break; }
      case 'lof-entrepasses': {
        const z = Math.min(Math.max(d.z, .5), T - .5);
        fc({ def: id, x1: d.x - d.larg / 2, z1: z, x2: d.x + d.larg / 2, z2: z, y1, y2, R: .5, rough: .05 });
        pt({ def: id, x: d.x - d.larg / 2, z, y1: y1 + 1, y2: y2 - 1, R: .2, ph: 0, r: .3, tip: 1 });
        pt({ def: id, x: d.x + d.larg / 2, z, y1: y1 + 1, y2: y2 - 1, R: .2, ph: 0, r: .3, tip: 1 });
        break; }
      case 'lop': {
        if (w.type === 'none') break;
        const g = Math.max(.15, W.g2), sides = d.lado === 'ambos' ? [-1, 1] : [d.lado === 'dir' ? 1 : -1];
        for (const s of sides) {
          const vis = -s;
          if (w.type === 'X') {
            fc({ def: id, x1: s * g, z1: W.landB, x2: s * g, z2: W.landA, y1, y2, R: .5, rough: .12, vis });
            pt({ def: id, x: s * g, z: W.landA, y1: y1 + 1, y2: y2 - 1, R: .15, ph: 0, r: .3, vis, tip: 1 });
            pt({ def: id, x: s * g, z: W.landB, y1: y1 + 1, y2: y2 - 1, R: .15, ph: 0, r: .3, vis, tip: 1 });
          } else {
            fc({ def: id, x1: s * g, z1: T, x2: s * g, z2: W.landA, y1, y2, R: .5, rough: .12, corner: 'bot', vis });
            pt({ def: id, x: s * g, z: W.landA, y1: y1 + 1, y2: y2 - 1, R: .15, ph: 0, r: .3, vis, tip: 1 });
          }
        }
        break; }
      case 'poro': { const yc = y1 + d.comp / 2; pt({ def: id, x: d.x, z: Math.min(Math.max(d.z, d.d / 2), T - d.d / 2), y1: yc, y2: yc, R: .45 * d.d / 2, r: d.d / 2 }); break; }
      case 'poro-agrupado': {
        for (let i = 0; i < d.n; i++) {
          let a, b, c; do { a = r() * 2 - 1; b = r() * 2 - 1; c = r() * 2 - 1; } while (a * a + b * b > 1);
          const dd = d.d * (.6 + r() * .8), yc = y1 + d.comp * (.5 + .5 * c);
          pt({ def: id, x: d.x + a * d.raio, z: Math.min(Math.max(d.z + b * d.raio * .7, dd), T - dd), y1: yc, y2: yc, R: .45 * dd / 2, r: dd / 2 });
        }
        break; }
      case 'escoria': {
        for (let i = 0; i < 8; i++) { const a = y1 + r() * d.comp * .5, b = Math.min(y2, a + d.comp * (.25 + r() * .5));
          pt({ def: id, x: d.x + (r() - .5) * 2, z: Math.min(Math.max(d.z + (r() - .5) * d.h, .5), T - .5), y1: a, y2: b, R: .28, r: .35 + r() * d.h * .3 }); }
        for (let i = 0; i < 3; i++) { const an = r() * Math.PI, cx = d.x + (r() - .5) * 2, cz = d.z + (r() - .5) * d.h * .6, hh = d.h * .7, a = y1 + r() * d.comp * .4;
          fc({ def: id, x1: cx - Math.cos(an) * hh / 2, z1: cz - Math.sin(an) * hh / 2, x2: cx + Math.cos(an) * hh / 2, z2: cz + Math.sin(an) * hh / 2, y1: a, y2: Math.min(y2, a + d.comp * .5), R: .6, rough: .7, hidden: 1 }); }
        break; }
      case 'mordedura': {
        const xt = w.type === 'none' ? 0 : sd * W.capHalf;
        fc({ def: id, x1: xt, z1: 0, x2: xt + sd * .3, z2: d.prof, y1, y2, R: .4, Rc: 1.1, rough: .3, corner: 'top' });
        break; }
      case 'sdh': pt({ def: id, x: d.x, z: d.z, y1, y2, R: Math.sqrt(d.d / 2), r: d.d / 2 }); break;
    }
  }
  return out;
};

/* ---------- avaliação de um refletor ---------- */
function Ax(L, s, line) { const ra = L.a / L.wa(s), rb = L.b / L.we(s); return ra * (line ? Math.sqrt(rb) : rb); }
function att(C, L, s) { return Math.pow(10, -(2 * C.A.a * s + 2 * C.A.weldA * L.wlen(s)) / 20) * (C.dual ? dualF(C, L, s) : 1); }
/* cabeçote dual (TR): Tx e Rx lado a lado na elevação, inclinados pelo ângulo de teto (roof) para cruzar os feixes
   na profundidade de cruzamento. A sensibilidade é o produto dos dois feixes de elevação, máxima onde eles se cruzam. */
function dualF(C, L, s) { const zc = Math.max(2, C.cfg.probe.cross), d = C.cfg.probe.sep / 2 * (1 - s * L.cth / zc), we = L.we(s); return Math.max(.05, Math.exp(-2 * d * d / (we * we))); }
PA.dualF = dualF;
PA.Ax = Ax; PA.att = att;
function elevF(C, L, P, s, yp, hd) {
  const yb = yp + C.tsk * hd, we = L.we(s);
  if (P.y2 - P.y1 < .01) { const q = (P.y1 - yb) / we; return Math.exp(-2 * q * q); }
  return .5 * (PA.erf(SQ2 * (P.y2 - yb) / we) - PA.erf(SQ2 * (P.y1 - yb) / we));
}
function evalPrim(C, L, th, P, k, yp, fac, out) {
  const T = C.T, dir = C.L.dir;
  if (P.vis && P.vis !== dir) return;
  if (P.legs && P.legs.indexOf(k) < 0) return;
  const ux = Math.sin(th), uz = Math.cos(th), xe = L.xe, base = L.ang * C.cpl * fac;
  if (P.kind === 'pt') {
    if (k > 1 && ((k % 2 === 0 && Math.abs(P.z - T) < .01) || (k % 2 === 1 && Math.abs(P.z) < .01))) return;
    const qx = (P.x - xe) * dir, qz = unfold(P.z, k, T), s = qx * ux + qz * uz;
    if (s < .5 || s > C.range) return;
    const dp = qx * uz - qz * ux, wa = L.wa(s), lat = Math.exp(-2 * dp * dp / (wa * wa)); if (lat < 1e-3) return;
    const el = elevF(C, L, P, s, yp, qx); if (el < 1e-3) return;
    const a = P.R * lat * el * Ax(L, s, P.y2 - P.y1 > .01) * att(C, L, s) * base * (P.trans ? 1 : 1);
    if (a > 1e-6) out.push(s, a, P.ph);
    return;
  }
  const ax = (P.x1 - xe) * dir, az = unfold(P.z1, k, T), bx = (P.x2 - xe) * dir, bz = unfold(P.z2, k, T);
  const dx = bx - ax, dz = bz - az, h = Math.hypot(dx, dz) || 1e-3, den = ux * dz - uz * dx;
  if (P.segs) facetCoherent(C, L, th, P, k, yp, base, out); else {
  let t = Math.abs(den) > 1e-9 ? (ax * uz - az * ux) / den : .5, s, dp;
  if (Math.abs(den) > 1e-9 && t >= 0 && t <= 1) { s = (ax * dz - az * dx) / den; dp = 0; }
  else { t = Math.max(0, Math.min(1, t)); const cx = ax + t * dx, cz = az + t * dz; s = cx * ux + cz * uz; dp = cx * uz - cz * ux; }
  if (s > .5 && s < C.range) {
    const wa = L.wa(s), lat = Math.exp(-2 * dp * dp / (wa * wa));
    if (lat > 1e-3) {
      const heff = Math.min(h, 1.2 * wa), nx = -dz / h, nz = dx / h, ci = Math.min(1, Math.abs(ux * nx + uz * nz));
      const D = Math.acos(ci), ws = Math.max(2.5 * DEG, .5 * C.L.lam / heff), sp = Math.exp(-((D / ws) ** 2));
      if (sp > 1e-3) {
        const el = elevF(C, L, P, s, yp, s * ux);
        const a = P.R * heff * sp * lat * el * Ax(L, s, true) * att(C, L, s) * base * C.skP;
        if (a > 1e-6) out.push(s, a, P.ph);
      }
    }
  }
  }
  if (P.corner && (P.corner === 'bot' ? k % 2 === 1 : k === 2)) {
    const first = P.corner === 'bot' ? Math.abs(P.z1 - T) <= Math.abs(P.z2 - T) : Math.abs(P.z1) <= Math.abs(P.z2);
    const cx = first ? ax : bx, cz = first ? az : bz, s2 = cx * ux + cz * uz;
    if (s2 > .5 && s2 < C.range) {
      const dp2 = cx * uz - cz * ux, wa = L.wa(s2), lat = Math.exp(-2 * dp2 * dp2 / (wa * wa));
      if (lat > 1e-3) {
        const vert = Math.exp(-((Math.atan2(Math.abs(P.x2 - P.x1), Math.abs(P.z2 - P.z1)) / (35 * DEG)) ** 2)), thd = th / DEG;
        const fcn = C.cfg.scan.wave === 'L' ? .25 : Math.exp(-(((thd - 45) / 17) ** 2)) * .85 + .15;
        const el = elevF(C, L, P, s2, yp, s2 * ux);
        const a = P.Rc * Math.pow(Math.min(h, wa), .7) * fcn * vert * lat * el * Ax(L, s2, true) * att(C, L, s2) * base * C.skC;
        if (a > 1e-6) out.push(s2, a, P.ph);
      }
    }
  }
}
PA.lawEvents = function (C, L, yp, out) {
  for (const P of C.prims) for (let k = 1; k <= C.legs; k++) {
    evalPrim(C, L, L.th, P, k, yp, 1, out);
    if (L.gl) evalPrim(C, L, L.gl.th, P, k, yp, L.gl.g, out);
  }
};
function noiseRms(C, L, s) {
  const z = fold(s * L.cth, C.T), x = L.xe + C.L.dir * s * L.sth, inW = C.W.inside(x, z) ? C.A.weldN : 1;
  return C.A.noise * inW * L.ang * Math.sqrt((L.a / L.wa(s)) * (L.b / L.we(s))) * att(C, L, s) * C.cpl;
}
PA.noiseRms = noiseRms;

/* ---------- facetas discretizadas: soma coerente de pequenos elementos (Kirchhoff) ----------
   Cada faceta vira uma cadeia de elementos a cada λ/5. A rugosidade desloca os elementos ao longo da normal:
   superfície lisa (falta de fusão) => reflexão especular forte e limpa; superfície rugosa (trinca, escória)
   => espalhamento difuso em vários ângulos, com ecos de facetas ao longo da altura. */
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()); }
function segFacets(C) {
  const step = C.L.lam / 5, T = C.T;
  C.prims.forEach((P, pi) => {
    if (P.kind !== 'fac') return;
    const dx = P.x2 - P.x1, dz = P.z2 - P.z1, h = Math.hypot(dx, dz); if (h < 1e-3) return;
    const tx = dx / h, tz = dz / h, nx = -tz, nz = tx, n = Math.max(2, Math.ceil(h / step)), w = h / n;
    const rg = PA.rng(pi * 7907 + Math.round(P.x1 * 100) * 13 + Math.round(P.z1 * 100) * 17 + Math.round(P.y1 * 10) * 5 + 1);
    const ro = P.rough == null ? .03 : P.rough, sL = .28 * ro * Math.min(1, h / 2), sF = .075 * ro, rho = Math.exp(-w / .3);
    const modes = [1, 2, 3, 5].map(m => [(rg() * 2 - 1) * sL / Math.sqrt(m), rg() * 6.283, m]);
    const segs = new Float32Array(2 * n); let ar = gauss(rg);
    for (let i = 0; i < n; i++) {
      const t = (i + .5) * w; ar = rho * ar + Math.sqrt(1 - rho * rho) * gauss(rg);
      let d = sF * ar; modes.forEach(([A, p, m]) => { d += A * Math.sin(Math.PI * m * t / h + p); });
      segs[2 * i] = P.x1 + tx * t + nx * d; segs[2 * i + 1] = Math.min(T, Math.max(0, P.z1 + tz * t + nz * d));
    }
    P.segs = segs; P.sw = w; P.nx = nx; P.nz = nz; P.xm = (P.x1 + P.x2) / 2; P.zm = (P.z1 + P.z2) / 2;
  });
}
function facetCoherent(C, L, th, P, k, yp, base, out) {
  const T = C.T, dir = C.L.dir, ux = Math.sin(th), uz = Math.cos(th), xe = L.xe;
  const nqx = P.nx * dir, nqz = k % 2 === 0 ? -P.nz : P.nz, c = Math.abs(ux * nqx + uz * nqz);
  if (c < .02) return;
  const qmx = (P.xm - xe) * dir, qmz = unfold(P.zm, k, T), sm = qmx * ux + qmz * uz;
  if (sm < -5 || sm > C.range + 5) return;
  if (elevF(C, L, P, Math.max(1, sm), yp, Math.max(1, sm) * ux) < 1e-3) return;
  const sg = C.sig, w = 2 * Math.PI / C.lamP, sgs = P.segs, amp0 = P.R * P.sw * c * base * C.skP, bins = new Map();
  for (let i = 0; i < sgs.length; i += 2) {
    const qx = (sgs[i] - xe) * dir, qz = unfold(sgs[i + 1], k, T), s = qx * ux + qz * uz;
    if (s < .5 || s > C.range) continue;
    const dp = qx * uz - qz * ux, wa = L.wa(s), lat = Math.exp(-2 * dp * dp / (wa * wa)); if (lat < 1e-3) continue;
    const a = amp0 * lat * Ax(L, s, true) * att(C, L, s), b = Math.floor(s / sg), ph = P.ph - w * s;
    let e = bins.get(b); if (!e) { e = [0, 0, 0, 0]; bins.set(b, e); }
    e[0] += a * Math.cos(ph); e[1] += a * Math.sin(ph); e[2] += a * s; e[3] += a;
  }
  bins.forEach(e => {
    const A = Math.hypot(e[0], e[1]); if (A < 1e-6) return;
    const sb = e[2] / e[3], el = elevF(C, L, P, sb, yp, sb * ux); if (el < 1e-3) return;
    out.push(sb, A * el, Math.atan2(e[1], e[0]) + w * sb);
  });
}

/* ---------- montagem do caso ---------- */
PA.build = function (cfg) {
  const C = { cfg, W: PA.weld(cfg.weld), L: PA.laws(cfg), A: PA.atten(cfg), T: cfg.weld.T, legs: cfg.scan.legs, len: cfg.weld.len };
  const list = C.L.list;
  C.cpl = Math.pow(10, -cfg.scan.coupling / 20);
  C.tsk = Math.tan(cfg.scan.skew * DEG);
  C.skP = Math.exp(-((cfg.scan.skew / 7) ** 2)); C.skC = Math.exp(-((cfg.scan.skew / 10) ** 2));
  const thMax = list.length ? Math.max(...list.map(l => l.th)) : 60 * DEG;
  C.range = cfg.scan.range > 0 ? cfg.scan.range : Math.min(450, C.legs * C.T / Math.cos(thMax) + 6);
  C.NS = 1024; C.DS = C.range / C.NS;
  const vmm = C.L.v / 1000, bw = cfg.probe.bw / 100;
  C.sig = (.88 / (bw * cfg.probe.f)) * vmm / 2 / 1.665; C.lamP = C.L.lam / 2;
  C.dual = !!cfg.probe.dual; C.prims = PA.prims(cfg, C.W); segFacets(C);
  // percurso dentro da solda (anisotropia)
  list.forEach(L => {
    const n = Math.ceil(C.range / .5) + 2, cw = new Float32Array(n); let acc = 0;
    for (let j = 0; j < n; j++) { const s = j * .5, z = fold(s * L.cth, C.T), x = L.xe + C.L.dir * s * L.sth; if (C.W.inside(x, z)) acc += .5; cw[j] = acc; }
    L.wlen = s => cw[Math.min(n - 1, Math.max(0, (s / .5) | 0))];
  });
  // ganho de referência, ACG e TCG
  const Rref = Math.sqrt(cfg.disp.refD / 2);
  const Aref = (L, s) => Rref * L.ang * Ax(L, Math.max(1, s), true) * att(C, L, Math.max(1, s));
  const sMid = L => Math.max(2, (C.T / 2) / L.cth);
  let ref = list[0]; list.forEach(L => { if (Math.abs(L.th - 60 * DEG) < Math.abs(ref.th - 60 * DEG)) ref = L; });
  C.refLaw = ref;
  const A0 = ref ? Aref(ref, sMid(ref)) : 1;
  C.Gref = 20 * Math.log10(.8 / A0) + 26; C.A0 = A0;
  list.forEach(L => {
    const K = new Float32Array(C.NS), Ka = .8 / Aref(L, sMid(L)), Kn = .8 / A0;
    for (let k = 0; k < C.NS; k++) {
      const s = (k + .5) * C.DS;
      if (cfg.disp.corr === 'none') K[k] = Kn;
      else if (cfg.disp.corr === 'acg') K[k] = Ka;
      else K[k] = Math.min(Ka * 100, Math.max(Ka * .5, .8 / Aref(L, s)));
    }
    L.K = K;
  });
  // gate
  const g = cfg.disp.gate; C.gs = Math.max(0, g.start); C.ge = Math.min(C.range, g.start + g.width);
  // malhas das vistas
  C.XR = Math.max(25, Math.ceil((C.W.capHalf || 10) + 15)); C.dx = .5; C.nx = Math.round(2 * C.XR / C.dx);
  C.nz = Math.max(40, Math.round(C.T * 4)); C.dz = C.T / C.nz; C.dy = C.len > 400 ? 2 : 1;
  // cobertura da solda (eixo do feixe ± meia largura −6 dB)
  const cells = [], hz = cfg.weld.haz;
  if (cfg.weld.type !== 'none') {
    for (let z = .25; z < C.T; z += .5) { const hw = C.W.half(z) + hz;
      for (let x = -hw + .25; x < hw; x += .5) {
        let cov = 0;
        for (const L of list) { for (let k = 1; k <= C.legs && !cov; k++) {
          const qx = (x - L.xe) * C.L.dir, qz = unfold(z, k, C.T), s = qx * L.sth + qz * L.cth;
          if (s <= 0 || s > C.range) continue;
          if (Math.abs(qx * L.cth - qz * L.sth) <= .59 * L.wa(s)) cov = k;
        } if (cov) break; }
        cells.push([x, z, cov]);
      } }
  }
  C.cov = cells; C.covPct = cells.length ? cells.filter(c => c[2]).length / cells.length * 100 : 100;
  return C;
};

/* ---------- dados na posição atual ---------- */
PA.scanAt = function (C, yp) {
  const out = [], cfg = C.cfg, seedB = Math.round(cfg.scan.index * 2) * 613 + (C.L.dir > 0 ? 1 : 2) * 99991 + Math.round(cfg.probe.f * 4) * 31;
  C.L.list.forEach((L, i) => {
    const ev = []; PA.lawEvents(C, L, yp, ev);
    if (cfg.disp.noise) {
      const r = PA.rng(i * 7919 + Math.round(yp * 2) * 104729 + seedB), M = Math.min(1600, Math.ceil(C.range / C.sig * .9));
      for (let j = 0; j < M; j++) { const s = r() * C.range, g = Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
        ev.push(s, Math.abs(g) * noiseRms(C, L, Math.max(.5, s)), r() * 6.283); }
      // ruído da cunha / interface logo abaixo da superfície (zona morta). No dual o Rx não escuta o Tx pela cunha.
      const rk = (C.dual ? .02 : cfg.scan.wave === 'L' ? .35 : .2), ln = .8 + .4 * C.L.lam;
      for (let j = 0; j < 30; j++) { const s = r() * 4 * ln, K = L.K[Math.min(C.NS - 1, (s / C.DS) | 0)]; ev.push(s, rk * .8 / K * Math.exp(-s / ln) * (.5 + r() * .7), r() * 6.283); }
    }
    out.push({ ev, env: PA.synth(C, ev, L, C.NS, C.DS, false) });
  });
  return out;
};
PA.synth = function (C, ev, L, n, ds, rf) {
  const re = new Float32Array(n), im = new Float32Array(n), sg = C.sig, half = Math.ceil(3 * sg / ds), w = 2 * Math.PI / C.lamP;
  for (let j = 0; j < ev.length; j += 3) {
    const s = ev[j], a = ev[j + 1], ph = ev[j + 2], c = Math.round(s / ds), k0 = Math.max(0, c - half), k1 = Math.min(n - 1, c + half);
    for (let k = k0; k <= k1; k++) { const d = k * ds - s, e = a * Math.exp(-(d / sg) * (d / sg)), ar = w * d + ph; re[k] += e * Math.cos(ar); im[k] += e * Math.sin(ar); }
  }
  const o = new Float32Array(n), r = C.DS / ds;
  for (let k = 0; k < n; k++) { const K = L.K[Math.min(C.NS - 1, (k / r) | 0)]; o[k] = (rf ? re[k] : Math.hypot(re[k], im[k])) * K; }
  return o;
};

/* ---------- volumes (topo, lateral, final) assíncronos ---------- */
PA.volumes = function (C, progress, done) {
  const tok = { cancel: false }, cfg = C.cfg, ny = Math.floor(C.len / C.dy) + 1, nx = C.nx, nz = C.nz, dir = C.L.dir;
  const top = new Float32Array(nx * ny), side = new Float32Array(nz * ny), end = new Float32Array(nx * nz);
  const depthGate = cfg.disp.gate.mode === 'depth';
  let yi = 0;
  const step = () => {
    if (tok.cancel) return;
    const t0 = performance.now(), ev = [];
    while (yi < ny && performance.now() - t0 < 28) {
      const y = yi * C.dy;
      C.L.list.forEach((L, li) => {
        ev.length = 0; PA.lawEvents(C, L, y, ev);
        if (cfg.disp.noise) { const r = PA.rng(li * 977 + yi * 7919 + 13);
          for (let j = 0; j < 10; j++) { const s = C.range * r(); ev.push(s, noiseRms(C, L, Math.max(.5, s)) * Math.sqrt(-2 * Math.log(r() + 1e-9)) * .9, 0); } }
        for (let j = 0; j < ev.length; j += 3) {
          const s = ev[j], zu = s * L.cth, gv = depthGate ? zu : s;
          if (gv < C.gs || gv > C.ge) continue;
          const a = ev[j + 1] * L.K[Math.min(C.NS - 1, (s / C.DS) | 0)], x = L.xe + dir * s * L.sth, z = fold(zu, C.T);
          const xb = Math.floor((x + C.XR) / C.dx), zb = Math.min(nz - 1, Math.floor(z / C.dz));
          if (xb >= 0 && xb < nx) { const o = yi * nx + xb; if (a > top[o]) top[o] = a; const e = zb * nx + xb; if (a > end[e]) end[e] = a; }
          const o2 = yi * nz + zb; if (a > side[o2]) side[o2] = a;
        }
      });
      yi++;
    }
    progress(yi / ny);
    if (yi < ny) setTimeout(step, 0); else done({ top, side, end, ny, nx, nz });
  };
  setTimeout(step, 0);
  return tok;
};

/* ---------- situações de campo ---------- */
PA.defaultCfg = () => ({
  weld: { type: 'V', T: 20, bevel: 30, rootFace: 1.5, gap: 2, xMid: .5, capOver: 1.5, capH: 2, rootOver: 1.2, rootH: 1.4, hilo: 0, haz: 2, len: 300 },
  mat: Object.assign({ preset: 'aco-carbono' }, PA.MATERIALS['aco-carbono']),
  probe: { f: 5, bw: 60, nTot: 32, pitch: .6, elev: 10, nAct: 16, first: 1, dual: false, sep: 12, cross: 25 },
  wedge: { mat: 'rexolite', vW: 2330, angle: 36, h1: 6, u1: 9, len: 38, width: 24 },
  scan: { mode: 'S', wave: 'T', a0: 40, a1: 70, astep: 1, eAng: 60, eStep: 1, focus: 'depth', fVal: 20, index: 30, side: 1, skew: 0, legs: 2, range: 0, coupling: 0, transfer: 0 },
  disp: { dGain: 6, corr: 'tcg', refD: 2, gate: { start: 3, width: 140, thr: 20, mode: 'path' }, axis: 'path', rf: false, fold: false, palette: 'amp', noise: true, geo: true, overlay: true },
  defects: []
});
const D = PA.newDefect;
PA.SCENARIOS = [
  { id: 'padrao', nome: 'Chapa 20 mm em V com defeitos variados',
    nota: 'Sete defeitos ao longo do cordão, cabeçote do lado esquerdo com index de 30 mm. Varra o cordão e compare a forma de cada indicação no S-scan e na vista final.',
    set: c => { c.defects = [D('trinca-raiz', 15, 25, { h: 3, x: .5, incl: 5 }), D('poro-agrupado', 55, 16), D('lof-bisel', 90, 30, { lado: 'esq', z1: 5, z2: 12 }),
      D('lop', 140, 35), D('escoria', 195, 25), D('mordedura', 240, 22, { lado: 'dir', prof: .8 }), D('lof-entrepasses', 275, 15, { z: 7, x: 0, larg: 8 })]; } },
  { id: 'calibracao', nome: 'Bloco com furos SDH Ø2 mm (ACG/TCG)',
    nota: 'Bloco de 30 mm sem solda com furos Ø2 mm a 5, 10, 15, 20 e 25 mm. Troque a correção de ganho entre Nenhuma, ACG e ACG + TCG e veja todos os furos irem a 80%.',
    set: c => { c.weld.type = 'none'; c.weld.T = 30; c.scan.index = 10; c.scan.legs = 1; c.disp.dGain = 0; c.disp.corr = 'none'; c.disp.geo = false;
      c.defects = [5, 10, 15, 20, 25].map((z, i) => D('sdh', 20 + i * 55, 30, { d: 2, z, x: Math.round(-16 + z * 1.43) })); } },
  { id: 'raiz', nome: 'Raiz: falta de penetração ou geometria?',
    nota: 'Desalinhamento de 1,5 mm (chapa direita mais baixa). A geometria da raiz aparece além do eixo e mais funda que T; a falta de penetração fica do lado do cabeçote, na profundidade T. Inverta o lado do cabeçote para confirmar.',
    set: c => { c.weld.hilo = 1.5; c.defects = [D('lop', 70, 60, { lado: 'esq' }), D('trinca-raiz', 190, 30, { h: 2.5, x: -.2 })]; } },
  { id: 'index', nome: 'Falta de fusão no bisel: posição do index',
    nota: 'Falta de fusão no bisel esquerdo, de 4 a 13 mm. Com index de 30 mm a perna 2 não chega perpendicular ao bisel. Aumente o index para 40 a 50 mm ou passe o cabeçote para o lado direito.',
    set: c => { c.defects = [D('lof-bisel', 60, 180, { lado: 'esq', z1: 4, z2: 13 })]; } },
  { id: 'inox', nome: 'Inox austenítico: ruído e atenuação',
    nota: 'Grão grosso e solda com grãos colunares. Compare 5 MHz com 2,25 MHz e onda transversal com longitudinal. Repare como o TCG levanta o ruído no fundo.',
    set: c => { Object.assign(c.mat, { preset: 'inox-austenitico' }, PA.MATERIALS['inox-austenitico']); c.weld.T = 25; c.scan.index = 32;
      c.defects = [D('trinca-raiz', 40, 30, { h: 4 }), D('lof-bisel', 130, 40, { lado: 'dir', z1: 6, z2: 14 }), D('poro-agrupado', 220, 20, { z: 12 })]; } },
  { id: 'espessa', nome: 'Chapa 40 mm em X (duplo V)',
    nota: 'Junta em X com nariz no meio. A falta de penetração fica embutida, sem efeito de canto, e por isso responde bem menos que numa junta em V. Use as duas pernas e confira a cobertura.',
    set: c => { Object.assign(c.weld, { type: 'X', T: 40, bevel: 30, rootFace: 2, gap: 2.5, capOver: 2, capH: 2.5 }); Object.assign(c.probe, { f: 2.25, pitch: 1, nTot: 32, nAct: 16, elev: 12 });
      Object.assign(c.wedge, { angle: 36, h1: 8, u1: 11, len: 50, width: 30 }); Object.assign(c.scan, { index: 45, fVal: 30, a0: 40, a1: 70 }); c.disp.gate.width = 260;
      c.defects = [D('lop', 40, 50), D('escoria', 120, 30, { z: 12, x: -3, h: 2 }), D('lof-entrepasses', 180, 30, { z: 28, x: 2, larg: 8 }), D('lof-bisel', 240, 40, { lado: 'esq', z1: 6, z2: 16 })]; } },
  { id: 'dla-inox', nome: 'Inox 50 mm, solda austenítica: dual linear (DLA) com onda L',
    nota: 'Chapa de 50 mm em aço inox 304/316, junta em X com solda austenítica de grão colunar. Cabeçote dual linear de 2,25 MHz (2 × 32 elementos de 10 mm de elevação, Tx e Rx separados de 14 mm, feixes cruzando a 25 mm), onda longitudinal de 45° a 70°, só a perna direta. Desligue "Dual linear" na aba Cabeçote, ou troque para onda transversal, e compare o ruído perto da superfície e dentro da solda.',
    set: c => { Object.assign(c.weld, { type: 'X', T: 50, bevel: 25, rootFace: 2, gap: 2, xMid: .5, capOver: 2, capH: 2.5, haz: 3 });
      Object.assign(c.mat, { preset: 'inox-austenitico' }, PA.MATERIALS['inox-austenitico'], { grain: 150 });
      Object.assign(c.probe, { f: 2.25, bw: 60, nTot: 32, pitch: 1, elev: 10, nAct: 24, first: 1, dual: true, sep: 14, cross: 25 });
      Object.assign(c.wedge, { mat: 'rexolite', vW: 2330, angle: 20, h1: 9, u1: 10, len: 52, width: 44 });
      Object.assign(c.scan, { wave: 'L', mode: 'S', a0: 45, a1: 70, astep: 1, focus: 'depth', fVal: 25, index: 30, legs: 1 });
      Object.assign(c.disp, { corr: 'tcg', dGain: 6 }); c.disp.gate.width = 170;
      c.defects = [D('lof-bisel', 30, 40, { lado: 'esq', z1: 8, z2: 20 }), D('trinca-raiz', 95, 30, { h: 5, x: 0, incl: 0 }), D('escoria', 150, 25, { x: -2, z: 18, h: 2.5 }),
        D('poro-agrupado', 200, 20, { z: 30, x: 3, raio: 4, d: 1.5 }), D('lof-bisel', 245, 40, { lado: 'esq', z1: 30, z2: 42 })]; } },
  { id: 'grating', nome: 'Lóbulo de grade: pitch grande em 7,5 MHz',
    nota: 'Pitch de 1 mm em 7,5 MHz passa de λ/2 na cunha. Surgem ecos fantasmas de refletores reais em ângulos errados. Reduza o pitch para 0,5 mm ou a frequência para 5 MHz e veja sumirem.',
    set: c => { Object.assign(c.probe, { f: 7.5, pitch: 1, nAct: 16 }); c.defects = [D('lop', 60, 60), D('sdh', 180, 60, { d: 2, z: 10, x: 0 })]; } },
  { id: 'skew', nome: 'Sonda torta e acoplamento ruim',
    nota: 'Desvio de skew de 8° e 6 dB de perda de acoplamento. Refletores planos longos (falta de fusão, falta de penetração) perdem muito sinal com o skew; poros quase não mudam. Zere o skew e o acoplamento para comparar.',
    set: c => { c.scan.skew = 8; c.scan.coupling = 6; c.defects = [D('lop', 40, 50), D('poro-agrupado', 130, 20), D('lof-bisel', 200, 50, { lado: 'esq', z1: 5, z2: 12 })]; c.scan.index = 50; } },
  { id: 'dificeis', nome: 'Trinca transversal e falta de fusão entre passes',
    nota: 'Dois defeitos ruins para o feixe a 90°: a trinca transversal só dá ecos fracos de borda e a falta de fusão entre passes é horizontal, então só as pontas difratam. Tente E-scan a 45° e mais ganho.',
    set: c => { c.defects = [D('trinca-transversal', 80, 2, { h: 5, z: 3 }), D('lof-entrepasses', 160, 40, { z: 9, larg: 10 }), D('trinca-interna', 240, 25, { h: 4, z: 10, x: 2, incl: 25 })]; } }
];
})();
