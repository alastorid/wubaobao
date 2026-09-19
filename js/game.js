// wubaobao · 字球取名池
// 玩法（邏輯簡單，看一眼就懂，連嬰兒亂摸都能玩）：
//   1. 摸一下 / 滑一下，字球會滾動並選中，能量澆進頂上的「取名能量瓶」。
//   2. 摸到球、或滑動掃過球，就把那個好字「收集」到中間的名字行。
//   3. 能量滿了，球池綻放彩紙，生出一組「吳 ＋ 一字或兩字」的名字，
//      名字的五行會標出來；父母若設了「喜用神」，系統會優先補那個五行。
//   4. 取下一個名字，就自動記進底下的「名字簿」（存於本機）。
// 任何輸入都算數：嬰兒亂敲、亂滑，能量照樣累積，一定會取名。
import * as THREE from './three.module.js';
import { SoundGarden } from './audio.js';
const sound = new SoundGarden();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─────────────── 基本設定 ─────────────── */
const WU = '吳';
const ENERGY_MAX = 100;
const TAP_ENERGY = 10;        // 每一下
const SWIPE_ENERGY = 0.18;    // 每移動 1px


const CAT_LABEL = { xiangxing: '象形', xingsheng: '形聲', huiyi: '會意', zhishi: '指事', jingfang: '經方' };

// 每個字 → 附加資訊的對照（六書類別／來源）
const CHAR_META = new Map();
for (const [cat, arr] of Object.entries(POOL)) {
  if (cat === 'all' || !Array.isArray(arr)) continue;
  for (const e of arr) CHAR_META.set(e.c, { ...e, cat: e.cat || cat, catLabel: CAT_LABEL[e.cat || cat] || cat });
}

/* ─────────────── DOM ─────────────── */
const stage = document.getElementById('stage');
const energyFill = document.getElementById('energyFill');
const energyLabel = document.getElementById('energyLabel');
const slot1 = document.getElementById('slot1');
const slot2 = document.getElementById('slot2');
const revealEl = document.getElementById('reveal');
const revealName = document.getElementById('revealName');
const revealTag = document.getElementById('revealTag');
const revealMeaning = document.getElementById('revealMeaning');
const bookToggle = document.getElementById('bookToggle');
const bookCount = document.getElementById('bookCount');
const bookEl = document.getElementById('book');
const wxbar = document.getElementById('wxbar');

/* ─────────────── 渲染器 / 場景 / 相機 ─────────────── */
const renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) <= 1, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
camera.position.set(0, 0, 40);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 2.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(5, 9, 7);
scene.add(dirLight);
scene.add(new THREE.PointLight(0xd5eee2, .5, 30).translateZ(6));

/* ─────────────── 工具：文字貼圖 ─────────────── */
const charTexCache = new Map();
function charTexture(ch, color = '#7a2448') {
  if (charTexCache.has(ch)) return charTexCache.get(ch);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.font = '600 85px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(ch, 64, 70);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  charTexCache.set(ch, tex);
  return tex;
}

/* ─────────────── 粒子系統（點擊／滑動／取名迸發） ─────────────── */
const MAX_PARTICLES = 700;
const P = {
  active: 0,
  pos: new Float32Array(MAX_PARTICLES * 3),
  vel: new Float32Array(MAX_PARTICLES * 3),
  col: new Float32Array(MAX_PARTICLES * 3),
  life: new Float32Array(MAX_PARTICLES),
  maxLife: new Float32Array(MAX_PARTICLES),
  grav: new Float32Array(MAX_PARTICLES),
  geo: null, mesh: null
};

function initParticles() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(cv);
  P.geo = new THREE.BufferGeometry();
  P.geo.setAttribute('position', new THREE.BufferAttribute(P.pos, 3));
  P.geo.setAttribute('color', new THREE.BufferAttribute(P.col, 3));
  P.geo.setDrawRange(0, 0);
  const mat = new THREE.PointsMaterial({
    size: 0.23, map, vertexColors: true, transparent: true,
    opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  });
  P.mesh = new THREE.Points(P.geo, mat);
  P.mesh.frustumCulled = false;
  scene.add(P.mesh);
}

function spawnBurst(pos, count, colorHex, speed = 4, gravity = -3) {
  if (P.active + count > MAX_PARTICLES) count = MAX_PARTICLES - P.active;
  const c = new THREE.Color(colorHex);
  for (let i = 0; i < count; i++) {
    const idx = P.active + i;
    P.pos[idx * 3] = pos.x; P.pos[idx * 3 + 1] = pos.y; P.pos[idx * 3 + 2] = pos.z;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI - Math.PI / 2;
    const s = (0.3 + Math.random() * 0.7) * speed;
    P.vel[idx * 3] = Math.cos(th) * Math.cos(ph) * s;
    P.vel[idx * 3 + 1] = Math.sin(ph) * s * 0.9;
    P.vel[idx * 3 + 2] = Math.sin(th) * Math.cos(ph) * s * 0.5;
    const cc = c.clone().multiplyScalar(0.7 + Math.random() * 0.6);
    P.col[idx * 3] = cc.r; P.col[idx * 3 + 1] = cc.g; P.col[idx * 3 + 2] = cc.b;
    P.maxLife[idx] = P.life[idx] = 0.5 + Math.random() * 0.9;
    P.grav[idx] = gravity;
  }
  P.active += count;
  P.geo.setDrawRange(0, P.active);
}

function updateParticles(dt) {
  for (let i = 0; i < P.active;) {
    P.life[i] -= dt;
    if (P.life[i] <= 0) {           // 移除：與最後一個交換
      const last = P.active - 1;
      for (let k = 0; k < 3; k++) {
        P.pos[i * 3 + k] = P.pos[last * 3 + k];
        P.vel[i * 3 + k] = P.vel[last * 3 + k];
        P.col[i * 3 + k] = P.col[last * 3 + k];
      }
      P.life[i] = P.life[last]; P.maxLife[i] = P.maxLife[last]; P.grav[i] = P.grav[last];
      P.active--; continue;
    }
    P.vel[i * 3 + 1] += P.grav[i] * dt;
    P.pos[i * 3] += P.vel[i * 3] * dt;
    P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt;
    P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
    i++;
  }
  P.geo.setDrawRange(0, P.active);
  P.geo.attributes.position.needsUpdate = true;
  P.geo.attributes.color.needsUpdate = true;
}

/* ─────────────── 字球池：正交俯視，不傾斜、不拉伸 ─────────────── */
const PASTELS = [0x8cc9c2, 0xf2afa0, 0xa8c7df, 0xc7badc, 0xe9c8a2, 0xb8ce9c, 0xf0c3ce];
const MAX_BALLS = 210;
const balls = [];
const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
// 球體與陰影批次繪製，iPad 不必逐球增加材質與繪製成本。
const ballMesh = new THREE.InstancedMesh(sphereGeo, new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 95, specular: 0xeeeecc }), MAX_BALLS);
ballMesh.frustumCulled = false;
scene.add(ballMesh);
const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
const shadowContext = shadowCanvas.getContext('2d');
const shadowGradient = shadowContext.createRadialGradient(32, 32, 4, 32, 32, 32);
shadowGradient.addColorStop(0, '#254b4a55'); shadowGradient.addColorStop(1, '#254b4a00');
shadowContext.fillStyle = shadowGradient; shadowContext.fillRect(0, 0, 64, 64);
const shadowMap = new THREE.CanvasTexture(shadowCanvas);
const shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false }), MAX_BALLS);
shadows.frustumCulled = false; scene.add(shadows);
const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1, .045, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffe8a0 }), MAX_BALLS);
rings.frustumCulled = false; scene.add(rings);
const transform = new THREE.Object3D();
let pitWidth = 1, pitHeight = 1;
let goldChoice = null;
const goldHint = document.getElementById('goldHint');
const GOLD_BONUS = 25;

/* ─────────────── 隱形循環氣流 ─────────────── */
// 爆光與衝擊圈共用固定資源，反覆摸也不建立無限物件。
const shockwaves = [];
const waveGeometry = new THREE.RingGeometry(.93, 1, 48);
for (let i = 0; i < 6; i++) {
  const mesh = new THREE.Mesh(waveGeometry, new THREE.MeshBasicMaterial({ color: 0xffdb77, transparent: true, depthWrite: false }));
  mesh.visible = false; scene.add(mesh); shockwaves.push({ mesh, life: 0, gold: false });
}
let waveIndex = 0;
function explodeAt(x, y, gold) {
  const pos = new THREE.Vector3(x, y, 4);
  spawnBurst(pos, gold ? 90 : 16, gold ? 0xffca49 : 0xffffff, gold ? 5 : 1.8, -1.2);
  const wave = shockwaves[waveIndex++ % shockwaves.length];
  wave.life = 1; wave.gold = gold; wave.mesh.position.copy(pos); wave.mesh.visible = !reducedMotion;
  if (reducedMotion) return;
  for (const b of balls) {
    const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy);
    const reach = gold ? 3.5 : 1.2;
    if (d > .01 && d < reach) {
      const force = (gold ? 4.5 : 1.2) * (1 - d / reach);
      b.vx += dx / d * force; b.vy += dy / d * force;
    }
  }
}
function updateWaves(dt) {
  for (const wave of shockwaves) {
    wave.life = Math.max(0, wave.life - dt * 2);
    wave.mesh.visible = wave.life > 0 && !reducedMotion;
    wave.mesh.material.opacity = wave.life * .75;
    wave.mesh.scale.setScalar(.2 + (1 - wave.life) * (wave.gold ? 3.2 : 1));
  }
}

function nextEntry(gold) {
  const want = gold && target !== 'auto' ? target : null;
  return pickChar({ beautyOnly: true, maxStrokes: gold ? 8 : (Math.random() < .45 ? 8 : 99), want }) || pickChar({ want });
}
function refreshBall(b) {
  b.entry = nextEntry(b.gold);
  b.label.material.map = charTexture(b.entry.c, '#284e50');
  b.label.material.needsUpdate = true;
  b.refreshAt = 0;
}
function layoutPool() {
  const width = stage.clientWidth, height = stage.clientHeight;
  renderer.setSize(width, height);
  pitWidth = width / 100; pitHeight = height / 100;
  camera.left = -pitWidth / 2; camera.right = pitWidth / 2;
  camera.top = pitHeight / 2; camera.bottom = -pitHeight / 2;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  // 按可用空間鋪滿，保留圓形球與足夠手指點選面積。
  const cell = Math.max(48, Math.sqrt(width * height / 105));
  const columns = Math.max(3, Math.floor((width - 12) / cell));
  const rows = Math.max(2, Math.floor((height - 12) / (cell * .9)));
  const baseCount = Math.min(100, columns * rows);
  const middleCount = Math.floor(baseCount * .72);
  const topCount = Math.floor(baseCount * .42);
  const count = Math.min(MAX_BALLS, baseCount + middleCount + topCount);
  const spacingX = (pitWidth - .16) / columns;
  const spacingY = (pitHeight - .16) / rows;
  const radius = Math.min(spacingX * .47, spacingY * .52, .65);
  while (balls.length > count) { const b = balls.pop(); scene.remove(b.label); b.label.material.dispose(); }
  while (balls.length < count) {
    const i = balls.length;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    scene.add(label);
    const b = { id: i, label, layer: 0, depth: 0, gold: i % 17 === 7, x: 0, y: 0, vx: 0, vy: 0, radius, selected: 0, cooldown: 0, refreshAt: 0 };
    balls.push(b); refreshBall(b);
  }
  balls.forEach((b, i) => {
    b.layer = i < baseCount ? 0 : i < baseCount + middleCount ? 1 : 2;
    b.depth = b.layer * radius * 1.55;
    const local = i < baseCount ? i : i < baseCount + middleCount ? i - baseCount : i - baseCount - middleCount;
    const row = Math.floor(local / columns), column = local % columns;
    b.radius = radius * (.88 + (i % 6) * .035);
    if (b.layer === 0) {
      b.x = -pitWidth / 2 + .08 + spacingX * (column + .5 + (Math.random() - .5) * .28);
      b.y = pitHeight / 2 - .08 - spacingY * (row + .5 + (Math.random() - .5) * .2);
    } else {
      // 上層錯開鋪在下層之上，畫面保留遮擋與真實 Z 深度。
      b.x = -pitWidth / 2 + spacingX * (column + .85);
      b.y = -pitHeight / 2 + spacingY * (row + .95 + b.layer * .35);
    }
    b.vx = (Math.random() - .5) * .12; b.vy = 0;
    ballMesh.setColorAt(i, new THREE.Color(b.gold ? 0xeebd49 : PASTELS[i % PASTELS.length]).multiplyScalar(.82 + b.layer * .09));
  });
  ballMesh.count = shadows.count = rings.count = count;
  ballMesh.instanceColor.needsUpdate = true;
  updatePool(0);
}
function selectBall(b) {
  if (b.cooldown > 0) return;
  b.cooldown = .8; b.selected = 1; b.refreshAt = 1.1;
  stats.selections++;
  explodeAt(b.x, b.y, b.gold);
  sound.play(b.gold ? 'celebrate' : 'pop');
  if (b.gold) {
    goldChoice = b.entry;
    stats.goldSelections++;
    const other = caught.find(e => e.c !== b.entry.c);
    caught.splice(0, caught.length, b.entry, ...(other ? [other] : []));
    goldHint.textContent = `✦ 已鎖定「${b.entry.c}」 · 能量 +${GOLD_BONUS}`;
  } else if (!caught.some(e => e.c === b.entry.c)) {
    if (caught.length < 2) caught.push(b.entry);
    else if (goldChoice) caught[1] = b.entry;
    else { caught.shift(); caught.push(b.entry); }
  }
  renderSlots();
  // 先收字再灌能量，剛好滿格的這一摸也會參與取名。
  if (b.gold) addEnergy(GOLD_BONUS);
  b.vy += reducedMotion ? 0 : .8;
}
function updatePool(dt) {
  const liftOriginY = -pitHeight / 2 + .73;
  for (const b of balls) {
    b.cooldown = Math.max(0, b.cooldown - dt); b.selected = Math.max(0, b.selected - dt * 1.8);
    if (b.refreshAt > 0) { b.refreshAt -= dt; if (b.refreshAt <= 0) refreshBall(b); }
    b.vy -= dt * .75;
    const damping = Math.exp(-dt * 2.2); b.vx *= damping; b.vy *= damping;
    // 中央上升、兩側回落，形成樂透機式循環氣流。
    const aboveLift = b.y - liftOriginY;
    const cone = .7 + Math.max(0, aboveLift) * .24;
    if (!reducedMotion && aboveLift > 0 && aboveLift < pitHeight * .88 && Math.abs(b.x) < cone) {
      const focus = 1 - Math.abs(b.x) / cone;
      b.vy += dt * (6.2 + 5.8 * focus);
      b.vx += dt * (Math.sin(b.y * 2.3 + b.id) * .8 + Math.sign(b.x || 1) * .35);
    }
    b.vx = Math.max(-5, Math.min(5, b.vx)); b.vy = Math.max(-5, Math.min(5, b.vy));
    b.x += b.vx * dt; b.y += b.vy * dt;
  }
  // 同層球碰撞，多層球在不同 Z 高度遮疊；爆開可露出下面的球。
  for (let pass = 0; pass < 5; pass++) {
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      if (a.layer !== b.layer) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const min = a.radius + b.radius + .035, d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || .001, nx = d2 ? dx / d : 1, ny = d2 ? dy / d : 0;
      const overlap = (min - d) * .5;
      a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
      const speed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (speed < 0) { const impulse = -speed * .6; a.vx -= nx * impulse; a.vy -= ny * impulse; b.vx += nx * impulse; b.vy += ny * impulse; }
    }
    for (const b of balls) {
      const maxX = pitWidth / 2 - b.radius - .04, maxY = pitHeight / 2 - b.radius - .04;
      if (Math.abs(b.x) > maxX) { b.x = Math.sign(b.x) * maxX; b.vx *= -.4; }
      if (Math.abs(b.y) > maxY) { b.y = Math.sign(b.y) * maxY; b.vy *= -.3; }
    }
  }
  balls.forEach((b, i) => {
    const r = b.radius;
    transform.position.set(b.x, b.y, b.depth); transform.rotation.set(0, 0, 0); transform.scale.setScalar(r); transform.updateMatrix(); ballMesh.setMatrixAt(i, transform.matrix);
    transform.position.set(b.x + .07, b.y - .10, b.depth - .03); transform.scale.set(r * 2.7, r * 2.7, 1); transform.updateMatrix(); shadows.setMatrixAt(i, transform.matrix);
    b.label.position.set(b.x, b.y, b.depth + r + .02); b.label.scale.setScalar(r * 1.08);
    transform.position.set(b.x, b.y, b.depth + r + .01); transform.scale.setScalar(b.gold || b.selected > 0 ? r * 1.04 : 0); transform.updateMatrix(); rings.setMatrixAt(i, transform.matrix);
  });
  ballMesh.instanceMatrix.needsUpdate = shadows.instanceMatrix.needsUpdate = rings.instanceMatrix.needsUpdate = true;
}

/* ─────────────── 遊戲狀態 ─────────────── */
let energy = 0;
let target = 'auto';          // 喜用神：auto / 金木水火土
const stats = { selections: 0, goldSelections: 0, reveals: 0 };
const caught = [];            // 本輪收集的字
let names = [];               // 名字簿（新→舊）
let hideTimer = null;

function addEnergy(v) {
  // 揭曉期間仍累積能量；滿格立即開下一輪，不吞掉小手的輸入。
  const before = Math.floor(energy / 20);
  energy += v;
  if (Math.floor(energy / 20) > before) sound.play('rise', Math.min(energy / ENERGY_MAX, 1));
  updateEnergyUI();
  while (energy >= ENERGY_MAX) generateName();
}

function updateEnergyUI() {
  const pct = Math.min(100, Math.round((energy / ENERGY_MAX) * 100));
  energyFill.style.width = pct + '%';
  energyLabel.textContent = pct + '%';
  document.getElementById('energy').setAttribute('aria-valuenow', pct);
}

/* ─────────────── 取名 ─────────────── */
function generateName() {
  stats.reveals++;
  sound.play('reveal');
  if (target !== 'auto') sound.play('celebrate');
  const want = target === 'auto' ? null : target;
  const preferred = goldChoice ? [goldChoice, ...caught.filter(e => e.c !== goldChoice.c)] : caught;
  const given = pickGivenName({ want, count: null, preferred });

  // 組名：吳 ＋ 1~2 字
  const chars = given.chars.map(e => e.c);
  const full = WU + chars.join('');
  const metas = given.chars.map(e => CHAR_META.get(e.c));

  // 五行 & 六書 標籤
  const wxIcons = metas.map(m => (WU_XING[m.w] ? WU_XING[m.w].icon : '')).join('');
  const wxLabels = metas.map(m => (WU_XING[m.w] ? WU_XING[m.w].label : '')).join(' ');
  const typeTags = metas.map(m => m.catLabel).join('·');
  const sources = [...new Set(metas.map(m => m.src).filter(Boolean))];
  const srcTag = sources.length ? ' · ' + sources.join('、') : '';
  const pinyin = metas.map(m => m.p).join(' ');

  // 揭曉
  revealName.textContent = full;
  revealTag.innerHTML = `五行 ${wxIcons} ${wxLabels} &nbsp;·&nbsp; ${typeTags}${srcTag}<br><span style="font-size:13px;color:#839578">${pinyin}</span>`;
  revealMeaning.textContent = metas.map(m => `${m.c} · ${m.s}畫${m.meaning ? ' · ' + m.meaning : ''}`).join('\n');
  revealEl.classList.remove('hidden');
  // 球池中央綻放繽紛彩紙
  const cpos = new THREE.Vector3(0, 0, 2);
  const confetti = [0xff5c8d, 0xffd23f, 0x3ac7ff, 0x7ed957, 0xb25cff, 0xff9ac2];
  for (let i = 0; i < 6; i++) spawnBurst(cpos, 65, confetti[(Math.random() * confetti.length) | 0], 6, -2.5);

  celebration = 1;
  explodeAt(0, 0, true);
  launchConfetti();

  // 記錄
  names.unshift({ name: full, chars, pinyin, wx: given.elements, tags: typeTags, srcTag, ts: Date.now() });
  if (names.length > 200) names.pop();
  try { localStorage.setItem('wubaobao-names', JSON.stringify(names)); } catch (e) {}
  renderBook();

  // 收尾：重置能量與收集行
  energy = Math.max(0, energy - ENERGY_MAX);
  updateEnergyUI();
  caught.length = 0;
  goldChoice = null;
  goldHint.textContent = '✦ 金球祝福：多 25 能量，這個字必入名';
  renderSlots();

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    revealEl.classList.add('hidden');
  }, 4600);
}

function renderSlots() {
  slot1.classList.toggle('gold-slot', !!goldChoice);
  slot1.textContent = caught[0] ? caught[0].c : '?';
  slot2.textContent = caught[1] ? caught[1].c : '?';
  slot1.classList.toggle('filled', !!caught[0]);
  slot1.classList.toggle('empty', !caught[0]);
  slot2.classList.toggle('filled', !!caught[1]);
  slot2.classList.toggle('empty', !caught[1]);
}

/* ─────────────── 名字簿 ─────────────── */
function loadNames() {
  try {
    const raw = localStorage.getItem('wubaobao-names');
    const parsed = raw ? JSON.parse(raw) : [];
    names = Array.isArray(parsed) ? parsed.filter(n => n && typeof n.name === 'string' && Array.isArray(n.chars)).slice(0, 200).map(n => ({ ...n, wx: Array.isArray(n.wx) ? n.wx : [] })) : [];
  } catch (e) { names = []; }
}
function renderBook() {
  bookCount.textContent = names.length;
  bookEl.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = '名字簿 · ' + names.length + ' 個';
  bookEl.append(heading);
  if (!names.length) {
    const empty = document.createElement('p'); empty.className = 'book-empty';
    empty.textContent = '還沒有名字，快來摸一摸！'; bookEl.append(empty);
  }
  names.forEach((n, i) => {
    const row = document.createElement('div'); row.className = 'book-item';
    for (const [cls, value] of [['nm', n.name], ['tg', (n.wx || []).join(' ') + ' · ' + (n.tags || '')], ['py', n.pinyin || n.chars.join(' ')]]) {
      const span = document.createElement('span'); span.className = cls; span.textContent = value; row.append(span);
    }
    const remove = document.createElement('button'); remove.className = 'book-delete';
    remove.textContent = '×'; remove.ariaLabel = '刪除' + n.name;
    remove.onclick = () => { names.splice(i, 1); saveNames(); renderBook(); };
    row.append(remove); bookEl.append(row);
  });
  if (names.length) {
    const clear = document.createElement('button'); clear.id = 'bookClear'; clear.textContent = '清空名字簿';
    clear.onclick = () => { names = []; saveNames(); renderBook(); }; bookEl.append(clear);
  }
}
function saveNames() {
  try { localStorage.setItem('wubaobao-names', JSON.stringify(names)); } catch (e) {}
}

/* ─────────────── 輸入：觸控／滑鼠（手指、滑鼠、iPad 全支援） ─────────────── */
const raycaster = new THREE.Raycaster();
let activePointer = null;
let startPt = null, prevPt = null;

function toNDC(e) {
  const r = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    -((e.clientY - r.top) / r.height) * 2 + 1
  );
}
function screenBurst(e, count, color) {
  const ndc = toNDC(e);
  raycaster.setFromCamera(ndc, camera);
  const pos = new THREE.Vector3();
  raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), pos);
  pos.z = 4;
  spawnBurst(pos, count, color, 2.6);
}
function pointerWorld(e) {
  const r = renderer.domElement.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width - .5) * pitWidth, y: (.5 - (e.clientY - r.top) / r.height) * pitHeight };
}
function visibleBallAt(p) {
  // 找實際最靠近鏡頭的球面，而非先找到的底層圓形。
  let front = null, frontZ = -Infinity;
  for (const b of balls) {
    const d2 = (b.x - p.x) ** 2 + (b.y - p.y) ** 2;
    if (d2 > b.radius ** 2) continue;
    const z = b.depth + Math.sqrt(b.radius ** 2 - d2);
    if (z > frontZ) { front = b; frontZ = z; }
  }
  return front;
}
function hitBallAt(e) {
  const b = visibleBallAt(pointerWorld(e));
  if (b) selectBall(b);
}
function swipeSelect(e, previous) {
  const p = pointerWorld(e), a = pointerWorld({ clientX: previous.x, clientY: previous.y });
  const dx = p.x - a.x, dy = p.y - a.y;
  const steps = Math.min(80, Math.max(1, Math.ceil(Math.hypot(dx, dy) / .15)));
  const selected = new Set();
  for (let i = 0; i <= steps; i++) {
    const b = visibleBallAt({ x: a.x + dx * i / steps, y: a.y + dy * i / steps });
    if (!b || selected.has(b.id)) continue;
    selected.add(b.id); selectBall(b);
    if (!reducedMotion) { b.vx += Math.max(-1.5, Math.min(1.5, dx * 3)); b.vy += Math.max(-1.5, Math.min(1.5, dy * 3)); }
  }
}

renderer.domElement.style.touchAction = 'none';
document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, #book')) return;
  sound.play('tap');
  if (activePointer !== null) { hitBallAt(e); addEnergy(TAP_ENERGY); return; }
  renderer.domElement.setPointerCapture(e.pointerId);
  activePointer = e.pointerId;
  startPt = { x: e.clientX, y: e.clientY };
  prevPt = startPt;

  screenBurst(e, 12, 0xa5d5c4);
  hitBallAt(e);
  addEnergy(TAP_ENERGY);
});
document.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointer) return;
  const dx = e.clientX - startPt.x, dy = e.clientY - startPt.y;
  const seg = Math.hypot(e.clientX - prevPt.x, e.clientY - prevPt.y);

  const previous = prevPt;
  prevPt = { x: e.clientX, y: e.clientY };
  if (Math.hypot(dx, dy) > 14) {       // 滑動開始
    swipeSelect(e, previous);
    addEnergy(seg * SWIPE_ENERGY);
  }
});
function endPointer(e) {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  startPt = prevPt = null;
}
document.addEventListener('pointerup', endPointer);
document.addEventListener('pointercancel', endPointer);
renderer.domElement.addEventListener('lostpointercapture', endPointer);

// 避免 iOS 捲動／縮放
document.addEventListener('touchmove', (e) => { if (!e.target.closest('#book')) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

/* ─────────────── 五行選擇 ─────────────── */
wxbar.addEventListener('click', (e) => {
  const chip = e.target.closest('.wx-chip');
  if (!chip) return;
  target = chip.dataset.w;
  goldChoice = null; caught.length = 0; renderSlots();
  goldHint.textContent = '✦ 金球祝福：多 25 能量，這個字必入名';
  for (const b of balls) if (b.gold) refreshBall(b);
  wxbar.querySelectorAll('.wx-chip').forEach(c => { c.classList.toggle('active', c === chip); c.setAttribute('aria-pressed', String(c === chip)); });
  sound.play('rise', .5);
});

/* ─────────────── 名字簿開關 ─────────────── */
bookToggle.addEventListener('click', () => bookEl.classList.toggle('hidden'));


/* ─────────────── 視窗尺寸 ─────────────── */
function onResize() { layoutPool(); }
window.addEventListener('resize', onResize);
// 以球池元素的實際尺寸為準，涵蓋 iPad 工具列、安全區與橫直轉向。
new ResizeObserver(onResize).observe(stage);

/* ─────────────── 有上限的星塵與彩紙（共三次繪製） ─────────────── */
let celebration = 0;
const dustGeo = new THREE.BufferGeometry();
const dustPositions = new Float32Array(90 * 3);
for (let i = 0; i < dustPositions.length; i++) dustPositions[i] = (Math.random() - .5) * 22;
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xc4a570, size: .035, transparent: true, opacity: .5, depthWrite: false }));
scene.add(dust);
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: shadowMap, color: 0xffdd8a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
halo.position.set(0, 0, 1); scene.add(halo);
const CONFETTI_COUNT = 100;
const confettiMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(.10, .19), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false }), CONFETTI_COUNT);
confettiMesh.frustumCulled = false;
confettiMesh.visible = false;
scene.add(confettiMesh);
const confettiState = Array.from({ length: CONFETTI_COUNT }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), spin: 0 }));
const dummy = new THREE.Object3D();
let confettiTime = 0;
function launchConfetti() {
  confettiTime = reducedMotion ? 0 : 3.6;
  confettiState.forEach((c, i) => {
    c.p.set(0, 0, 2);
    const angle = Math.random() * Math.PI * 2;
    c.v.set(Math.cos(angle) * (2 + Math.random() * 4), 3 + Math.random() * 5, 2 + Math.random() * 3);
    c.spin = Math.random() * 6;
    confettiMesh.setColorAt(i, new THREE.Color(PASTELS[i % PASTELS.length]));
  });
  confettiMesh.instanceColor.needsUpdate = true;
}
function updateCelebration(dt, t) {
  celebration = Math.max(0, celebration - dt * 1.15);
  halo.material.opacity = celebration * .65 + energy / ENERGY_MAX * .12;
  halo.scale.setScalar(4 + (1 - celebration) * 10);
  confettiTime = Math.max(0, confettiTime - dt);
  confettiMesh.visible = confettiTime > 0;
  if (confettiTime > 0) {
    confettiMesh.material.opacity = Math.min(1, confettiTime);
    confettiState.forEach((c, i) => {
      c.v.y -= dt * 3.5; c.p.addScaledVector(c.v, dt);
      dummy.position.copy(c.p); dummy.rotation.set(t * c.spin, t * 2, t * c.spin * .5);
      dummy.updateMatrix(); confettiMesh.setMatrixAt(i, dummy.matrix);
    });
    confettiMesh.instanceMatrix.needsUpdate = true;
  }
}

/* ─────────────── 全螢幕：不支援時顯示 Safari 操作提示 ─────────────── */
const fullscreenButton = document.getElementById('fullscreenToggle');
let toastTimer;
function fullscreenHint() {
  const toast = document.getElementById('toast');
  toast.textContent = '此瀏覽器暫不支援全螢幕。iPad 可在 Safari 點「分享」→「加入主畫面」，從主畫面開啟。';
  toast.classList.remove('hidden'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 7000);
}
fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else fullscreenHint();
  } catch { fullscreenHint(); }
});
document.addEventListener('fullscreenchange', () => {
  const active = !!document.fullscreenElement;
  fullscreenButton.ariaLabel = active ? '退出全螢幕' : '進入全螢幕';
  fullscreenButton.querySelector('b').textContent = active ? '⊡' : '⛶';
  fullscreenButton.querySelector('span').textContent = active ? '退出' : '全螢幕';
  onResize();
});
// 鍵盤亂敲也累積；有焦點的按鈕仍保留原生鍵盤操作。
document.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key === 'Tab' || e.key === 'Escape' || e.target.closest('button')) return;
  sound.unlock(); sound.play('tap'); addEnergy(TAP_ENERGY);
});
// 只在測試網址提供唯讀快照，測試仍須走真實輸入事件。
if (new URLSearchParams(location.search).has('qa')) {
  window.wubaobaoQA = () => ({ energy, names: names.length, selections: stats.selections, goldSelections: stats.goldSelections, goldChoice: goldChoice?.c, reveals: stats.reveals,
    caught: caught.map(e => e.c), audio: sound.ctx?.state, sound: { ...sound.settings },
    gains: sound.ctx ? [sound.effects.gain.value, sound.music.gain.value] : [],
    voices: sound.voices, particles: P.active, drawCalls: renderer.info.render.calls,
    textures: renderer.info.memory.textures, pixelRatio: renderer.getPixelRatio(),
    maxOverlap: (() => { let overlap = 0; for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) { const a = balls[i], b = balls[j]; if (a.layer !== b.layer) continue; overlap = Math.max(overlap, a.radius + b.radius - Math.hypot(a.x - b.x, a.y - b.y)); } return overlap * 100; })(),
    waves: shockwaves.filter(w => w.life > 0).length,
    balls: balls.map(b => { const r = renderer.domElement.getBoundingClientRect(); return { id: b.id, x: r.left + (b.x / pitWidth + .5) * r.width, y: r.top + (.5 - b.y / pitHeight) * r.height, radius: b.radius * r.width / pitWidth, c: b.entry.c, gold: b.gold, w: b.entry.w, layer: b.layer, visible: visibleBallAt({ x: b.x, y: b.y }) === b }; }) });
}

/* ─────────────── 主迴圈 ─────────────── */
const clock = new THREE.Clock();
initParticles(); loadNames(); renderBook(); renderSlots(); layoutPool();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  updatePool(dt);
  updateWaves(dt);
  updateCelebration(dt, t);
  updateParticles(dt);

  renderer.render(scene, camera);
}
animate();
