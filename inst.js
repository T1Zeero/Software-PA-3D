/* Simulador PAUT: tela cheia no estilo de aparelho de campo (varredura ao vivo e análise) */
(function () {
'use strict';
const PA = window.PA, A = () => PA.app, f1 = PA.f1, DEG = PA.DEG, $ = id => document.getElementById(id);
const MONO = '"IBM Plex Mono",ui-monospace,monospace';
const box = $('inst');
let open = false, closedFor = null, step = 1, nextI = -1, gab = false;
const STEPS = [.5, 1, 2, 6];

function show(on) {
  open = on; box.hidden = !on; document.body.classList.toggle('inst-on', on);
  if (on) { syncFields(); A().refresh(); }
}
PA.hooks.onMode = (m, hasFile) => {
  if (m !== closedFor) closedFor = null;
  const want = m === 'vivo' || (m === 'analise' && hasFile);
  if (want && closedFor !== m) show(true); else if (!want) show(false);
  modeUI();
};
function modeUI() {
  const lv = PA.live, ana = lv.mode === 'analise' && lv.file;
  $('iMode').textContent = ana ? 'ANÁLISE' : 'AO VIVO';
  $('iNext').hidden = !ana; $('iCsv').hidden = !ana;
  $('iLive').hidden = !ana; $('iRecB').disabled = false;
}
['instOpen', 'instOpen2'].forEach(id => $(id) && $(id).addEventListener('click', () => { closedFor = null; show(true); }));
$('iExit').addEventListener('click', () => { closedFor = PA.live.mode; show(false); });
window.addEventListener('keydown', e => { if (open && e.key === 'Escape') { closedFor = PA.live.mode; show(false); } });

/* campos ligados aos do painel */
function syncFields() { $('iPeca').value = $('recPeca').value; $('iInsp').value = $('recInsp').value; $('iSpd').value = $('lvSpeed').value; }
$('iPeca').addEventListener('input', e => { $('recPeca').value = e.target.value; });
$('iInsp').addEventListener('input', e => { $('recInsp').value = e.target.value; });
$('iSpd').addEventListener('change', e => { $('lvSpeed').value = e.target.value; });
[$('iPeca'), $('iInsp')].forEach(el => el.addEventListener('keydown', e => e.stopPropagation()));

/* botões */
const msg = t => { $('iMsg').textContent = t; };
function gain(d) { const a = A(); a.cfg.disp.dGain = Math.round((a.cfg.disp.dGain + d) * 10) / 10; $('gain').value = a.cfg.disp.dGain; a.refresh(); }
function law(d) { const a = A(), n = a.C.L.list.length; if (!n) return; a.st.law = Math.max(0, Math.min(n - 1, a.st.law + d)); $('law').value = a.st.law; a.refresh(); }
$('iGp').addEventListener('click', () => gain(step));
$('iGm').addEventListener('click', () => gain(-step));
$('iLp').addEventListener('click', () => law(1));
$('iLm').addEventListener('click', () => law(-1));
$('iStep').addEventListener('click', () => { step = STEPS[(STEPS.indexOf(step) + 1) % STEPS.length]; $('iStepV').textContent = String(step).replace('.', ','); });
$('iGab').addEventListener('click', e => { gab = !gab; e.currentTarget.classList.toggle('on', gab); msg(gab ? 'Gabarito ligado: os defeitos reais aparecem nas telas.' : 'Gabarito desligado.'); A().refresh(); });
$('iClr').addEventListener('click', () => { if (PA.live.mode === 'vivo') { $('lvClear').click(); msg('C-scan limpo.'); } });
$('iRecB').addEventListener('click', () => { $('recBtn').click(); });
$('iSave').addEventListener('click', () => { const r = PA.live.rec; if (r && r.on) $('recBtn').click(); else msg('Nada sendo gravado. Toque em Gravar, varra a junta e depois em Salvar arquivo.'); });
$('iOpen').addEventListener('click', () => $('anFile').click());
$('iAna').addEventListener('click', () => { const b = $('openLast'); if (!b.hidden) b.click(); else msg('Ainda não há gravação nesta sessão. Grave uma varredura ou use Abrir arquivo.'); });
$('iLive').addEventListener('click', () => { const b = document.querySelector('#imode button[data-m="vivo"]'); if (b) b.click(); });
$('iCsv').addEventListener('click', () => { $('anCsv').click(); msg($('anCsvInfo').textContent || 'Relatório CSV gerado.'); });
$('iNext').addEventListener('click', () => {
  const inds = PA.live.inds; if (!inds.length) { msg('Nenhuma indicação acima do nível de registro.'); return; }
  nextI = (nextI + 1) % inds.length; const d = inds[nextI]; A().setY(d.ym);
  msg('Indicação ' + d.n + ' de ' + inds.length + ': Y ' + f1(d.y1) + ' a ' + f1(d.y2) + ' mm, ' + f1(d.comp) + ' mm, ' + Math.round(d.amax * 100) + '%, ' + (d.db >= 0 ? '+' : '') + f1(d.db) + ' dB, prof. ' + f1(d.z) + ' mm.');
});
document.querySelectorAll('#iPad button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); PA.live.press(k); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, () => PA.live.release(k)));
});
$('iTop').addEventListener('click', e => {
  if (!(PA.live.mode === 'analise' && PA.live.file)) return;
  const g = e.currentTarget._geom; if (!g) return; const r = e.currentTarget.getBoundingClientRect();
  const y = ((e.clientX - r.left) * g.dpr - g.m.l) / (g.W - g.m.l - g.m.r) * g.lenY; A().setY(y);
});

/* A-scan vertical, como nos aparelhos: percurso para baixo, amplitude para a direita */
function fit(cv) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(1.75, window.devicePixelRatio || 1);
  const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return { W: w, H: h, dpr: w / Math.max(1, r.width) };
}
function txt(ctx, s, x, y, col, al, bl, size, dpr) { ctx.font = (size || 11) * dpr + 'px ' + MONO; ctx.fillStyle = col; ctx.textAlign = al; ctx.textBaseline = bl; ctx.fillText(s, x, y); }
function drawAV(cv, C, S, st) {
  const { W, H, dpr } = fit(cv), ctx = cv.getContext('2d'), cfg = C.cfg, L = C.L.list[st.law];
  ctx.fillStyle = '#0b1622'; ctx.fillRect(0, 0, W, H);
  if (!L) return;
  const m = { l: 40 * dpr, r: 10 * dpr, t: 18 * dpr, b: 8 * dpr }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const ax = cfg.disp.axis, conv = s => ax === 'depth' ? s * L.cth : ax === 'time' ? 2 * (L.tW + s / (C.L.v / 1000)) : s;
  const lo = conv(0), hi = conv(C.range), Ys = s => m.t + (conv(s) - lo) / (hi - lo) * ph, Xa = a => m.l + pw * Math.min(1.04, Math.max(0, a));
  ctx.fillStyle = '#050c14'; ctx.fillRect(m.l, m.t, pw, ph);
  ctx.strokeStyle = '#1d3650'; ctx.lineWidth = 1;
  [0, .2, .4, .6, .8, 1].forEach(a => { ctx.beginPath(); ctx.moveTo(Xa(a), m.t); ctx.lineTo(Xa(a), m.t + ph); ctx.stroke(); txt(ctx, String(Math.round(a * 100)), Xa(a), m.t - 4 * dpr, '#8fc3e8', a === 1 ? 'right' : 'center', 'alphabetic', 10, dpr); });
  const raw = (hi - lo) / Math.max(1, ph / (40 * dpr)), p = Math.pow(10, Math.floor(Math.log10(raw))); let stp = 10 * p; for (const k of [1, 2, 5, 10]) if (k * p >= raw) { stp = k * p; break; }
  for (let v = Math.ceil(lo / stp) * stp; v <= hi; v += stp) { const y = m.t + (v - lo) / (hi - lo) * ph; ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke(); txt(ctx, String(Math.round(v * 10) / 10).replace('.', ','), m.l - 5 * dpr, y, '#8fc3e8', 'right', 'middle', 10, dpr); }
  ctx.setLineDash([3 * dpr, 3 * dpr]); ctx.strokeStyle = '#4f6b85';
  for (let b = 1; b <= C.legs; b++) { const s = b * C.T / L.cth; if (s > C.range) break; const y = Ys(s); ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke(); txt(ctx, b + 'T', m.l + pw - 3 * dpr, y - 3 * dpr, '#7f9bb5', 'right', 'alphabetic', 10, dpr); }
  ctx.setLineDash([]);
  const env = S[st.law].env, gm = st.gmul, n = C.NS;
  ctx.fillStyle = 'rgba(242,210,27,.18)'; ctx.strokeStyle = '#f2d21b'; ctx.lineWidth = 1.2 * dpr; ctx.beginPath(); ctx.moveTo(Xa(0), Ys(0));
  for (let k = 0; k < n; k++) ctx.lineTo(Xa(env[k] * gm), Ys(k * C.DS));
  ctx.lineTo(Xa(0), Ys((n - 1) * C.DS)); ctx.closePath(); ctx.fill(); ctx.stroke();
  const g = cfg.disp.gate, gy = g.mode === 'depth', gsP = gy ? C.gs / L.cth : C.gs, geP = Math.min(C.range, gy ? C.ge / L.cth : C.ge), xg = Xa(g.thr / 100);
  ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.moveTo(xg, Ys(gsP)); ctx.lineTo(xg, Ys(geP)); ctx.stroke();
  txt(ctx, 'A', xg + 4 * dpr, Ys(gsP) + 2 * dpr, '#ff4fd8', 'left', 'top', 11, dpr);
  const pk = st.peak;
  if (pk && pk.ok) {
    const y = Ys(pk.s); ctx.strokeStyle = 'rgba(255,90,60,.8)'; ctx.lineWidth = 1 * dpr; ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke();
    ctx.fillStyle = '#ff5a3c'; ctx.beginPath(); ctx.arc(Xa(Math.min(1.04, pk.a)), y, 3.5 * dpr, 0, 7); ctx.fill();
    txt(ctx, 'Pico ' + f1(pk.s) + ' mm', m.l + 6 * dpr, y - 4 * dpr, '#ff8a6a', 'left', 'alphabetic', 11, dpr);
  }
}

/* leituras do topo */
function readouts(C, st) {
  const cfg = C.cfg, p = st.peak, g = cfg.disp.gate, V = (PA.hooks.vol && PA.hooks.vol()) || A().V;
  const len = p && p.ok && V ? PA.length6dB(C, V, st.yp, p.x) : null, sg = v => (v >= 0 ? '+' : '') + f1(v);
  const rows = [
    ['A%', p ? Math.min(999, p.a * 100).toFixed(0) + '%' : '—', p && p.ok ? 'hot' : ''],
    ['dB ref', p && p.a > 0 ? sg(20 * Math.log10(p.a / .8) - cfg.disp.dGain) : '—', p && p.ok ? 'hot' : ''],
    ['SA^', p ? f1(p.s) : '—'], ['DA^', p ? f1(p.depth) : '—'],
    ['PA^', p ? f1((p.x - C.L.xf) * C.L.dir) : '—'], ['Eixo', p ? sg(p.x) : '—'],
    ['Perna', p ? String(p.leg) : '—'], ['−6 dB', len ? f1(len.len) : '—'],
    ['Scan Y', f1(st.yp)], ['Index', f1(cfg.scan.index)], ['Skew', f1(cfg.scan.skew) + '°'], ['Gate A', f1(C.gs) + '–' + f1(C.ge)]
  ];
  $('iRead').innerHTML = rows.map(r => `<div class="${r[2] || ''}"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  $('iGain').textContent = f1(C.Gref + cfg.disp.dGain + cfg.scan.transfer);
  $('iRange').textContent = f1(C.range);
  const L = C.L.list[st.law];
  $('iLaw').textContent = L ? f1(L.th / DEG) + '°' : '—';
  $('iSecT').textContent = (cfg.scan.mode === 'S' ? f1(cfg.scan.a0) + '° a ' + f1(cfg.scan.a1) + '°' : 'E ' + f1(cfg.scan.eAng) + '°') + ' · ' + cfg.probe.f + ' MHz';
  $('iAscT').textContent = L ? 'lei ' + (st.law + 1) + '/' + C.L.list.length + ' · ' + f1(L.th / DEG) + '°' : '';
  $('iCT').textContent = 'Y ' + f1(st.yp) + ' / ' + f1(C.len) + ' mm';
  const r = PA.live.rec, on = !!(r && r.on);
  $('iRec').classList.toggle('on', on); $('iRec').textContent = on ? 'REC ' + r.count : 'REC';
  $('iRecB').classList.toggle('on', on); $('iRecB').innerHTML = on ? '<i>■</i>Parar' : '<i>●</i>Gravar';
}

PA.hooks.afterDraw = (C, S, vst0) => {
  if (!open) return;
  const vst = Object.assign({}, vst0, { showDef: gab, train: !gab });
  PA.drawSector($('iSec'), C, S, vst);
  drawAV($('iAsc'), C, S, vst);
  PA.drawTop($('iTop'), C, (PA.hooks.vol && PA.hooks.vol()) || A().V, vst);
  readouts(C, vst);
  const ri = $('recInfo').textContent; if (ri !== lastInfo) { lastInfo = ri; msg(ri); }
};
let lastInfo = '';
function clock() { const d = new Date(), p = n => String(n).padStart(2, '0'); $('iClock').textContent = p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); }
setInterval(() => { if (open) clock(); }, 1000); clock();
const ro = new ResizeObserver(() => { if (open) A().refresh(); });
['iSec', 'iAsc', 'iTop'].forEach(id => ro.observe($(id)));
msg('W/S ou ↑↓ andam no cordão, A/D ou ←→ mudam o index, Q/E o skew, Shift acelera. Esc sai da tela.');
})();
