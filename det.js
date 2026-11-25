/* Simulador PAUT: mapa de detectabilidade na seção da solda (onde e por que o sinal fica baixo) */
(function () {
'use strict';
const PA = window.PA, A = () => PA.app, f1 = PA.f1, DEG = PA.DEG, $ = id => document.getElementById(id);
const MONO = '"IBM Plex Mono",ui-monospace,monospace';
const WHY = {
  fora: ['#6b7480', 'Fora do feixe', 'Nenhuma lei passa por ali com este index, faixa angular e número de pernas.', 'Mude o index, inclua outra perna, amplie a faixa angular ou inspecione pelo outro lado.'],
  desvio: ['#ff7a1a', 'Desvio do feixe na solda', 'Os grãos colunares entortam e alargam o feixe dentro do cordão; o feixe reto chegaria, o real passa ao lado ou chega fraco.', 'Prefira onda L, frequência menor, ângulos que atravessem menos solda e inspeção pelos dois lados. O trajeto real aparece tracejado em azul no S-scan.'],
  skew: ['#ff4fd8', 'Skew / orientação em planta', 'O defeito não está paralelo ao cordão (ou a sonda está torta) e a reflexão especular sai para o lado.', 'Com matriz (DMA), direcione o feixe em skew na direção do defeito; com linear, gire a sonda. Teste o direcionamento na aba Cabeçote.'],
  orient: ['#8b5cf6', 'Orientação na seção', 'O feixe chega, mas a face do defeito não devolve o som ao cabeçote; sobra só a difração das pontas.', 'Busque ângulo perpendicular à face (no bisel: 90° − ângulo do bisel, na perna certa), use o outro lado, ou TOFD/tandem para faces verticais.'],
  ruido: ['#3b82f6', 'Ruído de grão', 'O eco existe, mas fica a menos de 6 dB do ruído de grão nesse ponto.', 'Frequência menor, onda L, cabeçote dual (DLA/DMA) com o cruzamento nessa profundidade, abertura maior.'],
  aten: ['#14b8a6', 'Atenuação e distância', 'Chega pouco som: percurso longo, solda atenuante ou ponto fora do cruzamento do dual.', 'Aproxime o cabeçote (index menor ou perna 1), mova o cruzamento do dual para essa profundidade, reduza a frequência.']
};
let orient = 'vol', cells = null, cellsC = null, tok = [], dirty = true, visible = false, tmr = 0, Cref = null, prog = 0;

function cfgKey(C) { return C.id + '|' + orient + '|' + $('detAz').value + '|' + $('detH').value + '|' + $('detBoth').checked; }
let lastKey = '';
function schedule() { dirty = true; clearTimeout(tmr); tmr = setTimeout(maybeRun, 350); }
function maybeRun() {
  const C = A() && A().C; if (!C || !visible) return;
  const key = cfgKey(C); if (!dirty && key === lastKey) return; lastKey = key; dirty = false;
  tok.forEach(t => t.cancel = true); tok = []; cells = null; Cref = C; prog = 0; draw();
  const opt = { orient, az: +$('detAz').value || 0, h: +$('detH').value || 3, step: C.T > 30 ? 1 : .75 };
  const runs = [C];
  if ($('detBoth').checked) { const c2 = JSON.parse(JSON.stringify(C.cfg)); c2.scan.side = String(-(+c2.scan.side)); try { runs.push(PA.build(c2)); } catch (e) { console.error(e); } }
  const res = []; let left = runs.length;
  runs.forEach((CC, j) => {
    tok.push(PA.detectMap(CC, opt, p => { prog = p; $('detState').textContent = 'calculando ' + Math.round(p * 100) + '%' + (runs.length > 1 ? ' (lado ' + (j + 1) + ' de 2)' : ''); }, cs => {
      res[j] = cs; if (--left) return;
      cells = res[0]; if (res[1]) cells = res[0].map((c, i) => { const d = res[1][i]; if (!d) return c; const rk = x => x.st === 'bom' ? 2 : x.st === 'fraco' ? 1 : 0; return rk(d) > rk(c) || (rk(d) === rk(c) && d.db > c.db) ? Object.assign({}, d, { lado: 'outro' }) : c; });
      cellsC = C; $('detState').textContent = 'onda ' + (C.cfg.scan.wave === 'L' ? 'L' : 'T') + ', ' + C.L.list.length + ' leis, ' + C.legs + (C.legs > 1 ? ' pernas' : ' perna') + ', index ' + f1(C.cfg.scan.index) + ' mm' + (runs.length > 1 ? ', dois lados' : '');
      draw(); summary();
    }));
  });
}

function fit(cv) { const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return { W: w, H: h, dpr: w / Math.max(1, r.width) }; }
let geom = null;
function colorOf(c) {
  if (c.st === 'bom') { const t = Math.max(0, Math.min(1, (c.db + 6) / 14)); return `rgb(${Math.round(40 + 60 * t)},${Math.round(150 + 80 * t)},${Math.round(80 + 40 * t)})`; }
  if (c.st === 'fraco') return '#e6c229';
  return (WHY[c.why] || WHY.aten)[0];
}
function draw() {
  const cv = $('detcv'), { W, H, dpr } = fit(cv), ctx = cv.getContext('2d'), C = cellsC || (A() && A().C);
  ctx.fillStyle = '#15181c'; ctx.fillRect(0, 0, W, H); if (!C) return;
  const T = C.T, Wd = C.W, hz = C.cfg.weld.haz || 0, xr = C.cfg.weld.type === 'none' ? 17 : Math.max(Wd.capHalf, Wd.botHalf || 0) + hz + 4;
  const z0 = -(Wd.capH || 0) - 2, z1 = T + (Wd.botH || 0) + 2, m = { l: 40 * dpr, r: 12 * dpr, t: 14 * dpr, b: 24 * dpr };
  const k = Math.min((W - m.l - m.r) / (2 * xr), (H - m.t - m.b) / (z1 - z0)), ox = m.l + ((W - m.l - m.r) - 2 * xr * k) / 2;
  const X = x => ox + (x + xr) * k, Z = z => m.t + (z - z0) * k;
  geom = { X, Z, k, dpr, xr, z0, ox, m };
  ctx.fillStyle = '#2a2f35'; ctx.fillRect(X(-xr), Z(0), 2 * xr * k, T * k);
  if (cells && cellsC === C) { const st = cells.length > 1 ? Math.abs(cells[1].x - cells[0].x) || 1 : 1;
    cells.forEach(c => { ctx.fillStyle = colorOf(c); ctx.fillRect(X(c.x - st / 2), Z(c.z - st / 2), st * k + .6, st * k + .6); }); }
  else { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = 13 * dpr + 'px ' + MONO; ctx.textAlign = 'center'; ctx.fillText(visible ? 'calculando ' + Math.round(prog * 100) + '%' : 'role até aqui para calcular', W / 2, H / 2); }
  // trajetos reais de algumas leis (só a parte dentro da peça, dobrado)
  const dir = C.L.dir, list = C.L.list; ctx.save(); ctx.beginPath(); ctx.rect(X(-xr), Z(0), 2 * xr * k, T * k); ctx.clip();
  list.forEach((L, i) => { if (i % Math.max(1, Math.round(list.length / 6)) && i !== list.length - 1) return;
    ctx.strokeStyle = L.bent ? 'rgba(0,217,255,.75)' : 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.1 * dpr; ctx.beginPath(); let pl = -1;
    const n = Math.ceil(C.legs * T / L.cth / .5);
    for (let j = 0; j <= n; j++) { const s = j * .5; let qx, qz; if (L.bent && s / L.bent.h < L.bent.n) { const q = Math.round(s / L.bent.h); qx = L.bent.X[q]; qz = L.bent.Z[q]; } else { qx = s * L.sth; qz = s * L.cth; }
      if (qz > C.legs * T) break; const leg = Math.floor(qz / T), x = L.xe + dir * qx, z = PA.fold(qz, T); (j && leg === pl) ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)); pl = leg; }
    ctx.stroke(); });
  ctx.restore();
  // contorno da solda
  if (C.cfg.weld.type !== 'none') { ctx.strokeStyle = 'rgba(235,240,245,.85)'; ctx.lineWidth = 1.4 * dpr; ctx.beginPath(); Wd.poly.forEach(([x, z], i) => i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))); ctx.closePath(); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(200,205,210,.5)'; ctx.lineWidth = 1; ctx.strokeRect(X(-xr), Z(0), 2 * xr * k, T * k);
  // eixos e lado do cabeçote
  ctx.fillStyle = '#9aa3ad'; ctx.font = 11 * dpr + 'px ' + MONO; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  const zs = T > 30 ? 10 : 5; for (let z = 0; z <= T + 1e-6; z += zs) ctx.fillText(String(z), m.l - 6 * dpr, Z(z));
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; for (let x = -Math.floor(xr / 10) * 10; x <= xr; x += 10) ctx.fillText((x > 0 ? '+' : '') + x, X(x), H - 6 * dpr);
  const sx = dir > 0 ? X(-xr) + 6 * dpr : X(xr) - 6 * dpr; ctx.fillStyle = '#ff6a3d'; ctx.textAlign = dir > 0 ? 'left' : 'right'; ctx.font = 12 * dpr + 'px ' + MONO;
  ctx.fillText((dir > 0 ? '◀ ' : '') + 'cabeçote deste lado' + (dir > 0 ? '' : ' ▶'), sx, Z(z0) + 10 * dpr);
}
function summary() {
  if (!cells) return; const n = cells.length, cnt = {}, why = {};
  cells.forEach(c => { cnt[c.st] = (cnt[c.st] || 0) + 1; if (c.st !== 'bom') why[c.why] = (why[c.why] || 0) + 1; });
  const pc = v => Math.round((v || 0) / n * 100) + '%';
  const items = [`<li><b>${pc(cnt.bom)}</b> da seção com sinal bom, <b>${pc(cnt.fraco)}</b> fraco e <b>${pc(cnt.nao)}</b> sem detecção para este tipo de defeito.</li>`];
  Object.entries(why).sort((a, b) => b[1] - a[1]).forEach(([w, v]) => { if (v / n < .02) return; const d = WHY[w]; items.push(`<li><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${d[0]};margin-right:6px"></i><b>${d[1]} (${pc(v)}):</b> ${d[2]} <span style="color:var(--mute)">O que fazer: ${d[3]}</span></li>`); });
  $('detSum').innerHTML = items.join('');
}
function legend() {
  $('detLeg').innerHTML = `<span><i style="background:rgb(70,190,100)"></i>Bom</span><span><i style="background:#e6c229"></i>Fraco (−6 a −14 dB)</span>` + Object.values(WHY).map(w => `<span><i style="background:${w[0]}"></i>${w[1]}</span>`).join('') + `<span><i style="background:rgba(0,217,255,.75)"></i>Trajeto real de algumas leis</span>`;
}
$('detcv').addEventListener('mousemove', e => {
  const tip = $('detTip'); if (!cells || !geom) { tip.hidden = true; return; }
  const r = e.currentTarget.getBoundingClientRect(), px = (e.clientX - r.left) * geom.dpr, py = (e.clientY - r.top) * geom.dpr;
  const x = (px - geom.ox) / geom.k - geom.xr, z = (py - geom.m.t) / geom.k + geom.z0;
  let best = null, bd = 1e9; for (const c of cells) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
  if (!best || bd > 1.2) { tip.hidden = true; return; }
  const st = best.st === 'bom' ? 'Bom' : best.st === 'fraco' ? 'Fraco' : 'Não detecta';
  tip.innerHTML = `x ${f1(best.x)} mm, prof. ${f1(best.z)} mm<br><b>${st}</b>: ${best.db > -90 ? (best.db >= 0 ? '+' : '') + f1(best.db) + ' dB da ref.' : 'sem eco'}${best.db > -90 ? ', S/R ' + f1(best.sn) + ' dB' : ''}${best.th ? '<br>Melhor lei ' + f1(best.th) + '°, perna ' + best.leg : ''}${best.lado ? ' (outro lado)' : ''}${best.st !== 'bom' ? '<br>Motivo: ' + WHY[best.why][1] : ''}`;
  tip.hidden = false; const fx = e.clientX - r.left, fy = e.clientY - r.top; tip.style.left = Math.min(fx + 14, r.width - 230) + 'px'; tip.style.top = Math.max(0, fy - 10) + 'px';
});
$('detcv').addEventListener('mouseleave', () => { $('detTip').hidden = true; });
document.querySelectorAll('#detOr button').forEach(b => b.addEventListener('click', () => { orient = b.dataset.o; document.querySelectorAll('#detOr button').forEach(x => x.setAttribute('aria-pressed', x === b)); schedule(); }));
['detAz', 'detH', 'detBoth'].forEach(id => $(id).addEventListener('change', schedule));
const prev = PA.hooks.onRebuild; PA.hooks.onRebuild = C => { if (prev) prev(C); schedule(); };
new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); if (visible) maybeRun(); }, { rootMargin: '200px' }).observe($('det'));
new ResizeObserver(() => draw()).observe($('detcv'));
legend(); schedule();
})();
