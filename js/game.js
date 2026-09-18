// wubaobao · 泡泡取名機
// 玩法（邏輯簡單，看一眼就懂，連嬰兒亂摸都能玩）：
//   1. 摸一下 / 滑一下，畫面就會冒出一團氣泡，能量澆進頂上的「取名能量瓶」。
//   2. 點中泡泡、或滑動掃過泡泡，就把那個好字「收集」到中間的名字行。
//   3. 能量滿了，中央水晶迸發，生出一組「吳 ＋ 一字或兩字」的名字，
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
const POP_ENERGY = 4;         // 收集一個字額外 +4
const BUBBLE_COUNT = innerWidth < 600 ? 28 : 36;

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
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.4, 16);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.95));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(5, 9, 7);
scene.add(dirLight);
scene.add(new THREE.PointLight(0xff9ac2, 1.2, 30).translateZ(6));

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

/* ─────────────── 泡泡 ─────────────── */
const PASTELS = [0xffb3c9, 0xffd1b8, 0xbfe3ff, 0xc9f2d6, 0xffe08a, 0xe6ccff, 0xffc3d8, 0xb8f0e8];
const bubbles = [];
// 共用高光貼圖與金邊；避免昂貴的環境反射／後製。
const sheenCanvas = document.createElement('canvas');
sheenCanvas.width = sheenCanvas.height = 128;
const sg = sheenCanvas.getContext('2d');
const gradient = sg.createRadialGradient(64, 64, 40, 64, 64, 63);
gradient.addColorStop(0, '#ffffff00'); gradient.addColorStop(.8, '#ffffff16'); gradient.addColorStop(1, '#ffffffc0');
sg.fillStyle = gradient; sg.beginPath(); sg.arc(64, 64, 63, 0, Math.PI * 2); sg.fill();
sg.strokeStyle = '#ffffffdd'; sg.lineWidth = 5; sg.lineCap = 'round';
sg.beginPath(); sg.arc(64, 64, 50, 3.7, 4.6); sg.stroke();
sg.fillStyle = '#fff9'; sg.beginPath(); sg.ellipse(86, 93, 10, 4, -.5, 0, Math.PI * 2); sg.fill();
const bubbleSheen = new THREE.CanvasTexture(sheenCanvas);
const rimGeo = new THREE.TorusGeometry(1.025, .015, 4, 36);
const sphereGeo = new THREE.SphereGeometry(1, 20, 14);

function makeBubble(pos, radius) {
  const entry = pickChar({ beautyOnly: Math.random() < .65 });
  const mat = new THREE.MeshPhongMaterial({
    color: PASTELS[(Math.random() * PASTELS.length) | 0],
    shininess: 150, specular: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false
  });
  const mesh = new THREE.Mesh(sphereGeo, mat);
  mesh.scale.setScalar(radius);
  const elColor = (WU_XING[entry.w] || {}).color || '#7a2448';
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: charTexture(entry.c, elColor), transparent: true, depthWrite: false
  }));
  sprite.scale.setScalar(1.12);
  sprite.position.z = .9;
  mesh.add(sprite);
  const sheen = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleSheen, transparent: true, depthWrite: false, opacity: .8 }));
  sheen.scale.setScalar(2.13);
  sheen.position.z = .12;
  mesh.add(sheen);
  const rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({ color: 0xd7b56b, transparent: true, opacity: .55, depthWrite: false }));
  rim.visible = !!entry.b;
  mesh.add(rim);
  mesh.position.copy(pos);
  scene.add(mesh);
  const b = {
    mesh, radius, vy: 0.35 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.3,
    phase: Math.random() * Math.PI * 2, sway: 0.4 + Math.random() * 0.8,
    entry, alive: true
  };
  mesh.userData = b;
  bubbles.push(b);
  return b;
}

function respawn(b) {
  const entry = pickChar({ beautyOnly: Math.random() < .65 });
  b.entry = entry;
  const elColor = (WU_XING[entry.w] || {}).color || '#7a2448';
  b.mesh.children[0].material.map = charTexture(entry.c, elColor);
  b.mesh.children[0].material.needsUpdate = true;
  b.mesh.children[2].visible = !!entry.b;
  b.mesh.material.color.setHex(PASTELS[(Math.random() * PASTELS.length) | 0]);
  b.mesh.position.set(
    bubbleX(),
    -5.5 - Math.random() * 1.4,
    (Math.random() - 0.5) * 4 - 1
  );
  b.vy = 0.35 + Math.random() * 0.6;
  b.vx = (Math.random() - 0.5) * 0.3;
  b.phase = Math.random() * Math.PI * 2;
  b.alive = true;
}

function popBubble(b) {
  if (!b.alive) return;
  b.alive = false;
  sound.play('pop');
  stats.pops++;
  const wpos = new THREE.Vector3();
  b.mesh.getWorldPosition(wpos);
  spawnBurst(wpos, 26, 0xfff4d6, 3.2);
  // 收集好字
  if (caught.length < 2) {
    caught.push(b.entry);
    renderSlots();
  }
  addEnergy(POP_ENERGY);
  respawn(b);
}

function updateBubbles(dt, t) {
  for (const b of bubbles) {
    b.mesh.position.y += b.vy * dt;
    b.mesh.position.x += b.vx * dt + Math.sin(t * 1.2 + b.phase) * b.sway * dt;
    if (b.mesh.position.y > 6.5) respawn(b);
  }
}

/* ─────────────── 中央水晶（取名之泉） ─────────────── */
const crystalMat = new THREE.MeshPhysicalMaterial({
  color: 0xb7dfd2, emissive: 0x70b9a0, emissiveIntensity: 0.35, flatShading: true,
  transparent: true, opacity: 0.85, roughness: 0.2, metalness: 0.25, clearcoat: 1
});
const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.25, 0).scale(1, 1.45, 1), crystalMat);
crystal.position.set(0, 0.2, -2.5);
crystal.scale.setScalar(1);
scene.add(crystal);
const crystalEdges = new THREE.LineSegments(new THREE.EdgesGeometry(crystal.geometry), new THREE.LineBasicMaterial({ color: 0xf9e9b9, transparent: true, opacity: .65 }));
crystal.add(crystalEdges);
crystal.userData.base = 1;

/* ─────────────── 遊戲狀態 ─────────────── */
let energy = 0;
let target = 'auto';          // 喜用神：auto / 金木水火土
const stats = { pops: 0, reveals: 0 };
const caught = [];            // 本輪收集的字
let names = [];               // 名字簿（新→舊）
let hideTimer = null;

function addEnergy(v) {
  // 揭曉期間仍累積能量；滿格立即開下一輪，不吞掉小手的輸入。
  const before = Math.floor(energy / 20);
  energy += v;
  if (Math.floor(energy / 20) > before) sound.play('rise', Math.min(energy / ENERGY_MAX, 1));
  crystal.userData.base = 1 + (energy / ENERGY_MAX) * 0.6;
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
  const given = pickGivenName({ want, count: null, preferred: caught });

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
  revealEl.classList.remove('hidden');
  // 水晶迸發 + 繽紛彩紙
  const cpos = new THREE.Vector3(); crystal.getWorldPosition(cpos);
  const confetti = [0xff5c8d, 0xffd23f, 0x3ac7ff, 0x7ed957, 0xb25cff, 0xff9ac2];
  for (let i = 0; i < 6; i++) spawnBurst(cpos, 65, confetti[(Math.random() * confetti.length) | 0], 6, -2.5);

  celebration = 1;
  launchConfetti();
  stage.classList.remove('celebrating');
  void stage.offsetWidth;
  stage.classList.add('celebrating');

  // 記錄
  names.unshift({ name: full, chars, pinyin, wx: given.elements, tags: typeTags, srcTag, ts: Date.now() });
  if (names.length > 200) names.pop();
  try { localStorage.setItem('wubaobao-names', JSON.stringify(names)); } catch (e) {}
  renderBook();

  // 收尾：重置能量與收集行
  energy = Math.max(0, energy - ENERGY_MAX);
  crystal.userData.base = 1 + energy / ENERGY_MAX * .6;
  updateEnergyUI();
  caught.length = 0;
  renderSlots();

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    revealEl.classList.add('hidden');
  }, 4600);
}

function renderSlots() {
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
  spawnBurst(pos, count, color, 2.6);
}
function hitBubbleAt(e) {
  const ndc = toNDC(e);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(bubbles.map(b => b.mesh), true);
  if (!hits.length) return;
  const bob = bubbles.find(x => x.mesh === hits[0].object || x.mesh === hits[0].object.parent);
  if (bob) popBubble(bob);
}
function swipePop(e, previous) {
  // 用螢幕上的線段掃描：稀疏的 pointermove 也不會跳過泡泡。
  const dx = e.clientX - previous.x, dy = e.clientY - previous.y;
  const length2 = dx * dx + dy * dy;
  for (const b of bubbles) {
    const projected = b.mesh.position.clone().project(camera);
    const x = (projected.x + 1) * innerWidth / 2;
    const y = (1 - projected.y) * innerHeight / 2;
    const u = length2 ? Math.max(0, Math.min(1, ((x - previous.x) * dx + (y - previous.y) * dy) / length2)) : 0;
    const radius = b.radius * innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(27.5)) * (camera.position.z - b.mesh.position.z));
    if (Math.hypot(x - previous.x - u * dx, y - previous.y - u * dy) < radius + 10) popBubble(b);
  }
  screenBurst(e, 4, 0xdac37e);
}

renderer.domElement.style.touchAction = 'none';
renderer.domElement.addEventListener('pointerdown', (e) => {
  sound.play('tap');
  if (activePointer !== null) { addEnergy(TAP_ENERGY); hitBubbleAt(e); return; }
  renderer.domElement.setPointerCapture(e.pointerId);
  activePointer = e.pointerId;
  startPt = { x: e.clientX, y: e.clientY };
  prevPt = startPt;

  screenBurst(e, 12, 0xa5d5c4);
  addEnergy(TAP_ENERGY);
  hitBubbleAt(e);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointer) return;
  const dx = e.clientX - startPt.x, dy = e.clientY - startPt.y;
  const seg = Math.hypot(e.clientX - prevPt.x, e.clientY - prevPt.y);

  const previous = prevPt;
  prevPt = { x: e.clientX, y: e.clientY };
  if (Math.hypot(dx, dy) > 14) {       // 滑動開始
    swipePop(e, previous);
    addEnergy(seg * SWIPE_ENERGY);
  }
});
function endPointer(e) {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  startPt = prevPt = null;
}
renderer.domElement.addEventListener('pointerup', endPointer);
renderer.domElement.addEventListener('pointercancel', endPointer);
renderer.domElement.addEventListener('pointerleave', (e) => { if (e.pointerId === activePointer) endPointer(e); });

// 避免 iOS 捲動／縮放
document.addEventListener('touchmove', (e) => { if (!e.target.closest('#book')) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

/* ─────────────── 五行選擇 ─────────────── */
wxbar.addEventListener('click', (e) => {
  const chip = e.target.closest('.wx-chip');
  if (!chip) return;
  target = chip.dataset.w;
  wxbar.querySelectorAll('.wx-chip').forEach(c => { c.classList.toggle('active', c === chip); c.setAttribute('aria-pressed', String(c === chip)); });
  sound.play('rise', .5);
});

/* ─────────────── 名字簿開關 ─────────────── */
bookToggle.addEventListener('click', () => bookEl.classList.toggle('hidden'));


/* ─────────────── 視窗尺寸 ─────────────── */
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  for (const b of bubbles) b.mesh.position.x = bubbleX();
}
window.addEventListener('resize', onResize);

/* ─────────────── 有上限的星塵與彩紙（共三次繪製） ─────────────── */
let celebration = 0;
const dustGeo = new THREE.BufferGeometry();
const dustPositions = new Float32Array(90 * 3);
for (let i = 0; i < dustPositions.length; i++) dustPositions[i] = (Math.random() - .5) * 22;
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xc4a570, size: .035, transparent: true, opacity: .5, depthWrite: false }));
scene.add(dust);
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleSheen, color: 0xffdd8a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
halo.position.copy(crystal.position); scene.add(halo);
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
    c.p.copy(crystal.position);
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
  window.wubaobaoQA = () => ({ energy, names: names.length, pops: stats.pops, reveals: stats.reveals,
    caught: caught.map(e => e.c), audio: sound.ctx?.state, sound: { ...sound.settings },
    gains: sound.ctx ? [sound.effects.gain.value, sound.music.gain.value] : [],
    voices: sound.voices, particles: P.active, drawCalls: renderer.info.render.calls,
    textures: renderer.info.memory.textures, pixelRatio: renderer.getPixelRatio(),
    bubbles: bubbles.map(b => { const p = b.mesh.position.clone().project(camera); return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2, c: b.entry.c }; }) });
}

/* ─────────────── 主迴圈 ─────────────── */
const clock = new THREE.Clock();
function visibleWidth() { return Math.min(28, 16 * camera.aspect); }
function bubbleX() { return innerWidth > 900 ? -2.5 + Math.random() * 12 : (Math.random() - .5) * visibleWidth(); }

initParticles();
loadNames();
renderBook();
renderSlots();
// 隨機撒第一波泡泡
for (let i = 0; i < BUBBLE_COUNT; i++) {
  makeBubble(
    new THREE.Vector3(bubbleX(), (Math.random() - 0.5) * 11, (Math.random() - 0.5) * 4 - 1),
    0.38 + Math.random() * 0.34
  );
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  updateBubbles(dt, t);
  updateCelebration(dt, t);
  if (!reducedMotion) {
    camera.position.x = Math.sin(t * .12) * .07;
    camera.position.y = .4 + Math.sin(t * .17) * .045;
    dust.rotation.z = Math.sin(t * .08) * .035;
  }
  updateParticles(dt);

  // 水晶呼吸 + 能量脈動
  const pulse = reducedMotion ? 1 : 1 + Math.sin(t * 2.2) * 0.06;
  crystal.scale.setScalar((crystal.userData.base + celebration * .9) * pulse);
  crystal.rotation.y += dt * 0.4;
  crystal.rotation.x = Math.sin(t * 0.5) * 0.15;
  crystalMat.emissiveIntensity = 0.35 + (energy / ENERGY_MAX) * 1.3 + celebration * 2;

  crystalMat.color.setHSL(.42 - Math.min(energy / ENERGY_MAX, 1) * .28, .32, .72);
  renderer.render(scene, camera);
}
animate();