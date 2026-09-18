// wubaobao · 泡泡取名機
// 玩法（邏輯簡單，看一眼就懂，連嬰兒亂摸都能玩）：
//   1. 摸一下 / 滑一下，畫面就會冒出一團氣泡，能量澆進頂上的「取名能量瓶」。
//   2. 點中泡泡、或滑動掃過泡泡，就把那個好字「收集」到中間的名字行。
//   3. 能量滿了，中央水晶迸發，生出一組「吳 ＋ 一字或兩字」的名字，
//      名字的五行會標出來；父母若設了「喜用神」，系統會優先補那個五行。
//   4. 取下一個名字，就自動記進底下的「名字簿」（存於本機）。
// 任何輸入都算數：嬰兒亂敲、亂滑，能量照樣累積，一定會取名。
import * as THREE from './three.module.js';

/* ─────────────── 基本設定 ─────────────── */
const WU = '吳';
const ENERGY_MAX = 100;
const TAP_ENERGY = 10;        // 每一下
const SWIPE_ENERGY = 0.18;    // 每移動 1px
const POP_ENERGY = 4;         // 收集一個字額外 +4
const BUBBLE_COUNT = 46;

const CAT_LABEL = { xiangxing: '象形', xingsheng: '形聲', huiyi: '會意', zhishi: '指事', jingfang: '經方' };

// 每個字 → 附加資訊的對照（六書類別／來源）
const CHAR_META = new Map();
for (const [cat, arr] of Object.entries(POOL)) {
  if (cat === 'all' || !Array.isArray(arr)) continue;
  for (const e of arr) CHAR_META.set(e.c, { ...e, cat, catLabel: CAT_LABEL[cat] || cat });
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
const bookClear = document.getElementById('bookClear');
const wxbar = document.getElementById('wxbar');

/* ─────────────── 渲染器 / 場景 / 相機 ─────────────── */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.font = '900 170px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(ch, 128, 140);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  charTexCache.set(ch, tex);
  return tex;
}

/* ─────────────── 粒子系統（點擊／滑動／取名迸發） ─────────────── */
const MAX_PARTICLES = 1400;
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
    size: 0.5, map, vertexColors: true, transparent: true,
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
const sphereGeo = new THREE.SphereGeometry(1, 24, 24);

function makeBubble(pos, radius) {
  const entry = pickChar({ beautyOnly: true }) || pickChar({ beautyOnly: false });
  const mat = new THREE.MeshPhongMaterial({
    color: PASTELS[(Math.random() * PASTELS.length) | 0],
    shininess: 90, transparent: true, opacity: 0.85
  });
  const mesh = new THREE.Mesh(sphereGeo, mat);
  mesh.scale.setScalar(radius);
  const elColor = (WU_XING[entry.w] || {}).color || '#7a2448';
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: charTexture(entry.c, elColor), transparent: true, depthWrite: false
  }));
  sprite.scale.setScalar(radius * 1.9);
  mesh.add(sprite);
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
  const entry = pickChar({ beautyOnly: true }) || pickChar({ beautyOnly: false });
  b.entry = entry;
  const elColor = (WU_XING[entry.w] || {}).color || '#7a2448';
  b.mesh.children[0].material.map = charTexture(entry.c, elColor);
  b.mesh.children[0].material.needsUpdate = true;
  b.mesh.material.color.setHex(PASTELS[(Math.random() * PASTELS.length) | 0]);
  b.mesh.position.set(
    (Math.random() - 0.5) * 15,
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
  color: 0xffb3c9, emissive: 0xff3d7f, emissiveIntensity: 0.55,
  transparent: true, opacity: 0.85, roughness: 0.16, metalness: 0.1, clearcoat: 1
});
const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), crystalMat);
crystal.position.set(0, 0.2, -2.5);
crystal.scale.setScalar(1);
scene.add(crystal);
crystal.userData.base = 1;

/* ─────────────── 遊戲狀態 ─────────────── */
let energy = 0;
let target = 'auto';          // 喜用神：auto / 金木水火土
const caught = [];            // 本輪收集的字
let isRevealing = false;
let names = [];               // 名字簿（新→舊）
let hideTimer = null;

function addEnergy(v) {
  if (isRevealing) return;
  energy = Math.min(ENERGY_MAX, energy + v);
  crystal.userData.base = 1 + (energy / ENERGY_MAX) * 0.6;
  updateEnergyUI();
  if (energy >= ENERGY_MAX) generateName();
}

function updateEnergyUI() {
  const pct = Math.round((energy / ENERGY_MAX) * 100);
  energyFill.style.width = pct + '%';
  energyLabel.textContent = pct;
}

/* ─────────────── 取名 ─────────────── */
function generateName() {
  if (isRevealing) return;
  isRevealing = true;
  const want = target === 'auto' ? null : target;
  const given = pickGivenName({ want, count: null });

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
  revealTag.innerHTML = `五行 ${wxIcons} ${wxLabels} &nbsp;·&nbsp; ${typeTags}${srcTag}<br><span style="font-size:13px;color:#c89">${pinyin}</span>`;
  revealEl.classList.remove('hidden');
  // 水晶迸發 + 繽紛彩紙
  crystal.userData.base = 1.9;
  const cpos = new THREE.Vector3(); crystal.getWorldPosition(cpos);
  const confetti = [0xff5c8d, 0xffd23f, 0x3ac7ff, 0x7ed957, 0xb25cff, 0xff9ac2];
  for (let i = 0; i < 4; i++) spawnBurst(cpos, 30, confetti[(Math.random() * confetti.length) | 0], 6, -2.5);

  // 記錄
  names.unshift({ name: full, chars, wx: given.elements, tags: typeTags, srcTag, ts: Date.now() });
  if (names.length > 200) names.pop();
  try { localStorage.setItem('wubaobao-names', JSON.stringify(names)); } catch (e) {}
  renderBook();

  // 收尾：重置能量與收集行
  energy = 0;
  crystal.userData.base = 1;
  updateEnergyUI();
  caught.length = 0;
  renderSlots();

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    revealEl.classList.add('hidden');
    isRevealing = false;
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
    names = raw ? JSON.parse(raw) : [];
  } catch (e) { names = []; }
}
function renderBook() {
  bookCount.textContent = names.length;
  if (!bookEl) return;
  if (!names.length) {
    bookEl.innerHTML = '<h3>名字簿</h3><div class="book-empty">還沒有名字，快來摸一摸！</div>' +
      '<button id="bookClear" type="button">清空</button>';
  } else {
    bookEl.innerHTML = '<h3>名字簿 · ' + names.length + ' 個</h3>' +
      names.map((n, i) =>
        `<div class="book-item"><span class="nm">${i === 0 ? '⭐ ' : ''}${n.name}</span>` +
        `<span class="tg">${(n.wx || []).map(w => '<span style="color:' + (WU_XING[w] ? WU_XING[w].color : '#888') + '">' + (WU_XING[w] ? WU_XING[w].icon : '') + '</span>').join(' ')} ${n.tags || ''}${n.srcTag || ''}</span>` +
        `<span class="py">${n.chars.join(' ')}</span></div>`).join('') +
      '<button id="bookClear" type="button">清空名字簿</button>';
  }
  const bc = document.getElementById('bookClear');
  if (bc) bc.addEventListener('click', () => { names = []; saveNames(); renderBook(); });
}
function saveNames() {
  try { localStorage.setItem('wubaobao-names', JSON.stringify(names)); } catch (e) {}
}

/* ─────────────── 輸入：觸控／滑鼠（手指、滑鼠、iPad 全支援） ─────────────── */
const raycaster = new THREE.Raycaster();
let activePointer = null;
let startPt = null, prevPt = null, traveled = 0, swipePath = [];

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
  const dir = raycaster.ray.direction.clone();
  const pos = camera.position.clone().add(dir.multiplyScalar(3.2));
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
function swipePop(e) {
  const ndc = toNDC(e);
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const pt = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(plane, pt)) {
    swipePath.push(pt.clone());
    // 掃過的路徑會彈破附近泡泡
    for (const b of bubbles) {
      if (!b.alive) continue;
      for (const p of swipePath) {
        if (b.mesh.position.distanceTo(p) < b.radius * 2.4) { popBubble(b); break; }
      }
    }
    // 冒一團金色小氣泡當拖尾
    spawnBurst(pt, 4, 0xffd23f, 0.8);
    if (swipePath.length > 60) swipePath.shift();
  }
}

renderer.domElement.style.touchAction = 'none';
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (activePointer !== null) return;
  activePointer = e.pointerId;
  startPt = { x: e.clientX, y: e.clientY };
  prevPt = startPt;
  traveled = 0;
  swipePath.length = 0;
  screenBurst(e, 12, 0xff8fb3);
  addEnergy(TAP_ENERGY);
  hitBubbleAt(e);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointer) return;
  const dx = e.clientX - startPt.x, dy = e.clientY - startPt.y;
  const seg = Math.hypot(e.clientX - prevPt.x, e.clientY - prevPt.y);
  traveled += seg;
  prevPt = { x: e.clientX, y: e.clientY };
  if (Math.hypot(dx, dy) > 14) {       // 滑動開始
    swipePop(e);
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
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

/* ─────────────── 五行選擇 ─────────────── */
wxbar.addEventListener('click', (e) => {
  const chip = e.target.closest('.wx-chip');
  if (!chip) return;
  target = chip.dataset.w;
  wxbar.querySelectorAll('.wx-chip').forEach(c => c.classList.toggle('active', c === chip));
});

/* ─────────────── 名字簿開關 ─────────────── */
bookToggle.addEventListener('click', () => bookEl.classList.toggle('hidden'));
bookEl.addEventListener('click', (e) => {
  if (e.target.id === 'bookClear') { /* 由 renderBook 重新綁定 */ }
});

/* ─────────────── 視窗尺寸 ─────────────── */
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

/* ─────────────── 主迴圈 ─────────────── */
const clock = new THREE.Clock();
initParticles();
loadNames();
renderBook();
renderSlots();
// 隨機撒第一波泡泡
for (let i = 0; i < BUBBLE_COUNT; i++) {
  makeBubble(
    new THREE.Vector3((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 11, (Math.random() - 0.5) * 4 - 1),
    0.5 + Math.random() * 0.6
  );
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  updateBubbles(dt, t);
  updateParticles(dt);

  // 水晶呼吸 + 能量脈動
  const pulse = 1 + Math.sin(t * 2.2) * 0.06;
  crystal.scale.setScalar(crystal.userData.base * pulse);
  crystal.rotation.y += dt * 0.4;
  crystal.rotation.x = Math.sin(t * 0.5) * 0.15;
  crystalMat.emissiveIntensity = 0.55 + (energy / ENERGY_MAX) * 1.4;

  renderer.render(scene, camera);
}
animate();