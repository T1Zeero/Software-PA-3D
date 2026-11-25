/* Simulador PAUT: cena 3D (Three.js r128) */
(function () {
'use strict';
const PA = window.PA, DEG = PA.DEG;

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }
function label(text, opt) {
  opt = opt || {}; const fs = 44, pad = 14, c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = '600 ' + fs + 'px "IBM Plex Sans",sans-serif'; const w = Math.ceil(g.measureText(text).width) + pad * 2; c.width = w; c.height = fs + pad * 1.6;
  const g2 = c.getContext('2d'); g2.fillStyle = opt.bg || 'rgba(17,19,21,.82)'; const r = 10; g2.beginPath(); g2.moveTo(r, 0); g2.arcTo(w, 0, w, c.height, r); g2.arcTo(w, c.height, 0, c.height, r); g2.arcTo(0, c.height, 0, 0, r); g2.arcTo(0, 0, w, 0, r); g2.fill();
  g2.font = '600 ' + fs + 'px "IBM Plex Sans",sans-serif'; g2.fillStyle = opt.color || '#e9ecef'; g2.textBaseline = 'middle'; g2.fillText(text, pad, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  const hgt = opt.size || 4; sp.scale.set(hgt * w / c.height, hgt, 1); sp.renderOrder = 10; return sp;
}

PA.Scene = function (host) {
  if (!window.THREE || !THREE.OrbitControls) { host.innerHTML = '<p class="note" style="padding:40px 16px">Não foi possível carregar o Three.js. Verifique a conexão.</p>'; return null; }
  const ren = new THREE.WebGLRenderer({ antialias: true });
  ren.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); ren.localClippingEnabled = true;
  ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
  ren.outputEncoding = THREE.sRGBEncoding; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = .82;
  host.appendChild(ren.domElement);
  const scene = new THREE.Scene();
  scene.background = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a3038'); gr.addColorStop(1, '#101215'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  if (THREE.RoomEnvironment) { const pm = new THREE.PMREMGenerator(ren); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), .04).texture; }
  const cam = new THREE.PerspectiveCamera(24, 1, 1, 8000);
  const ctl = new THREE.OrbitControls(cam, ren.domElement); ctl.enableDamping = true; ctl.dampingFactor = .1; ctl.maxPolarAngle = Math.PI * .97;
  scene.add(new THREE.HemisphereLight('#dfe8f2', '#2a2e33', .45));
  const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(-160, 260, 180); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 10, far: 900 }); key.shadow.bias = -.0005;
  scene.add(key); scene.add(key.target);
  const fill = new THREE.DirectionalLight('#9fc3ff', .45); fill.position.set(200, 80, -150); scene.add(fill);
  const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

  // texturas
  const brushed = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#9aa4ae'; g.fillRect(0, 0, w, h); const r = PA.rng(5);
    for (let i = 0; i < 2600; i++) { const y = r() * h, l = 40 + r() * 220, x = r() * w; g.strokeStyle = `rgba(${r() < .5 ? '255,255,255' : '40,46,54'},${.04 + r() * .07})`; g.lineWidth = .6 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (r() - .5) * 2); g.stroke(); } });
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping; brushed.repeat.set(.012, .012); brushed.encoding = THREE.sRGBEncoding;
  const ripple = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b8a68c'; g.fillRect(0, 0, w, h);
    for (let i = -2; i < 12; i++) { g.strokeStyle = 'rgba(70,55,40,.35)'; g.lineWidth = 6; g.beginPath(); g.ellipse(w / 2, i * 24, w * .7, 30, 0, 0, Math.PI); g.stroke(); g.strokeStyle = 'rgba(255,240,215,.25)'; g.lineWidth = 3; g.beginPath(); g.ellipse(w / 2, i * 24 + 6, w * .7, 30, 0, 0, Math.PI); g.stroke(); } });
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping; ripple.repeat.set(.04, .04); ripple.encoding = THREE.sRGBEncoding;

  const mats = {
    steel: new THREE.MeshStandardMaterial({ color: '#7f8992', map: brushed, metalness: .65, roughness: .45, side: THREE.DoubleSide }),
    weld: new THREE.MeshStandardMaterial({ color: '#b9a88f', map: ripple, metalness: .55, roughness: .5, side: THREE.DoubleSide }),
    steelX: new THREE.MeshStandardMaterial({ color: '#9aa7b4', metalness: .3, roughness: .5, transparent: true, opacity: .2, depthWrite: false, side: THREE.DoubleSide }),
    weldX: new THREE.MeshStandardMaterial({ color: '#d0aa74', metalness: .3, roughness: .5, transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide })
  };
  let stat = new THREE.Group(), defG = new THREE.Group(), probe = new THREE.Group(), follow = new THREE.Group();
  scene.add(stat, defG, probe, follow);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: .35 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const grid = new THREE.GridHelper(2000, 100, '#3a4048', '#262b31'); scene.add(grid);
  const beam = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .42, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  beam.renderOrder = 5; scene.add(beam);
  let ray = null, glLine = null;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 12), new THREE.MeshBasicMaterial({ color: '#ff2d55', depthTest: false })); dot.renderOrder = 12; scene.add(dot);
  let cap = null, capCtx = null, capBase = null, capInfo = null, plates = [], defMeshes = {}, elems = [], lastZ = null, C0 = null, mode = 'corte';

  const disposeGroup = g => { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material.map !== brushed && o.material.map !== ripple) o.material.map.dispose(); }); while (g.children.length) g.remove(g.children[0]); };
  const V2 = (x, z) => new THREE.Vector2(x, -z);

  function extrude(pts, mat, len) {
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: len, bevelEnabled: false, curveSegments: 24 }); geo.translate(0, 0, -len / 2);
    const me = new THREE.Mesh(geo, mat); me.castShadow = true; me.receiveShadow = true; return me;
  }

  function setup(C) {
    C0 = C; disposeGroup(stat); disposeGroup(defG); disposeGroup(probe); disposeGroup(follow); plates = []; defMeshes = {};
    const cfg = C.cfg, W = C.W, T = C.T, len = C.len, W0 = Math.max(60, cfg.scan.index + cfg.wedge.len + 25), hl = cfg.weld.hilo || 0;
    // chapas
    if (cfg.weld.type === 'none') plates.push(extrude([V2(-W0, 0), V2(W0, 0), V2(W0, T), V2(-W0, T)], mats.steel, len));
    else {
      const left = [V2(-W0, 0)]; W.zs.forEach(z => left.push(V2(-W.half(z), z))); left.push(V2(-W0, T));
      const right = [V2(W0, hl)]; W.zs.forEach(z => right.push(V2(W.half(z), z + hl * 0))); right.push(V2(W0, T + hl));
      plates.push(extrude(left, mats.steel, len)); const pr = extrude(right.map((v, i) => i === 0 || i === right.length - 1 ? v : v), mats.steel, len); plates.push(pr);
      plates.push(extrude(W.poly.map(([x, z]) => V2(x, z)), mats.weld, len)); plates[2].userData.weld = 1;
    }
    plates.forEach(p => stat.add(p));
    ground.position.y = -T - (W.botH || 0) - Math.abs(hl) - .5; grid.position.y = ground.position.y + .02;
    // tampa do corte (macrografia)
    const zt = -(W.capH || 0) - 2, zb = T + Math.max(W.botH || 0, Math.abs(hl)) + 2, cw = 2048, ch = Math.round(cw * (zb - zt) / (2 * W0));
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = Math.max(64, ch); capCtx = cv.getContext('2d');
    capInfo = { W0, zt, zb, k: cw / (2 * W0) };
    capBase = macro(C, capInfo, cv.width, cv.height);
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    cap = new THREE.Mesh(new THREE.PlaneGeometry(2 * W0, zb - zt), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .05, side: THREE.DoubleSide, toneMapped: false }));
    cap.position.set(0, -(zt + zb) / 2, 0); stat.add(cap);
    // régua ao longo do cordão (borda esquerda) e marcações
    const tick = new THREE.LineBasicMaterial({ color: '#c9d1d9', clippingPlanes: [clip] }), tp = [];
    for (let y = 0; y <= len; y += 10) { const L = y % 50 === 0 ? 6 : 3; tp.push(-W0, .05, y - len / 2, -W0 + L, .05, y - len / 2); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); stat.add(new THREE.LineSegments(tg, tick));
    for (let y = 0; y <= len; y += 50) { const l = label('Y ' + y, { size: 3.2 }); l.position.set(-W0 + 10, 3, y - len / 2); l.userData.ry = y; stat.add(l); }
    const wcl = new THREE.BufferGeometry(); const wp = []; for (let y = 0; y < len; y += 8) wp.push(0, (W.capH || 0) + .05, y - len / 2, 0, (W.capH || 0) + .05, Math.min(len, y + 4) - len / 2);
    wcl.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); stat.add(new THREE.LineSegments(wcl, new THREE.LineBasicMaterial({ color: '#ffd166', clippingPlanes: [clip] })));
    const lw = label('Eixo da solda', { size: 3.4, color: '#ffd166' }); lw.position.set(0, (W.capH || 0) + 5, -len / 2 - 4); stat.add(lw);
    const lt = label('T = ' + PA.f1(T) + ' mm', { size: 3.2 }); lt.position.set(-W0 + 8, -T / 2, len / 2 + 6); stat.add(lt);
    // defeitos
    const cols = {}; cfg.defects.forEach(d => cols[d.id] = PA.DEF_TYPES[d.type].cor);
    C.prims.forEach(P => {
      if (P.def === 'geo') return;
      const col = new THREE.Color(cols[P.def] || '#fff');
      const m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .45, roughness: .45, metalness: .1, side: THREE.DoubleSide, clippingPlanes: [clip] });
      let me;
      const zc = (P.y1 + P.y2) / 2 - len / 2, ly = Math.max(.6, P.y2 - P.y1);
      if (P.kind === 'pt') {
        if (P.y2 - P.y1 > .01) { me = new THREE.Mesh(new THREE.CylinderGeometry(P.r, P.r, ly, 14), m); me.rotation.x = Math.PI / 2; }
        else me = new THREE.Mesh(new THREE.SphereGeometry(P.r, 18, 12), m);
        me.position.set(P.x, -P.z, zc);
        if (P.tip) me.visible = false;
      } else {
        const ny = Math.max(2, Math.ceil(ly / 1.2)), nu = 6, pos = [], idx = [], r = PA.rng(Math.round(P.y1 * 13 + P.x1 * 7 + 11));
        for (let j = 0; j <= ny; j++) for (let i = 0; i <= nu; i++) { const t = i / nu, jit = P.rough ? (r() - .5) * .6 : 0;
          pos.push(P.x1 + (P.x2 - P.x1) * t + jit, -(P.z1 + (P.z2 - P.z1) * t), P.y1 + (P.y2 - P.y1) * j / ny - len / 2); }
        for (let j = 0; j < ny; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); me = new THREE.Mesh(g, m);
      }
      me.userData.def = P.def; me.userData.tip = !!P.tip; defG.add(me); (defMeshes[P.def] = defMeshes[P.def] || []).push(me);
    });
    // sonda
    buildProbe(C);
    applyMode();
  }

  function macro(C, I, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), cfg = C.cfg, W = C.W, T = C.T, hl = cfg.weld.hilo || 0;
    const X = x => (x + I.W0) * I.k, Z = z => (z - I.zt) * I.k, r = PA.rng(17);
    const poly = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.closePath(); };
    const grain = (col, n) => { for (let i = 0; i < n; i++) { g.fillStyle = col(r()); g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); } };
    // metal base
    g.save();
    if (cfg.weld.type === 'none') poly([[-I.W0, 0], [I.W0, 0], [I.W0, T], [-I.W0, T]]);
    else { const L = [[-I.W0, 0], ...W.zs.map(z => [-W.half(z), z]), [-I.W0, T]], R = [[I.W0, hl], ...W.zs.map(z => [W.half(z), z]), [I.W0, T + hl]]; poly(L); g.save(); g.clip(); paintBase(); g.restore(); poly(R); }
    g.clip(); paintBase(); g.restore();
    function paintBase() { const gr = g.createLinearGradient(0, Z(0), 0, Z(T)); gr.addColorStop(0, '#7b838b'); gr.addColorStop(1, '#646c74'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      grain(v => `rgba(${v < .5 ? '40,44,50' : '200,206,212'},${.08 + v * .1})`, w * h / 60); }
    if (cfg.weld.type !== 'none') {
      // ZTA
      g.save(); g.lineJoin = 'round'; g.strokeStyle = 'rgba(58,44,30,.6)'; g.lineWidth = (cfg.weld.haz || 2) * 2 * I.k;
      g.beginPath(); W.zs.forEach((z, i) => i ? g.lineTo(X(W.half(z)), Z(z)) : g.moveTo(X(W.half(z)), Z(z))); g.stroke();
      g.beginPath(); W.zs.forEach((z, i) => i ? g.lineTo(X(-W.half(z)), Z(z)) : g.moveTo(X(-W.half(z)), Z(z))); g.stroke(); g.restore();
      // metal de solda com grãos colunares
      poly(W.poly); g.save(); g.clip(); g.fillStyle = '#d2b98f'; g.fillRect(0, 0, w, h);
      const nP = Math.round(5 + T / 4);
      for (let i = 0; i < nP; i++) { const z0 = -W.capH + (T + W.capH + W.botH) * i / nP; g.strokeStyle = 'rgba(90,72,55,.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(X(0), Z(z0), W.capHalf * I.k * 1.1, (T / nP) * I.k * 1.3, 0, 0, Math.PI); g.stroke(); }
      g.globalAlpha = .28; for (let i = 0; i < 900; i++) { const z = -W.capH + r() * (T + W.capH + W.botH), side = r() < .5 ? -1 : 1, x0 = side * (W.half(Math.max(0, Math.min(T, z))) * r()), L = 6 + r() * 18;
        g.strokeStyle = r() < .5 ? '#6d5c49' : '#e9dcc6'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(x0), Z(z)); g.lineTo(X(x0) - side * L * .8, Z(z) - L * .5); g.stroke(); }
      g.restore(); g.globalAlpha = 1;
      g.strokeStyle = 'rgba(40,32,24,.7)'; g.lineWidth = 2; poly(W.poly); g.stroke();
    }
    return c;
  }

  function buildProbe(C) {
    const cfg = C.cfg, wd = cfg.wedge, p = cfg.probe, dir = C.L.dir, om = wd.angle * DEG;
    const h0 = Math.max(.5, wd.h1 - wd.u1 * Math.tan(om)), hL = wd.h1 + (wd.len - wd.u1) * Math.tan(om);
    const P = (u, h) => new THREE.Vector2(-dir * u, h);
    const wgeo = new THREE.ExtrudeGeometry(new THREE.Shape([P(0, 0), P(wd.len, 0), P(wd.len, hL), P(0, h0)]), { depth: wd.width, bevelEnabled: false }); wgeo.translate(0, 0, -wd.width / 2);
    const wedge = new THREE.Mesh(wgeo, new THREE.MeshPhysicalMaterial({ color: '#d99a4e', roughness: .2, metalness: 0, transparent: true, opacity: .5, side: THREE.DoubleSide, clearcoat: .6, depthWrite: false }));
    wedge.castShadow = true; probe.add(wedge);
    elems = [];
    const eg = new THREE.BoxGeometry(p.pitch * .82, .5, p.elev);
    for (let k = 0; k < p.nTot; k++) { const u = wd.u1 + k * p.pitch * Math.cos(om), h = wd.h1 + k * p.pitch * Math.sin(om);
      const m = new THREE.Mesh(eg, new THREE.MeshStandardMaterial({ color: '#444b53', emissive: '#000000', roughness: .5 }));
      m.position.set(-dir * u, h + .3, 0); m.rotation.z = dir * om; probe.add(m); elems.push(m); }
    const arrL = p.nTot * p.pitch, um = wd.u1 + arrL / 2 * Math.cos(om), hm = wd.h1 + arrL / 2 * Math.sin(om);
    const hs = new THREE.Mesh(new THREE.BoxGeometry(arrL + 8, 14, p.elev + 8), new THREE.MeshStandardMaterial({ color: '#2b3038', metalness: .4, roughness: .35 }));
    hs.position.set(-dir * (um + Math.sin(om) * 8 * 0), hm + 7.6 * Math.cos(om) + .6, 0); hs.rotation.z = dir * om; hs.castShadow = true; probe.add(hs);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(arrL + 8.2, 2, p.elev + 8.2), new THREE.MeshStandardMaterial({ color: '#ff6a3d', emissive: '#ff6a3d', emissiveIntensity: .3 }));
    strip.position.copy(hs.position); strip.position.y += 3 * Math.cos(om); strip.position.x += -dir * -3 * Math.sin(om) * 0; strip.rotation.z = dir * om; probe.add(strip);
    const top = new THREE.Vector3(-dir * (um + (arrL / 2 + 2) * Math.cos(om)), hm + 12, 0);
    const curve = new THREE.CatmullRomCurve3([top, top.clone().add(new THREE.Vector3(-dir * 14, 10, 0)), top.clone().add(new THREE.Vector3(-dir * 40, 16, 6)), top.clone().add(new THREE.Vector3(-dir * 75, 10, 20))]);
    const cab = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 2.4, 12, false), new THREE.MeshStandardMaterial({ color: '#1c1f23', roughness: .6 })); cab.castShadow = true; probe.add(cab);
    // cota do index offset
    const idx = cfg.scan.index, xf = C.L.xf, zOff = wd.width / 2 + 7, lm = new THREE.LineBasicMaterial({ color: '#7ad3ff' });
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xf, .2, zOff), new THREE.Vector3(0, .2, zOff), new THREE.Vector3(xf, .2, zOff - 3), new THREE.Vector3(xf, .2, zOff + 3), new THREE.Vector3(0, .2, zOff - 3), new THREE.Vector3(0, .2, zOff + 3)]);
    follow.add(new THREE.LineSegments(lg, lm));
    const li = label('Index offset ' + PA.f1(idx) + ' mm', { size: 3.4, color: '#7ad3ff' }); li.position.set(xf / 2, 5, zOff + 2); follow.add(li);
  }

  function applyMode() {
    const x = mode === 'raiox';
    plates.forEach(p => { p.material = p.userData.weld ? (x ? mats.weldX : mats.weld) : (x ? mats.steelX : mats.steel); });
    [mats.steel, mats.weld].forEach(m => { m.clippingPlanes = x ? [] : [clip]; m.needsUpdate = true; });
    defG.children.forEach(o => { o.material.clippingPlanes = x ? [] : [clip]; o.material.needsUpdate = true; });
    if (cap) cap.visible = !x;
  }

  function update(C, st) {
    if (!C0) return;
    const T = C.T, len = C.len, zc = st.yp - len / 2, dir = C.L.dir, cfg = C.cfg, list = C.L.list;
    if (st.mode3d !== mode) { mode = st.mode3d; applyMode(); }
    if (lastZ === null) { const span = cfg.scan.index + cfg.wedge.len + T + 20; cam.position.set(-dir * span * 1.3, span * 1.25, zc + span * 2.3); ctl.target.set(-dir * cfg.scan.index * .75, -T * .3, zc); }
    else { const d = zc - lastZ; cam.position.z += d; ctl.target.z += d; }
    lastZ = zc; key.position.set(-160, 260, zc + 180); key.target.position.set(0, 0, zc);
    clip.constant = zc;
    probe.position.set(C.L.xf, 0, zc); probe.rotation.y = -cfg.scan.skew * DEG * dir;
    follow.position.set(0, 0, zc);
    if (cap) { cap.position.z = zc - .05; drawCap(C, st); }
    stat.children.forEach(o => { if (o.userData.ry != null) o.visible = mode === 'raiox' || o.userData.ry <= st.yp + .5; });
    Object.keys(defMeshes).forEach(id => defMeshes[id].forEach(m => { m.visible = !st.train && !m.userData.tip && (C.prims.find(p => p.def === id) ? true : false); }));
    defG.children.forEach(m => { if (m.geometry.type === 'CylinderGeometry' && m.material && false) m.visible = true; });
    // elementos ativos
    const L = list[st.law]; elems.forEach((m, k) => { const a = L && k >= L.k0 && k < L.k0 + L.n; m.material.color.set(a ? '#ff6a3d' : '#444b53'); m.material.emissive.set(a ? '#ff4a1d' : '#000000'); });
    // leque do feixe
    const pos = [], col = [], zz = zc + .15, cOr = new THREE.Color('#ff8a3d');
    const ptsOf = Lw => { const P = [[Lw.xc, Lw.zc, 0], [Lw.xe, 0, 0]]; let s = 0; for (let b = 1; b <= C.legs; b++) { const sb = Math.min(C.range, b * T / Lw.cth); P.push([Lw.xe + dir * sb * Lw.sth, PA.fold(sb * Lw.cth, T), sb]); if (sb >= C.range) break; } return P; };
    const inten = (Lw, s) => s <= 0 ? .35 : Math.min(1, .25 + .75 * (Lw.a / Lw.wa(s)) * Math.sqrt(Lw.b / Lw.we(s)) / 2.2);
    const stepL = Math.max(1, Math.floor(list.length / 40));
    for (let i = 0; i + stepL < list.length; i += stepL) {
      const A = ptsOf(list[i]), B = ptsOf(list[i + stepL]), n = Math.min(A.length, B.length);
      for (let j = 0; j < n - 1; j++) {
        const q = [A[j], A[j + 1], B[j + 1], B[j]], ci = q.map((p, t) => inten(t < 2 ? list[i] : list[i + stepL], p[2]) * (j === 0 ? .55 : 1) * .55);
        [[0, 1, 2], [0, 2, 3]].forEach(tr => tr.forEach(t => { pos.push(q[t][0], -q[t][1], zz); col.push(cOr.r * ci[t], cOr.g * ci[t], cOr.b * ci[t]); }));
      }
    }
    beam.geometry.dispose(); const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); beam.geometry = bg;
    if (ray) { scene.remove(ray); ray.geometry.dispose(); ray = null; }
    if (glLine) { scene.remove(glLine); glLine.geometry.dispose(); glLine = null; }
    if (L) {
      const P = ptsOf(L).map(p => new THREE.Vector3(p[0], -p[1], zc + .3));
      const path = new THREE.CurvePath(); for (let i = 0; i < P.length - 1; i++) path.add(new THREE.LineCurve3(P[i], P[i + 1]));
      ray = new THREE.Mesh(new THREE.TubeGeometry(path, 60, .32, 8, false), new THREE.MeshBasicMaterial({ color: '#ffe066', depthTest: false })); ray.renderOrder = 11; scene.add(ray);
      if (L.gl) { const s = Math.min(C.range, T / Math.cos(L.gl.th)); const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(L.xe, 0, zc + .3), new THREE.Vector3(L.xe + dir * s * Math.sin(L.gl.th), -s * Math.cos(L.gl.th), zc + .3)]);
        glLine = new THREE.Line(g, new THREE.LineDashedMaterial({ color: '#ff4fd8', dashSize: 2, gapSize: 1.5, depthTest: false })); glLine.computeLineDistances(); glLine.renderOrder = 11; scene.add(glLine); }
    }
    const pk = st.peak; dot.visible = !!(pk && pk.ok); if (dot.visible) dot.position.set(pk.x, -pk.depth, zc + .4);
  }

  function drawCap(C, st) {
    const I = capInfo, g = capCtx, w = g.canvas.width, h = g.canvas.height;
    g.clearRect(0, 0, w, h); g.drawImage(capBase, 0, 0);
    if (!st.train) {
      const X = x => (x + I.W0) * I.k, Z = z => (z - I.zt) * I.k, cols = {}; C.cfg.defects.forEach(d => cols[d.id] = PA.DEF_TYPES[d.type].cor);
      C.prims.forEach(P => { if (P.def === 'geo' || P.tip || P.hidden) return; if (st.yp < P.y1 || st.yp > P.y2) return;
        g.fillStyle = g.strokeStyle = '#0b0b0b';
        if (P.kind === 'pt') { g.beginPath(); g.arc(X(P.x), Z(P.z), Math.max(2.5, P.r * I.k), 0, 7); g.fill(); g.strokeStyle = cols[P.def]; g.lineWidth = 3; g.stroke(); }
        else { g.lineWidth = Math.max(3, .35 * I.k); g.beginPath(); g.moveTo(X(P.x1), Z(P.z1)); g.lineTo(X(P.x2), Z(P.z2)); g.stroke(); g.strokeStyle = cols[P.def]; g.lineWidth = Math.max(1.5, .15 * I.k); g.stroke(); } });
    }
    cap.material.map.needsUpdate = true;
  }

  const ro = new ResizeObserver(() => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; ren.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); });
  ro.observe(host);
  let live = true;
  const loop = () => { if (!live) return; ctl.update(); ren.render(scene, cam); requestAnimationFrame(loop); };
  loop();
  return { setup, update, resetCam: () => { lastZ = null; }, renderer: ren };
};
})();
