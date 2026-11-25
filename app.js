/* Simulador PAUT: interface e estado */
(function () {
'use strict';
const PA = window.PA, DEG = PA.DEG, f1 = PA.f1, $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let cfg = PA.defaultCfg(), C = null, S = null, V = null, vtok = null, buildId = 0, scene = null;
const st = { yp: 105, law: 0, gmul: 1, train: false, reveal: false, showDef: true, showCov: true, mode3d: 'corte', y1: null, y2: null, peak: null };

function scenario(id) {
  const sc = PA.SCENARIOS.find(s => s.id === id) || PA.SCENARIOS[0];
  cfg = PA.defaultCfg(); sc.set(cfg);
  $('scen').value = sc.id; $('scenNote').textContent = sc.nota;
  const d0 = cfg.defects[0]; st.yp = d0 ? Math.min(cfg.weld.len, d0.y + d0.comp / 2) : cfg.weld.len / 2; st.y1 = st.y2 = null;
  st.law = -1; renderSetup(); rebuild(true);
}

/* ---------- formulários ---------- */
const MATOPT = Object.entries(PA.MATERIALS).map(([k, v]) => [k, v.nome]).concat([['custom', 'Personalizado']]);
const F = {
  solda: [['weld.type', 'Tipo de junta', 'sel', [['V', 'V simples'], ['X', 'X (duplo V)'], ['none', 'Sem solda (bloco)']]], ['weld.T', 'Espessura', 'mm', 4, 80, .5],
    ['weld.bevel', 'Ângulo do bisel (cada lado)', '°', 5, 45, .5], ['weld.rootFace', 'Nariz', 'mm', 0, 6, .1], ['weld.gap', 'Abertura de raiz', 'mm', 0, 6, .1],
    ['weld.xMid', 'Posição do nariz (fração de T)', '', .2, .8, .05, c => c.weld.type === 'X'], ['weld.capOver', 'Sobreposição do reforço por lado', 'mm', 0, 5, .1], ['weld.capH', 'Altura do reforço', 'mm', 0, 5, .1],
    ['weld.rootOver', 'Largura extra da raiz por lado', 'mm', 0, 4, .1, c => c.weld.type === 'V'], ['weld.rootH', 'Altura da penetração', 'mm', 0, 4, .1, c => c.weld.type === 'V'],
    ['weld.hilo', 'Desalinhamento (hi-lo), + chapa direita mais baixa', 'mm', -4, 4, .1], ['weld.haz', 'ZTA considerada na cobertura', 'mm', 0, 6, .5], ['weld.len', 'Comprimento do cordão', 'mm', 100, 1000, 10]],
  material: [['mat.preset', 'Material', 'sel', MATOPT], ['mat.vL', 'Velocidade longitudinal', 'm/s', 1000, 8000, 10], ['mat.vT', 'Velocidade transversal', 'm/s', 1000, 5000, 10],
    ['mat.grain', 'Tamanho médio de grão', 'µm', 5, 400, 5], ['mat.absorp', 'Absorção', 'dB/mm/MHz', 0, .02, .0005], ['mat.aniso', 'Solda anisotrópica (grãos colunares)', 'chk']],
  cabecote: [['probe.f', 'Frequência', 'MHz', .5, 15, .25], ['probe.bw', 'Largura de banda (−6 dB)', '%', 20, 100, 5], ['probe.nTot', 'Número de elementos', '', 8, 128, 1],
    ['probe.pitch', 'Pitch', 'mm', .2, 2, .05], ['probe.elev', 'Elevação (dimensão passiva)', 'mm', 4, 30, .5], ['probe.nAct', 'Elementos ativos (abertura)', '', 2, 64, 1], ['probe.first', 'Primeiro elemento ativo', '', 1, 128, 1]],
  cunha: [['wedge.mat', 'Material da cunha', 'sel', Object.entries(PA.WEDGE_MATS).map(([k, v]) => [k, v.nome + ' (' + v.v + ' m/s)'])], ['wedge.vW', 'Velocidade na cunha', 'm/s', 1500, 3000, 10],
    ['wedge.angle', 'Ângulo da cunha', '°', 0, 60, .5], ['wedge.h1', 'Altura do 1º elemento', 'mm', 1, 40, .1], ['wedge.u1', 'Distância do 1º elemento à frente da cunha', 'mm', 0, 80, .1],
    ['wedge.len', 'Comprimento da cunha', 'mm', 15, 120, 1], ['wedge.width', 'Largura da cunha', 'mm', 8, 60, 1]],
  varredura: [['scan.mode', 'Tipo de varredura', 'sel', [['S', 'Setorial (S-scan)'], ['E', 'Linear (E-scan)']]], ['scan.wave', 'Modo de onda', 'sel', [['T', 'Transversal'], ['L', 'Longitudinal']]],
    ['scan.a0', 'Ângulo inicial', '°', 0, 85, .5, c => c.scan.mode === 'S'], ['scan.a1', 'Ângulo final', '°', 0, 85, .5, c => c.scan.mode === 'S'], ['scan.astep', 'Passo angular', '°', .1, 5, .1, c => c.scan.mode === 'S'],
    ['scan.eAng', 'Ângulo da varredura linear', '°', 0, 85, .5, c => c.scan.mode === 'E'], ['scan.eStep', 'Passo (elementos)', '', 1, 16, 1, c => c.scan.mode === 'E'],
    ['scan.focus', 'Focalização', 'sel', [['none', 'Sem foco'], ['depth', 'Profundidade real'], ['path', 'Percurso sônico']]], ['scan.fVal', 'Distância focal', 'mm', 2, 200, 1, c => c.scan.focus !== 'none'],
    ['scan.index', 'Index offset (frente da cunha ao eixo)', 'mm', 0, 150, .5], ['scan.side', 'Lado do cabeçote', 'sel', [['1', 'Esquerdo (skew 90°)'], ['-1', 'Direito (skew 270°)']]],
    ['scan.skew', 'Desvio de skew (sonda torta)', '°', -20, 20, .5], ['scan.legs', 'Pernas consideradas', '', 1, 3, 1], ['scan.range', 'Faixa de percurso (0 = automático)', 'mm', 0, 450, 1],
    ['scan.coupling', 'Perda de acoplamento', 'dB', 0, 30, .5], ['scan.transfer', 'Correção de transferência', 'dB', -10, 20, .5]],
  tela: [['disp.corr', 'Correção de ganho', 'sel', [['none', 'Nenhuma'], ['acg', 'ACG (por ângulo)'], ['tcg', 'ACG + TCG']]], ['disp.refD', 'Referência: SDH de diâmetro', 'mm', .5, 6, .1],
    ['disp.gate.mode', 'Gate A referenciado em', 'sel', [['path', 'Percurso sônico'], ['depth', 'Profundidade']]], ['disp.gate.start', 'Gate A início', 'mm', 0, 400, .5], ['disp.gate.width', 'Gate A largura', 'mm', 1, 450, .5], ['disp.gate.thr', 'Gate A limiar', '%', 1, 100, 1],
    ['disp.axis', 'Eixo do A-scan', 'sel', [['path', 'Percurso sônico (mm)'], ['depth', 'Profundidade (mm)'], ['time', 'Tempo (µs, com cunha)']]], ['disp.rf', 'A-scan em RF', 'chk'],
    ['disp.fold', 'S-scan dobrado (perna 2 sobre a peça)', 'chk'], ['disp.palette', 'Paleta', 'sel', [['amp', 'Amplitude (fundo branco)'], ['escuro', 'Amplitude (fundo escuro)'], ['cinza', 'Cinza']]],
    ['disp.noise', 'Ruído de grão', 'chk'], ['disp.geo', 'Ecos de geometria (raiz e reforço)', 'chk'], ['disp.overlay', 'Sobreposição da solda', 'chk']]
};
const TABS = [['solda', 'Solda'], ['material', 'Material'], ['cabecote', 'Cabeçote'], ['cunha', 'Cunha'], ['varredura', 'Varredura'], ['tela', 'Tela'], ['defeitos', 'Defeitos']];
let tab = 'solda';
const get = p => p.split('.').reduce((o, k) => o[k], cfg);
const set = (p, v) => { const k = p.split('.'), last = k.pop(); k.reduce((o, q) => o[q], cfg)[last] = v; };

function field(f) {
  const [p, lab, unit, a, b, step, cond] = f; if (typeof cond === 'function' && !cond(cfg)) return '';
  const id = 'f_' + p.replace(/\./g, '_'), v = get(p);
  if (unit === 'sel') return `<label class="fld" for="${id}"><span>${esc(lab)}</span><select id="${id}" data-p="${p}">${a.map(o => `<option value="${esc(o[0])}"${String(v) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  if (unit === 'chk') return `<label class="fld chk" for="${id}"><input type="checkbox" id="${id}" data-p="${p}"${v ? ' checked' : ''}><span>${esc(lab)}</span></label>`;
  return `<label class="fld" for="${id}"><span>${esc(lab)}</span><span class="num"><input type="number" id="${id}" data-p="${p}" value="${v}" min="${a}" max="${b}" step="${step}" inputmode="decimal">${unit ? `<i>${esc(unit)}</i>` : ''}</span></label>`;
}
function renderSetup() {
  $('tabs').innerHTML = TABS.map(([k, n]) => `<button role="tab" data-t="${k}" aria-selected="${k === tab}">${n}</button>`).join('');
  $('form').innerHTML = tab === 'defeitos' ? defectsUI() : `<div class="fields">${F[tab].map(field).join('')}</div><div id="derived"></div>`;
  if (C) renderDerived();
}
function renderDerived() {
  const el = $('derived'); if (!el || !C) return;
  const L = C.L, list = L.list, p = cfg.probe, r = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  let rows = [];
  const att = C.A.a;
  if (tab === 'material' || tab === 'solda') rows = [r('Comprimento de onda', f1(L.lam) + ' mm'), r('Atenuação em ' + f1(p.f) + ' MHz', (att).toFixed(3).replace('.', ',') + ' dB/mm'),
    r('Perda ida e volta até T', f1(2 * att * cfg.weld.T) + ' dB'), r('Perda ida e volta até 2T', f1(4 * att * cfg.weld.T) + ' dB'), r('Nível de ruído relativo', f1(20 * Math.log10(C.A.noise / .008 * C.A.weldN)) + ' dB')];
  if (tab === 'cabecote') { const sp = p.pitch / L.lamW, l0 = list[0];
    rows = [r('Abertura ativa', f1(p.nAct * p.pitch) + ' mm'), r('λ na peça / na cunha', f1(L.lam) + ' / ' + f1(L.lamW) + ' mm'), r('Pitch / λ na cunha', sp.toFixed(2).replace('.', ',')),
      r('Campo próximo (lei de ref.)', C.refLaw ? f1(C.refLaw.N) + ' mm' : '—'), r('Feixe −6 dB no foco (lei de ref.)', C.refLaw ? f1(1.18 * C.refLaw.w0) + ' mm' : '—'),
      r('Feixe −6 dB na elevação', C.refLaw ? f1(1.18 * C.refLaw.we((C.T) / C.refLaw.cth)) + ' mm em T' : '—'), r('Lóbulo de grade', list.some(l => l.gl) ? '<b class="warn">sim</b>' : 'não'), r('Duração do pulso (−6 dB)', f1(.88 / (p.bw / 100 * p.f)) + ' µs')]; }
  if (tab === 'cunha') { const ex = list.map(l => l.dirX = (l.xe - L.xf) * -L.dir); rows = [r('Ângulo natural (onda ' + (cfg.scan.wave === 'L' ? 'L' : 'T') + ')', f1(L.thNat / DEG) + '°'),
    r('1º ângulo crítico na cunha', f1(L.ac1 / DEG) + '°'), r('2º ângulo crítico na cunha', f1(L.ac2 / DEG) + '°'),
    r('Ponto de saída atrás da frente', ex.length ? f1(Math.min(...ex)) + ' a ' + f1(Math.max(...ex)) + ' mm' : '—'), r('Atraso de cunha', list.length ? f1(Math.min(...list.map(l => l.tW))) + ' a ' + f1(Math.max(...list.map(l => l.tW))) + ' µs' : '—')]; }
  if (tab === 'varredura') rows = [r('Leis focais', String(list.length)), r('Cobertura da solda e ZTA', `<b class="${C.covPct < 99 ? 'warn' : 'ok'}">${f1(C.covPct)}%</b>`), r('Faixa de percurso', f1(C.range) + ' mm'),
    r('Desvio lateral do feixe a 50 mm', f1(Math.tan(cfg.scan.skew * DEG) * 50) + ' mm')];
  if (tab === 'tela') rows = [r('Ganho de referência', f1(C.Gref) + ' dB'), r('Ganho total', f1(C.Gref + cfg.disp.dGain + cfg.scan.transfer) + ' dB')];
  let table = '';
  if (tab === 'varredura' || tab === 'cunha') table = `<details><summary>Tabela de leis focais</summary><div class="scroll"><table><thead><tr><th>Lei</th><th>Âng.</th><th>Cunha</th><th>Saída</th><th>Atraso</th><th>Foco</th><th>Feixe</th></tr></thead><tbody>${
    list.map((l, i) => `<tr><td>${i + 1}</td><td>${f1(l.th / DEG)}°</td><td>${f1(l.al / DEG)}°</td><td>${f1((l.xe - L.xf) * -L.dir)}</td><td>${f1(l.tW)}</td><td>${isFinite(l.Fs) ? f1(l.Fs) : '—'}</td><td>${f1(1.18 * l.w0)}${l.gl ? ' *' : ''}</td></tr>`).join('')}</tbody></table></div><p class="note">Saída em mm atrás da frente da cunha; atraso em µs; feixe é a largura −6 dB no foco; * indica lóbulo de grade.</p></details>`;
  el.innerHTML = `<dl class="der">${rows.join('')}</dl>${table}`;
}
function defectsUI() {
  const types = Object.entries(PA.DEF_TYPES);
  const hide = st.train && !st.reveal;
  const items = cfg.defects.map((d, i) => {
    const t = PA.DEF_TYPES[d.type], name = hide ? 'Indicação ' + (i + 1) : t.nome;
    const fields = t.p.map(q => { const id = `e_${d.id}_${q[0]}`;
      if (q[3] === 'sel') return `<label class="fld" for="${id}"><span>${esc(q[1])}</span><select id="${id}" data-d="${d.id}" data-k="${q[0]}">${q[4].map(o => `<option value="${o[0]}"${d[q[0]] === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;
      return `<label class="fld" for="${id}"><span>${esc(q[1])}</span><span class="num"><input type="number" id="${id}" data-d="${d.id}" data-k="${q[0]}" value="${d[q[0]]}" min="${q[4]}" max="${q[5]}" step="${q[6]}">${q[3] ? `<i>${q[3]}</i>` : ''}</span></label>`; }).join('');
    return `<li><div class="dh"><input type="checkbox" data-on="${d.id}" ${d.on ? 'checked' : ''} aria-label="Ativar ${esc(name)}"><i style="background:${hide ? '#59616b' : t.cor}"></i><b>${esc(name)}</b><span>Y ${f1(d.y)} a ${f1(d.y + d.comp)}</span>
      <button data-go="${d.id}">Ir</button></div>${hide ? '' : `<details><summary>Editar</summary><div class="fields">
      <label class="fld" for="e_${d.id}_y"><span>Início em Y</span><span class="num"><input type="number" id="e_${d.id}_y" data-d="${d.id}" data-k="y" value="${d.y}" min="0" max="${cfg.weld.len}" step="1"><i>mm</i></span></label>
      <label class="fld" for="e_${d.id}_comp"><span>Comprimento</span><span class="num"><input type="number" id="e_${d.id}_comp" data-d="${d.id}" data-k="comp" value="${d.comp}" min="1" max="${cfg.weld.len}" step="1"><i>mm</i></span></label>
      ${fields}</div><button class="ghost" data-del="${d.id}">Remover defeito</button></details>`}</li>`;
  }).join('');
  return `<div class="trainrow"><label class="fld chk"><input type="checkbox" id="trainChk" ${st.train ? 'checked' : ''}><span>Modo treino: esconder defeitos</span></label>${st.train ? `<button class="ghost" id="reveal">${st.reveal ? 'Esconder' : 'Revelar'}</button>` : ''}</div>
    <ul class="defs">${items || '<li class="note">Nenhum defeito. Adicione abaixo.</li>'}</ul>
    <div class="add"><select id="newType" aria-label="Tipo de defeito">${types.map(([k, t]) => `<option value="${k}">${t.nome}</option>`).join('')}</select><button id="addDef">Adicionar em Y ${Math.round(st.yp)}</button></div>`;
}

/* ---------- eventos do formulário ---------- */
let tmr = 0;
const later = (fn, ms) => { clearTimeout(tmr); tmr = setTimeout(fn, ms); };
$('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.t; renderSetup(); });
$('form').addEventListener('change', onForm); $('form').addEventListener('input', e => { if (e.target.type === 'number') onForm(e, true); });
function onForm(e, typing) {
  const t = e.target;
  if (t.id === 'trainChk') { st.train = t.checked; st.reveal = false; renderSetup(); refresh(); return; }
  if (t.dataset.on) { const d = cfg.defects.find(x => x.id === t.dataset.on); d.on = t.checked; rebuild(); return; }
  if (t.dataset.d) { const d = cfg.defects.find(x => x.id === t.dataset.d), k = t.dataset.k; const v = t.tagName === 'SELECT' ? t.value : parseFloat(t.value); if (t.tagName !== 'SELECT' && !isFinite(v)) return;
    d[k] = v; later(() => { rebuild(); if (!typing) renderSetup(); }, typing ? 350 : 0); return; }
  const p = t.dataset.p; if (!p) return;
  let v = t.type === 'checkbox' ? t.checked : t.tagName === 'SELECT' ? t.value : parseFloat(t.value);
  if (t.type === 'number' && !isFinite(v)) return;
  if (p === 'scan.side') v = +v;
  set(p, v);
  if (p === 'mat.preset' && PA.MATERIALS[v]) Object.assign(cfg.mat, PA.MATERIALS[v]);
  else if (p.startsWith('mat.') && p !== 'mat.preset') cfg.mat.preset = 'custom';
  if (p === 'wedge.mat') cfg.wedge.vW = PA.WEDGE_MATS[v].v;
  if (p === 'probe.nAct' || p === 'probe.nTot') cfg.probe.first = Math.min(cfg.probe.first, Math.max(1, cfg.probe.nTot - cfg.probe.nAct + 1));
  const soft = /^disp\.(axis|rf|palette|overlay)$/.test(p);
  if (soft) { refresh(); return; }
  later(() => { rebuild(); if (t.tagName === 'SELECT' || t.type === 'checkbox') renderSetup(); else renderDerived(); }, typing ? 300 : 0);
}
$('form').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.go) { const d = cfg.defects.find(x => x.id === t.dataset.go); stop(); setY(d.y + d.comp / 2); }
  if (t.dataset.del) { cfg.defects = cfg.defects.filter(x => x.id !== t.dataset.del); renderSetup(); rebuild(); }
  if (t.id === 'addDef') { const ty = $('newType').value, d = PA.newDefect(ty, Math.max(0, Math.round(st.yp) - 10), ty === 'poro' ? 2 : ty === 'trinca-transversal' ? 2 : 20);
    if (ty === 'sdh') d.comp = 30; cfg.defects.push(d); renderSetup(); rebuild(); }
  if (t.id === 'reveal') { st.reveal = !st.reveal; renderSetup(); refresh(); }
});
$('scen').innerHTML = PA.SCENARIOS.map(s => `<option value="${s.id}">${esc(s.nome)}</option>`).join('');
$('scen').addEventListener('change', e => { stop(); scenario(e.target.value); });

/* ---------- barra de varredura ---------- */
function setY(y) { st.yp = Math.max(0, Math.min(cfg.weld.len, y)); $('yp').value = st.yp; refresh(); }
$('yp').addEventListener('input', e => { stop(); setY(+e.target.value); });
$('law').addEventListener('input', e => { st.law = +e.target.value; refresh(); });
$('gain').addEventListener('input', e => { cfg.disp.dGain = +e.target.value; refresh(); renderDerived(); });
$('gm6').addEventListener('click', () => { cfg.disp.dGain -= 6; $('gain').value = cfg.disp.dGain; refresh(); });
$('gp6').addEventListener('click', () => { cfg.disp.dGain += 6; $('gain').value = cfg.disp.dGain; refresh(); });
$('m1').addEventListener('click', () => { st.y1 = st.yp; refresh(); });
$('m2').addEventListener('click', () => { st.y2 = st.yp; refresh(); });
$('mc').addEventListener('click', () => { st.y1 = st.y2 = null; refresh(); });
$('cov').addEventListener('change', e => { st.showCov = e.target.checked; refresh(); });
$('defShow').addEventListener('change', e => { st.showDef = e.target.checked; refresh(); });
document.querySelectorAll('#mode3d button').forEach(b => b.addEventListener('click', () => { st.mode3d = b.dataset.m; document.querySelectorAll('#mode3d button').forEach(x => x.setAttribute('aria-pressed', x === b)); refresh(); }));
$('recenter').addEventListener('click', () => { if (scene) { scene.resetCam(); refresh(); } });
let playing = false, lastT = 0;
function stop() { playing = false; $('play').textContent = 'Varrer'; $('play').classList.remove('on'); }
$('play').addEventListener('click', () => { if (playing) return stop(); playing = true; $('play').textContent = 'Parar'; $('play').classList.add('on'); if (st.yp >= cfg.weld.len) st.yp = 0; lastT = performance.now(); requestAnimationFrame(tick); });
function tick(t) { if (!playing) return; const dt = Math.min(.1, (t - lastT) / 1000); lastT = t; const y = st.yp + dt * +$('speed').value; if (y >= cfg.weld.len) { setY(cfg.weld.len); return stop(); } setY(y); requestAnimationFrame(tick); }
['top', 'side'].forEach(id => $(id + 'cv').addEventListener('click', e => { const g = $(id + 'cv')._geom; if (!g) return; const r = e.target.getBoundingClientRect(); const y = ((e.clientX - r.left) * g.dpr - g.m.l) / (g.W - g.m.l - g.m.r) * g.lenY; if (y >= 0 && y <= g.lenY) { stop(); setY(y); } }));
$('seccv').addEventListener('click', e => {
  const g = $('seccv')._geom; if (!g || !C) return; const cv = $('seccv'), r = cv.getBoundingClientRect(), dpr = cv.width / r.width;
  const x = g.xl + ((e.clientX - r.left) * dpr - g.X(g.xl)) / g.k, z = g.zTop + ((e.clientY - r.top) * dpr - g.Z(g.zTop)) / g.k; if (z <= 0) return;
  let best = 0, bd = 1e9; C.L.list.forEach((L, i) => { const zu = z, d = Math.abs(L.xe + C.L.dir * zu * L.sth / L.cth - x); if (d < bd) { bd = d; best = i; } });
  st.law = best; $('law').value = best; refresh();
});

/* ---------- ciclo ---------- */
function rebuild(first) {
  const prevTh = C && C.L.list[st.law] ? C.L.list[st.law].th : 55 * DEG;
  C = PA.build(cfg); C.id = ++buildId;
  const list = C.L.list;
  if (list.length) {
    if (cfg.scan.mode === 'E') st.law = st.law < 0 ? Math.floor(list.length / 2) : Math.min(st.law, list.length - 1);
    else { const tg = first ? 61 * DEG : prevTh; st.law = list.reduce((b, L, i) => Math.abs(L.th - tg) < Math.abs(list[b].th - tg) ? i : b, 0); }
  } else st.law = 0;
  $('law').max = Math.max(0, list.length - 1); $('law').value = st.law;
  $('yp').max = cfg.weld.len; $('gain').value = cfg.disp.dGain;
  $('warn').innerHTML = C.L.warn.map(w => `<li>${esc(w)}</li>`).join('');
  if (scene) scene.setup(C);
  V = null; if (vtok) vtok.cancel = true;
  $('volState').textContent = 'calculando…';
  vtok = PA.volumes(C, p => { $('volState').textContent = 'calculando ' + Math.round(p * 100) + '%'; }, res => { V = res; $('volState').textContent = 'gate A, ' + f1(C.gs) + ' a ' + f1(C.ge) + ' mm'; drawVols(); readouts(); });
  refresh(); renderDerived();
}
let raf = 0;
function refresh() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; draw(); }); }
function draw() {
  if (!C) return;
  st.gmul = Math.pow(10, (cfg.disp.dGain + cfg.scan.transfer) / 20);
  const showDef = st.showDef && (!st.train || st.reveal);
  const vst = Object.assign({}, st, { train: st.train && !st.reveal, showDef });
  S = PA.scanAt(C, st.yp);
  st.peak = C.L.list.length ? PA.peak(C, S, st) : null; vst.peak = st.peak;
  PA.drawSector($('seccv'), C, S, vst); PA.drawAscan($('ascv'), C, S, vst);
  drawVols(vst);
  if (scene) scene.update(C, vst);
  readouts();
  const L = C.L.list[st.law];
  $('lawO').textContent = L ? (cfg.scan.mode === 'S' ? f1(L.th / DEG) + '°' : 'el. ' + (L.k0 + 1) + '–' + (L.k0 + L.n) + ', ' + f1(L.th / DEG) + '°') : '—';
  $('ypO').textContent = f1(st.yp) + ' mm';
  $('gainO').textContent = f1(C.Gref + cfg.disp.dGain + cfg.scan.transfer) + ' dB';
  $('gainSub').textContent = (cfg.disp.dGain >= 0 ? 'ref. + ' : 'ref. − ') + f1(Math.abs(cfg.disp.dGain)) + ' dB';
  $('secT').textContent = (cfg.scan.mode === 'S' ? 'S-scan ' + f1(cfg.scan.a0) + '° a ' + f1(cfg.scan.a1) + '°' : 'E-scan ' + f1(cfg.scan.eAng) + '°') + (cfg.disp.fold ? ', dobrado' : ', pernas desdobradas');
  $('covO').textContent = cfg.weld.type === 'none' ? '' : 'cobertura ' + f1(C.covPct) + '%';
  $('lbar').style.background = PA.paletteCss(cfg.disp.palette);
}
function drawVols(vst) {
  vst = vst || Object.assign({}, st, { train: st.train && !st.reveal, showDef: st.showDef && (!st.train || st.reveal) });
  PA.drawTop($('topcv'), C, V, vst); PA.drawSide($('sidecv'), C, V, vst); PA.drawEnd($('endcv'), C, V, vst);
}
function readouts() {
  const p = st.peak, L = p && p.L, g = cfg.disp.gate;
  const len = p && p.ok && V ? PA.length6dB(C, V, st.yp, p.x) : null;
  const rows = [
    ['A% no gate', p ? Math.min(999, p.a * 100).toFixed(0) + '%' : '—', p && p.ok ? 'hot' : ''],
    ['Em relação à ref.', p && p.a > 0 ? (v => (v >= 0 ? '+' : '') + f1(v))(20 * Math.log10(p.a / .8) - cfg.disp.dGain) + ' dB' : '—'],
    ['SA percurso', p ? f1(p.s) + ' mm' : '—'], ['DA profundidade', p ? f1(p.depth) + ' mm' : '—'],
    ['PA da frente da cunha', p ? f1((p.x - C.L.xf) * C.L.dir) + ' mm' : '—'], ['Do eixo da solda', p ? (p.x >= 0 ? '+' : '') + f1(p.x) + ' mm' : '—'],
    ['Perna', p ? String(p.leg) : '—'], ['Comprimento −6 dB', len ? f1(len.len) + ' mm' : '—'],
    ['Cursores Y1 a Y2', st.y1 != null && st.y2 != null ? f1(Math.abs(st.y2 - st.y1)) + ' mm' : st.y1 != null ? 'Y1 ' + f1(st.y1) : '—'],
    ['Saída da lei', L ? f1((L.xe - C.L.xf) * -C.L.dir) + ' mm atrás' : '—'], ['Atraso de cunha', L ? f1(L.tW) + ' µs' : '—'], ['Gate A', f1(C.gs) + ' a ' + f1(C.ge) + (g.mode === 'depth' ? ' prof.' : ' perc.')]
  ];
  $('read').innerHTML = rows.map(r => `<div class="${r[2] || ''}"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
}

/* ---------- início ---------- */
try { scene = PA.Scene($('v3dhost')); } catch (err) { console.error(err); }
const ro = new ResizeObserver(() => refresh()); ['seccv', 'ascv', 'topcv', 'sidecv', 'endcv'].forEach(id => ro.observe($(id)));
scenario('padrao');
})();
