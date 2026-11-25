/* Simulador PAUT: varredura ao vivo, gravação de inspeção e análise de arquivo */
(function () {
'use strict';
const PA = window.PA, A = () => PA.app, f1 = PA.f1, DEG = PA.DEG, $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NR = 512;
let lastYi = null, mode = 'sim', acq = null, rec = null, file = null, replayV = null, inds = [];

/* ---------- volumes adquiridos ---------- */
function blankVol(C) { const ny = Math.floor(C.len / C.dy) + 1; return { key: [C.nx, C.nz, ny, C.dy, C.T].join('|'), nx: C.nx, nz: C.nz, ny, top: new Float32Array(C.nx * ny), side: new Float32Array(C.nz * ny), end: new Float32Array(C.nx * C.nz), vis: new Uint8Array(ny) }; }
function binFrame(C, V, yi, envOf, dir) {
  const g = C.cfg.disp.gate, depthGate = g.mode === 'depth';
  V.top.fill(0, yi * V.nx, (yi + 1) * V.nx); V.side.fill(0, yi * V.nz, (yi + 1) * V.nz);
  C.L.list.forEach((L, i) => {
    const env = envOf(i); if (!env) return;
    const kmax = Math.min(C.NS - 1, Math.ceil(C.legs * C.T / L.cth / C.DS));
    for (let k = 4; k <= kmax; k++) {
      const a = env[k]; if (a < .003) continue;
      const s = k * C.DS, zu = s * L.cth, gv = depthGate ? zu : s; if (gv < C.gs || gv > C.ge) continue;
      const x = L.xe + dir * s * L.sth, z = PA.fold(zu, C.T), xb = Math.floor((x + C.XR) / C.dx), zb = Math.min(V.nz - 1, Math.floor(z / C.dz));
      if (xb >= 0 && xb < V.nx) { const o = yi * V.nx + xb; if (a > V.top[o]) V.top[o] = a; const e = zb * V.nx + xb; if (a > V.end[e]) V.end[e] = a; }
      const o2 = yi * V.nz + zb; if (a > V.side[o2]) V.side[o2] = a;
    }
  });
  V.vis[yi] = 1;
}

PA.hooks.afterScan = (C, S, st) => {
  if (mode !== 'vivo') return;
  if (!acq || acq.key !== blankVol(C).key) acq = blankVol(C);
  const yi = Math.max(0, Math.min(acq.ny - 1, Math.round(st.yp / C.dy)));
  let ys = [yi];
  if (lastYi != null && Math.abs(yi - lastYi) > 1 && Math.abs(yi - lastYi) < 40) { ys = []; const s = Math.sign(yi - lastYi); for (let j = lastYi + s; j !== yi + s; j += s) ys.push(j); }
  lastYi = yi;
  ys.forEach(j => binFrame(C, acq, j, i => S[i].env, C.L.dir));
  if (rec && rec.on) {
    const nL = C.L.list.length, d = new Uint8Array(nL * NR), r = C.NS / NR, gm = st.gmul;
    for (let i = 0; i < nL; i++) { const e = S[i].env; for (let j = 0; j < NR; j++) { let m = 0; for (let q = 0; q < r; q++) m = Math.max(m, e[j * r + q] || 0); d[i * NR + j] = Math.min(255, Math.round(m * gm / 2 * 255)); } }
    ys.forEach(j => { if (!rec.frames.has(j)) rec.count++; rec.frames.set(j, { y: j * C.dy, index: C.cfg.scan.index, skew: C.cfg.scan.skew, d }); });
    if (rec.index0 == null) rec.index0 = C.cfg.scan.index;
    if (Math.abs(C.cfg.scan.index - rec.index0) > .5) rec.idxVar = true;
    recInfo();
  }
};
PA.hooks.vol = () => mode === 'vivo' ? acq : mode === 'analise' ? replayV : null;
PA.hooks.onRebuild = C => {
  if (mode === 'vivo' && acq && acq.key !== blankVol(C).key) acq = null;
  if (rec && rec.on && file === null && C.L.list.length !== rec.nL) { rec.on = false; setRecUI(); $('recInfo').textContent = 'Gravação parada: a configuração de leis mudou.'; }
  if (mode === 'analise' && file) buildReplay(C);
};
PA.hooks.frame = (C, st) => {
  if (mode !== 'analise' || !file) return null;
  const yi = Math.round(st.yp / C.dy), fr = file.byYi.get(yi) || file.byYi.get(yi - 1) || file.byYi.get(yi + 1);
  if (fr && Math.abs(fr.index - C.cfg.scan.index) > .01) A().shiftIndex(fr.index, true);
  const nL = C.L.list.length, gmA = file.gmul;
  return C.L.list.map((L, i) => {
    const env = new Float32Array(C.NS);
    if (fr && i < file.nL) { const r = C.NS / NR; for (let k = 0; k < C.NS; k++) env[k] = fr.d[i * NR + Math.floor(k / r)] / 255 * 2 / gmA; }
    return { ev: [], env };
  });
};

/* ---------- movimento ---------- */
const keys = new Set();
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', KeyQ: 'rotl', KeyE: 'rotr' };
let fast = false, lastT = 0, looping = false;
function loop(t) {
  if (!keys.size) { looping = false; return; }
  const dt = Math.min(.1, (t - lastT) / 1000); lastT = t;
  const sp = (+$('lvSpeed').value) * (fast ? 3 : 1), a = A(), cfg = a.cfg, dir = a.C ? a.C.L.dir : 1;
  if (keys.has('up')) a.setY(a.st.yp + sp * dt);
  if (keys.has('down')) a.setY(a.st.yp - sp * dt);
  let dx = 0; if (keys.has('right')) dx += sp * dt * .6; if (keys.has('left')) dx -= sp * dt * .6;
  if (dx) a.shiftIndex(cfg.scan.index - dir * dx);
  if (keys.has('rotl')) a.setSkew(cfg.scan.skew - 15 * dt);
  if (keys.has('rotr')) a.setSkew(cfg.scan.skew + 15 * dt);
  requestAnimationFrame(loop);
}
function press(k) { if (mode !== 'vivo' && !(mode === 'analise' && file && (k === 'up' || k === 'down'))) return; A().stop(); keys.add(k); if (!looping) { looping = true; lastT = performance.now(); requestAnimationFrame(loop); } }
window.addEventListener('keydown', e => {
  if (mode !== 'vivo' && !(mode === 'analise' && file)) return; const t = e.target; if (t && /INPUT|SELECT|TEXTAREA/.test(t.tagName) && t.type !== 'range') return;
  const k = KEYMAP[e.code]; if (!k) return; e.preventDefault(); fast = e.shiftKey; press(k);
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys.delete(k); fast = e.shiftKey; });
window.addEventListener('blur', () => keys.clear());
document.querySelectorAll('#dpad button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); press(k); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, () => keys.delete(k)));
});

/* ---------- modos ---------- */
function setMode(m) {
  mode = m; keys.clear(); if (PA.hooks.onMode) setTimeout(() => PA.hooks.onMode(m, !!file), 0);
  document.querySelectorAll('#imode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m));
  $('pVivo').hidden = m !== 'vivo'; $('pAnalise').hidden = m !== 'analise'; $('pSim').hidden = m !== 'sim';
  const st = A().st;
  if (m === 'analise' && file) { st.train = !$('anShow').checked; }
  $('volSrc').textContent = m === 'vivo' ? 'dados adquiridos na varredura' : m === 'analise' ? (file ? 'arquivo ' + file.name : 'nenhum arquivo aberto') : 'modelo completo do cordão';
  A().refresh();
}
document.querySelectorAll('#imode button').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.m !== 'analise' && mode === 'analise' && file) { file = null; replayV = null; A().rebuild(); }
  setMode(b.dataset.m);
}));
$('lvClear').addEventListener('click', () => { acq = null; A().refresh(); });

/* ---------- gravação ---------- */
function setRecUI() { const on = rec && rec.on; $('recBtn').textContent = on ? 'Parar e salvar arquivo' : 'Iniciar gravação'; $('recBtn').classList.toggle('on', !!on); $('recDot').hidden = !on; }
function recInfo() {
  if (!rec) return; const ys = [...rec.frames.values()].map(f => f.y);
  $('recInfo').textContent = rec.count + ' posições gravadas' + (ys.length ? ', Y ' + f1(Math.min(...ys)) + ' a ' + f1(Math.max(...ys)) + ' mm' : '') + (rec.idxVar ? '. Atenção: o index variou durante a gravação.' : '');
}
$('recBtn').addEventListener('click', () => {
  const a = A();
  if (rec && rec.on) { rec.on = false; setRecUI(); save(); return; }
  if (mode !== 'vivo') setMode('vivo');
  acq = null; lastYi = null; rec = { on: true, frames: new Map(), count: 0, nL: a.C.L.list.length, index0: null, t0: new Date(), gmul: Math.pow(10, (a.cfg.disp.dGain + a.cfg.scan.transfer) / 20), gain: a.C.Gref + a.cfg.disp.dGain + a.cfg.scan.transfer };
  setRecUI(); recInfo(); a.refresh();
});
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function download(name, text, type) {
  try { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return true; }
  catch (e) { return false; }
}
function stamp(d) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()); }
function save() {
  const a = A(), C = a.C;
  if (!rec || !rec.count) { $('recInfo').textContent = 'Nada gravado: mova o cabeçote ao longo do cordão com a gravação ligada.'; return; }
  const frames = [...rec.frames.values()].sort((p, q) => p.y - q.y).map(f => ({ y: f.y, index: f.index, skew: f.skew, d: b64(f.d) }));
  const out = { formato: 'PAUT-SIM', versao: 1, criado: rec.t0.toISOString(), finalizado: new Date().toISOString(),
    inspetor: $('recInsp').value.trim(), peca: $('recPeca').value.trim(), obs: $('recObs').value.trim(),
    aquisicao: { ganho_total_dB: +rec.gain.toFixed(1), gmul: rec.gmul, amostras: NR, faixa_mm: C.range, dy_mm: C.dy, leis: C.L.list.map(L => ({ angulo: +(L.th / DEG).toFixed(2), elem: L.k0 + 1 })), index_inicial: rec.index0, gate: a.cfg.disp.gate },
    cfg: JSON.parse(JSON.stringify(a.cfg)), quadros: frames };
  const name = 'inspecao_PAUT_' + (out.peca ? out.peca.replace(/[^\w-]+/g, '_') + '_' : '') + stamp(rec.t0) + '.json';
  const ok = download(name, JSON.stringify(out), 'application/json');
  $('recInfo').textContent = (ok ? 'Arquivo ' + name + ' gerado' : 'Não foi possível baixar o arquivo aqui') + ' (' + rec.count + ' posições, ' + f1(JSON.stringify(out).length / 1e6) + ' MB). Abra em Análise de arquivo.';
  lastSaved = { name, out };
  $('openLast').hidden = false;
}
let lastSaved = null;
$('openLast').addEventListener('click', () => { if (lastSaved) openFile(lastSaved.out, lastSaved.name); });

/* ---------- análise ---------- */
$('anFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { openFile(JSON.parse(r.result), f.name); } catch (err) { $('anMeta').textContent = 'Arquivo inválido: ' + err.message; } };
  r.readAsText(f); e.target.value = '';
});
function openFile(o, name) {
  if (!o || o.formato !== 'PAUT-SIM' || !Array.isArray(o.quadros) || !o.cfg) { $('anMeta').textContent = 'Este arquivo não é uma inspeção do simulador.'; return; }
  const frames = o.quadros.map(q => ({ y: +q.y, index: +q.index, skew: +q.skew || 0, d: unb64(String(q.d)) }));
  file = { name, o, frames, gmul: +o.aquisicao.gmul || 1, nL: o.aquisicao.leis.length, byYi: new Map() };
  mode = 'analise';
  A().loadCfg(o.cfg, 'Análise do arquivo ' + name + '. Gabarito escondido; use Mostrar gabarito para conferir.');
  const C = A().C; frames.forEach(f => file.byYi.set(Math.round(f.y / C.dy), f));
  if (frames.length) A().setY(frames[Math.floor(frames.length / 2)].y);
  $('anShow').checked = false;
  setMode('analise'); buildReplay(C); renderMeta(); A().refresh();
}
function buildReplay(C) {
  if (!file) return; replayV = blankVol(C);
  file.byYi = new Map(); file.frames.forEach(f => file.byYi.set(Math.round(f.y / C.dy), f));
  const idx0 = C.cfg.scan.index, r = C.NS / NR, dir = C.L.dir;
  file.frames.forEach(f => {
    const yi = Math.round(f.y / C.dy); if (yi < 0 || yi >= replayV.ny) return;
    const dx = -dir * (f.index - C.cfg.scan.index);
    C.L.list.forEach(L => { L.xe += dx; });
    binFrame(C, replayV, yi, i => { if (i >= file.nL) return null; const e = new Float32Array(C.NS); for (let k = 0; k < C.NS; k++) e[k] = f.d[i * NR + Math.floor(k / r)] / 255 * 2 / file.gmul; return e; }, dir);
    C.L.list.forEach(L => { L.xe -= dx; });
  });
  detect(C);
}
function detect(C) {
  const V = replayV, a = A(), gm = Math.pow(10, (a.cfg.disp.dGain + a.cfg.scan.transfer) / 20), thr = .8 * Math.pow(10, (a.cfg.disp.dGain + +$('anLevel').value) / 20), out = [];
  let cur = null;
  for (let yi = 0; yi < V.ny; yi++) {
    let m = 0, xb = 0; if (V.vis[yi]) for (let b = 0; b < V.nx; b++) { const v = V.top[yi * V.nx + b] * gm; if (v > m) { m = v; xb = b; } }
    const x = xb * C.dx - C.XR + C.dx / 2;
    if (m >= thr && (!cur || (Math.abs(x - cur.x) <= 5 && yi - cur.y2i <= 2))) {
      if (!cur) cur = { y1i: yi, y2i: yi, x, amax: m, ym: yi, xm: x };
      cur.y2i = yi; if (m > cur.amax) { cur.amax = m; cur.ym = yi; cur.xm = x; } cur.x = (cur.x * 3 + x) / 4;
    } else if (m >= thr) { out.push(cur); cur = { y1i: yi, y2i: yi, x, amax: m, ym: yi, xm: x }; }
    else if (cur && yi - cur.y2i > 2) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  inds = out.map((c, i) => {
    let zm = 0, zb = 0; for (let b = 0; b < V.nz; b++) { const v = V.side[c.ym * V.nz + b]; if (v > zm) { zm = v; zb = b; } }
    return { n: i + 1, y1: c.y1i * C.dy, y2: c.y2i * C.dy, comp: (c.y2i - c.y1i + 1) * C.dy, amax: c.amax, db: 20 * Math.log10(c.amax / .8) - a.cfg.disp.dGain, z: (zb + .5) * C.dz, x: c.xm, ym: c.ym * C.dy };
  });
  renderInds();
}
function renderMeta() {
  if (!file) return; const o = file.o, ys = file.frames.map(f => f.y);
  $('anMeta').innerHTML = `<b>${esc(file.name)}</b><br>Peça: ${esc(o.peca || 'não informada')}. Inspetor: ${esc(o.inspetor || 'não informado')}. Data: ${esc(new Date(o.criado).toLocaleString('pt-BR'))}.<br>${file.frames.length} posições, Y ${f1(Math.min(...ys))} a ${f1(Math.max(...ys))} mm. Ganho de aquisição ${f1(o.aquisicao.ganho_total_dB)} dB.${o.obs ? '<br>Obs.: ' + esc(o.obs) : ''}`;
}
function renderInds() {
  const lv = +$('anLevel').value;
  $('anInds').innerHTML = inds.length ? `<div class="scroll"><table><thead><tr><th>Nº</th><th>Y início</th><th>Y fim</th><th>Compr.</th><th>A máx</th><th>dB ref.</th><th>Prof.</th><th>Do eixo</th><th></th></tr></thead><tbody>${
    inds.map(d => `<tr><td>${d.n}</td><td>${f1(d.y1)}</td><td>${f1(d.y2)}</td><td>${f1(d.comp)}</td><td>${Math.round(d.amax * 100)}%</td><td>${(d.db >= 0 ? '+' : '') + f1(d.db)}</td><td>${f1(d.z)}</td><td>${(d.x >= 0 ? '+' : '') + f1(d.x)}</td><td><button class="mini" data-goy="${d.ym}">Ver</button></td></tr>`).join('')}</tbody></table></div>
    <p class="note">Indicações no gate A acima do nível de registro (referência ${lv ? '− ' + Math.abs(lv) + ' dB' : ''}). Valores em mm; comprimento pelo limiar, profundidade no ponto de máxima amplitude.</p>`
    : '<p class="note">Nenhuma indicação acima do nível de registro.</p>';
}
$('anInds').addEventListener('click', e => { const y = e.target.dataset.goy; if (y != null) { A().setY(+y); } });
$('anLevel').addEventListener('change', () => { if (file) { detect(A().C); } });
$('anRedo').addEventListener('click', () => { if (file) { detect(A().C); A().refresh(); } });
$('anShow').addEventListener('change', e => { A().st.train = !e.target.checked; A().refresh(); });
$('anCsv').addEventListener('click', () => {
  if (!file) return; const o = file.o, a = A(), sep = ';', n = v => String(f1(v));
  const L = [['Relatório de inspeção PAUT (simulador)'], ['Arquivo', file.name], ['Peça', o.peca || ''], ['Inspetor', o.inspetor || ''], ['Data', new Date(o.criado).toLocaleString('pt-BR')],
    ['Espessura (mm)', n(a.cfg.weld.T)], ['Junta', a.cfg.weld.type], ['Material', a.cfg.mat.preset], ['Frequência (MHz)', n(a.cfg.probe.f)], ['Index offset (mm)', n(o.aquisicao.index_inicial)],
    ['Ganho de aquisição (dB)', n(o.aquisicao.ganho_total_dB)], ['Nível de registro', 'referência ' + $('anLevel').value + ' dB'], ['Observações', (o.obs || '').replace(/\s+/g, ' ')], [],
    ['Nº', 'Y início (mm)', 'Y fim (mm)', 'Comprimento (mm)', 'A máx (%FSH)', 'dB em relação à ref.', 'Profundidade (mm)', 'Distância do eixo (mm)']]
    .concat(inds.map(d => [d.n, n(d.y1), n(d.y2), n(d.comp), Math.round(d.amax * 100), n(d.db), n(d.z), n(d.x)]));
  const csv = '﻿' + L.map(r => r.map(c => /[;"\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : c).join(sep)).join('\r\n');
  const ok = download(file.name.replace(/\.json$/i, '') + '_relatorio.csv', csv, 'text/csv');
  $('anCsvInfo').textContent = ok ? 'Relatório CSV gerado.' : 'Não foi possível baixar o relatório aqui.';
});

PA.live = { get mode() { return mode; }, get rec() { return rec; }, get file() { return file; }, get inds() { return inds; }, press, release: k => keys.delete(k) };
setMode('sim');
})();
