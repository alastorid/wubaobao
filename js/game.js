// 吳・古本取名：六爻成卦，依古本四部取名。喜用神只有木、火。
//
// 玩法不變的那條鐵律：任何觸碰（點或滑）都會擲爻、累積進度，
// 擲滿六爻必定成卦、必定得一個名字，永遠不會卡住。
import { SoundGarden } from './audio.js';
import { SOURCES, SOURCE_BY_ID } from './classics.js';
import { castChar, castLine, resolveCasting, LINE_COUNT } from './oracle.js';
import { CHARACTERS, WU_XING, RATIO, pickGivenName, findBanned, sourceStats } from './namepool.js';

const $ = (id) => document.getElementById(id);
const sound = new SoundGarden();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const LINE_LABEL = ['初', '二', '三', '四', '五', '上'];

let lines = [];
let book = 'yijing';
let target = 'auto'; // 'auto' = 木火七三之序 | '木' | '火'
let casting = null; // 上一次成卦的經文面板
let caught = [];
let names = [];
let casts = 0;
let round = 1;
let pointer = null;
let revealTimer = null;
let toastTimer = null;
const stats = { taps: 0, hexagrams: 0, reveals: 0 };

// ── 卦盤 ────────────────────────────────────────────────
// 少陰 ⚋ = 兩段、少陽 ⚊ = 一段；由上爻往初爻顯示，與卦辭一致。
function yaoRow(index, value) {
  const row = document.createElement('i');
  row.className = 'yao';
  const part = () => Object.assign(document.createElement('b'), { className: 'seg' });
  if (value == null) {
    row.classList.add('empty');
    row.setAttribute('aria-label', LINE_LABEL[index] + '爻未擲');
    row.append(part(), part());
  } else if (value) {
    row.classList.add('yang');
    row.setAttribute('aria-label', LINE_LABEL[index] + '爻少陽');
    const seg = part();
    seg.classList.add('full');
    row.append(seg);
  } else {
    row.classList.add('yin');
    row.setAttribute('aria-label', LINE_LABEL[index] + '爻少陰');
    row.append(part(), part());
  }
  return row;
}

function renderHexagram() {
  const rows = [];
  for (let i = LINE_COUNT - 1; i >= 0; i--) rows.push(yaoRow(i, lines[i]));
  $('hexagram').replaceChildren(...rows);
  $('castLabel').textContent = `爻 ${lines.length} / ${LINE_COUNT}`;
  $('hexagram').setAttribute(
    'aria-label',
    `卦盤：已擲 ${lines.length} 爻，共 ${LINE_COUNT} 爻`,
  );
}

function renderProgress() {
  const pct = (lines.length / LINE_COUNT) * 100;
  $('energyFill').style.width = pct + '%';
  $('energyLabel').textContent = Math.round(pct) + '%';
  $('energy').setAttribute('aria-valuenow', Math.round(pct));
}

// ── 經文面板 ────────────────────────────────────────────
function renderPanel() {
  const source = SOURCE_BY_ID[book];
  $('stageBook').textContent = source.name;
  if (!casting) {
    $('panelSeal').textContent = source.seal;
    $('panelTitle').textContent = '靜待起卦';
    $('panelWx').textContent = '';
    $('panelBody').replaceChildren();
    $('castHint').textContent = '點一下卦盤，或按「擲爻」，起第一卦。';
    return;
  }
  $('panelSeal').textContent = casting.seal;
  $('panelTitle').textContent = casting.title;
  $('panelWx').textContent = casting.wx ? `屬${casting.wx}` : '';
  const body = document.createDocumentFragment();
  for (const row of casting.lines) {
    const dt = document.createElement('dt');
    dt.textContent = row.k;
    const dd = document.createElement('dd');
    dd.textContent = row.v;
    body.append(dt, dd);
  }
  $('panelBody').replaceChildren(body);
  const left = LINE_COUNT - lines.length;
  $('castHint').textContent = left
    ? `已成「${casting.title}」 · 再擲 ${left} 爻，可得新卦。`
    : `已成「${casting.title}」 · 繼續擲爻。`;
}

// ── 所收之字 ────────────────────────────────────────────
function renderSlots() {
  const notes = [];
  for (let i = 0; i < 2; i++) {
    const el = $('slot' + i);
    const entry = caught[i];
    el.textContent = entry ? entry.c : '？';
    el.classList.toggle('empty', !entry);
    el.classList.toggle('wood', !!entry && entry.w === '木');
    el.classList.toggle('fire', !!entry && entry.w === '火');
    if (entry) notes.push(entry);
  }
  const host = $('slotNotes');
  host.replaceChildren(
    ...notes.filter(Boolean).map((entry) => {
      const p = document.createElement('p');
      p.textContent = `${entry.c} · ${entry.s}畫 · ${bookLabel(entry.book)} ${entry.cite} · ${entry.meaning}`;
      return p;
    }),
  );
}

const bookLabel = (id) => (SOURCE_BY_ID[id] ? SOURCE_BY_ID[id].name : '');

function collect() {
  const want = target === 'auto' ? null : target;
  const entry = castChar(book, want);
  if (!entry) return;
  caught = [entry, ...caught.filter((e) => e.c !== entry.c)].slice(0, 2);
  renderSlots();
}

// ── 擲爻 ────────────────────────────────────────────────
function cast() {
  if (lines.length >= LINE_COUNT) {
    // 卦已滿：先成卦取名，再重起新卦
    complete();
    lines = [];
    renderHexagram();
    renderProgress();
    return;
  }
  lines.push(castLine());
  casts++;
  stats.taps++;
  sound.play('cast');
  collect();
  renderHexagram();
  renderProgress();
  if (lines.length >= LINE_COUNT) {
    casting = resolveCasting(book, lines);
    renderPanel();
    sound.play('hexagram');
    burst($('hexagram').getBoundingClientRect(), true);
    complete();
    lines = [];
    renderHexagram();
    renderProgress();
  }
}

// ── 取名 ────────────────────────────────────────────────
function complete() {
  if (lines.length >= LINE_COUNT) {
    casting = resolveCasting(book, lines);
    renderPanel();
  }
  const given = pickGivenName({
    want: target === 'auto' ? null : target,
    count: null,
    preferred: caught,
  });
  if (!given.chars.length) return;
  const full = '吳' + given.chars.map((e) => e.c).join('');
  const banned = findBanned(full);
  if (banned.length) {
    // 自我防護：禁用字不可能進入名字簿
    console.warn('命中禁用字，已跳過：', banned.join(''));
    return;
  }
  const record = {
    name: full,
    chars: given.chars.map((e) => e.c),
    pinyin: given.chars.map((e) => e.p).join(' '),
    wx: given.elements,
    cites: given.chars.map((e) => `${bookLabel(e.book)} ${e.cite}`),
    meanings: given.chars.map((e) => e.meaning),
    strokes: given.chars.map((e) => e.s),
    book,
    casting: casting ? casting.title : '',
    ts: Date.now(),
  };
  names = [record, ...names].slice(0, 200);
  saveNames();
  renderBook();
  round++;
  stats.reveals++;

  $('revealSource').textContent = casting
    ? `${bookLabel(book)} · ${casting.title}`
    : bookLabel(book);
  $('revealName').textContent = full;
  $('revealTag').textContent =
    given.elements.map((w) => `${w}（${WU_XING[w].role}）`).join(' · ') +
    ' · ' +
    record.pinyin;
  const list = document.createDocumentFragment();
  record.chars.forEach((c, i) => {
    const li = document.createElement('li');
    li.textContent = `${c} · ${record.strokes[i]}畫 · ${record.cites[i]} · ${record.meanings[i]}`;
    list.append(li);
  });
  $('revealMeaning').replaceChildren(list);
  $('reveal').classList.remove('hidden');
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => $('reveal').classList.add('hidden'), 4600);
  burst(document.getElementById('stage').getBoundingClientRect(), true);
  sound.play('reveal');
  caught = [];
  renderSlots();
}

// ── 特效 ────────────────────────────────────────────────
function burst(rect, big = false) {
  if (reduced) return;
  const root = $('effects');
  const ox = rect.left + rect.width / 2;
  const oy = rect.top + rect.height / 2;
  const palette = book === 'ziwei'
    ? ['#b8862f', '#e8c86a', '#8c3a2e', '#f0e2bd']
    : ['#7a5c34', '#a8412c', '#3f7a4e', '#c9a961'];
  for (let i = 0; i < (big ? 34 : 10) && root.childElementCount < 90; i++) {
    const p = document.createElement('i');
    p.className = 'spark';
    p.style.left = ox + 'px';
    p.style.top = oy + 'px';
    p.style.background = palette[i % palette.length];
    p.style.setProperty('--dx', (Math.random() - 0.5) * (big ? 520 : 150) + 'px');
    p.style.setProperty('--dy', (Math.random() - 0.6) * (big ? 440 : 150) + 'px');
    root.append(p);
    setTimeout(() => p.remove(), 900);
  }
}

// ── 來源分頁 ────────────────────────────────────────────
function renderBooks() {
  const host = $('books');
  host.replaceChildren(
    ...SOURCES.map((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.book = s.id;
      b.setAttribute('aria-pressed', String(s.id === book));
      b.className = 'book-tab' + (s.id === book ? ' active' : '');
      b.innerHTML = `<b aria-hidden="true">${s.seal}</b><span>${s.name.replace('古本', '')}</span>`;
      b.onclick = () => {
        if (book === s.id) return;
        book = s.id;
        caught = [];
        casting = null;
        lines = [];
        renderBooks();
        renderHexagram();
        renderProgress();
        renderSlots();
        renderPanel();
        sound.play('rise', 0.5);
        toast(`已換到 ${s.name} · ${s.blurb}`);
      };
      return b;
    }),
  );
  $('bookBlurb').textContent = SOURCE_BY_ID[book].blurb;
  // 卦檯角落的硃砂印跟著古本換
  $('stage').dataset.seal = SOURCE_BY_ID[book].seal;
}

// ── 名字簿 ──────────────────────────────────────────────
function saveNames() {
  try {
    localStorage.setItem('wubaobao-names', JSON.stringify(names));
  } catch {}
}
function loadNames() {
  try {
    const parsed = JSON.parse(localStorage.getItem('wubaobao-names') || '[]');
    names = Array.isArray(parsed)
      ? parsed
          .filter((n) => n && typeof n.name === 'string' && Array.isArray(n.chars))
          .filter((n) => !findBanned(n.name).length)
          .slice(0, 200)
      : [];
  } catch {
    names = [];
  }
}
function renderBook() {
  $('bookCount').textContent = names.length;
  const host = $('bookList');
  host.replaceChildren();
  if (!names.length) {
    const p = document.createElement('p');
    p.className = 'book-empty';
    p.textContent = '擲滿六爻，第一個名字就會出現。';
    host.append(p);
    return;
  }
  names.forEach((n, i) => {
    const row = document.createElement('div');
    row.className = 'book-item';
    const name = document.createElement('span');
    name.className = 'nm';
    name.textContent = n.name;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const py = document.createElement('p');
    py.className = 'py';
    py.textContent = n.pinyin || '';
    const tg = document.createElement('p');
    tg.className = 'tg';
    tg.textContent = [n.casting, (n.wx || []).join(' · ')].filter(Boolean).join(' · ');
    meta.append(py, tg);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'book-delete';
    del.textContent = '×';
    del.ariaLabel = '刪除' + n.name;
    del.onclick = () => {
      names.splice(i, 1);
      saveNames();
      renderBook();
    };
    row.append(name, meta, del);
    host.append(row);
  });
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.id = 'bookClear';
  clear.textContent = '清空名錄';
  clear.onclick = () => {
    names = [];
    saveNames();
    renderBook();
  };
  host.append(clear);
}

// ── 提示 ────────────────────────────────────────────────
function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 3400);
}

// ── 事件 ────────────────────────────────────────────────
$('castButton').onclick = () => cast();
$('bookToggle').onclick = () => $('book').classList.toggle('hidden');
$('bookClose').onclick = () => $('book').classList.add('hidden');
$('book').addEventListener('click', (e) => {
  if (e.target === $('book')) $('book').classList.add('hidden');
});

for (const button of $('wxbar').querySelectorAll('button')) {
  button.onclick = () => {
    target = button.dataset.w;
    caught = [];
    renderSlots();
    for (const b of $('wxbar').querySelectorAll('button')) {
      b.classList.toggle('active', b === button);
      b.setAttribute('aria-pressed', String(b === button));
    }
    sound.play('rise', 0.5);
    toast(
      target === 'auto'
        ? '木火七三之序：木為喜用，火為次用，不狂補火。'
        : `只取${target}行之字。${WU_XING[target].role}。`,
    );
  };
}

$('fullscreenToggle').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else toast('iPad 可在 Safari 點「分享」→「加入主畫面」，享受全螢幕。');
  } catch {
    toast('可從 Safari「分享」→「加入主畫面」開啟。');
  }
};
document.addEventListener('fullscreenchange', () => {
  $('fullscreenToggle').ariaLabel = document.fullscreenElement ? '退出全螢幕' : '進入全螢幕';
});

// 點與滑：任何輸入都擲爻，讓「永遠取得到名」這條保證成立
const UI = '#tools, #wxbar, #books, #book, #bookToggle, #reveal, #castButton';
document.addEventListener('pointerdown', (e) => {
  if (e.target.closest(UI)) return;
  sound.unlock();
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  cast();
});
document.addEventListener('pointermove', (e) => {
  if (!pointer || pointer.id !== e.pointerId) return;
  const distance = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
  if (distance < 34) return;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  cast();
});
for (const event of ['pointerup', 'pointercancel'])
  document.addEventListener(event, () => (pointer = null));
document.addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || ['Tab', 'Escape'].includes(e.key)) return;
  if (e.target.closest('button')) return;
  sound.unlock();
  cast();
});

// ── 啟動 ────────────────────────────────────────────────
function renderPoolNote() {
  const s = sourceStats();
  $('poolNote').textContent =
    `${CHARACTERS.length} 個古本取名用字 · 木 ${s.木.total} 字（火 ${s.火.total} 字） · 七三之序取名`;
}
renderBooks();
renderHexagram();
renderProgress();
renderSlots();
renderPanel();
renderPoolNote();
loadNames();
renderBook();

if (new URLSearchParams(location.search).has('qa')) {
  window.wubaobaoQA = () => ({
    book,
    target,
    lines: lines.map((v) => (v == null ? null : v ? 1 : 0)),
    lineCount: lines.length,
    round,
    casts,
    names: names.length,
    caught: caught.map((e) => e.c),
    casting: casting ? casting.title : null,
    panelTitle: $('panelTitle').textContent,
    revealVisible: !$('reveal').classList.contains('hidden'),
    progress: Number($('energyFill').style.width.replace('%', '')) || 0,
    audio: sound.ctx?.state,
    sound: { ...sound.settings },
    gains: sound.ctx ? [sound.effects.gain.value, sound.music.gain.value] : [],
    levels: [sound.outputLevel('effects'), sound.outputLevel('music')],
    voices: sound.voices,
    particles: $('effects').childElementCount,
    ...stats,
  });
}