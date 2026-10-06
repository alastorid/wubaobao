// 吳・古本取名：六爻成卦，依古本四部取名。喜用神只有木、火。
//
// 玩法不變的那條鐵律：任何觸碰（點或滑）都會擲爻、累積進度，
// 擲滿六爻必定成卦、必定得一個名字，永遠不會卡住。
import { SoundGarden } from './audio.js';
import { SOURCES, SOURCE_BY_ID } from './classics.js';
import { castChar, castLine, resolveCasting, LINE_COUNT } from './oracle.js';
import {
  CHARACTERS, CHAR_BY_CODE, WU_XING, RATIO, pickGivenName, findBanned, sourceStats,
} from './namepool.js';

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

// ── 姓 ────────────────────────────────────────────────────
// 姓不再寫死「吳」。原因有二：
//   1. 產品對不姓吳的家庭毫無用處。
//   2. 普通話「吳」與「無」同音，姓吳會讓每個名字都自動產生一個
//      「無X」的諧音（吳德＝無德、吳明＝無名、吳夫＝無夫）。
//      讓使用者自己填姓，並對連讀諧音做檢查，才是正確做法。
const DEFAULT_SURNAME = '吳';
let SURNAME = DEFAULT_SURNAME;
const SURNAME_KEY = 'wubaobao-surname';

// 姓＋名連讀會變成不好聽的詞時擋下。
// 只擋明確的負面連讀，不做過度猜測。
const SURNAME_CLASH = new Map([
  // 吳＝無
  ['夫', 'wú fū「無夫」'], ['死', 'wú sǐ「無死」'], ['命', 'wú mìng「無命」'],
  ['物', 'wú wù「無物」'], ['異', 'wú yì「無異」'], ['精', 'wú jīng「無精」'],
  ['文', 'wú wén「無文」'], ['德', 'wú dé「無德」'], ['明', 'wú míng「無名」'],
  ['容', 'wú róng「無容」'], ['嘉', 'wú jiā「無家」'], ['門', 'wú mén「無門」'],
  ['光', 'wú guāng「無光」'], ['情', 'wú qíng「無情」'], ['知', 'wú zhī「無知」'],
  ['行', 'wú xíng「無行」'], ['思', 'wú sī「無私」'], ['善', 'wú shàn「無善」'],
  ['愛', 'wú ài「無愛」'], ['聲', 'wú shēng「無聲」'], ['果', 'wú guǒ「無果」'],
  // 其他常見姓的連讀風險
  ['琴', 'qín qín「琴琴」'], ['逍', 'xiāo yáo'],
]);

function surnameClash(chars) {
  for (const c of chars) {
    if (SURNAME === '吳' && SURNAME_CLASH.has(c)) return SURNAME_CLASH.get(c);
    // 「梧」與「吳」同音：吳梧＝wú wú
    if (SURNAME === '吳' && c === '梧') return 'wú wú（同音疊字）';
  }
  return null;
}

function surnameValid(s) {
  // 一到兩個漢字。只收漢字，不收空白或符號（名簿與複製都靠它）。
  return /^[一-鿿]{1,2}$/.test(s);
}

function loadSurname() {
  try {
    const saved = localStorage.getItem(SURNAME_KEY);
    if (saved && surnameValid(saved)) SURNAME = saved;
  } catch {
    /* localStorage 不可用就沿用預設值 */
  }
}

function setSurname(next) {
  SURNAME = surnameValid(next) ? next : DEFAULT_SURNAME;
  try {
    localStorage.setItem(SURNAME_KEY, SURNAME);
  } catch {
    /* 存不進去不影響本次使用 */
  }
  const slot = $('surnameSlot');
  if (slot) slot.textContent = SURNAME;
  const input = $('surnameInput');
  if (input && input.value !== SURNAME) input.value = SURNAME;
  // 舊名錄是用「吳」存的，換姓後顯示也要跟著換。
  for (const n of names) {
    if (typeof n.name === 'string' && n.name.startsWith(DEFAULT_SURNAME)) {
      n.name = SURNAME + n.name.slice(DEFAULT_SURNAME.length);
    }
  }
  renderBook();
}

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
      // 同上：cite 已含書名，不再疊 bookLabel。
      const cite = entry.cite || `${bookLabel(entry.book)} ${entry.book}`;
      p.textContent = `${entry.c} · ${entry.s}畫 · ${cite} · ${entry.meaning}`;
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
  // 三道自我防護：使用者禁用字、行業忌字、以及「姓＋名」連讀的諧音陷阱。
  //
  // 這三道都會「重抽」而不是直接放棄名字。原因是「擲滿六爻必定成名」
  // 是產品承諾：使用者擲了六次就要拿到一個名字，不能因為諧音檢查
  // 抽到就整個丟掉，否則會出現擲滿六爻卻什麼都沒有的情況。
  let full = '';
  let picked = given;
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = SURNAME + picked.chars.map((e) => e.c).join('');
    if (picked.chars.length && !findBanned(candidate).any.length
        && !surnameClash(picked.chars.map((e) => e.c))) {
      full = candidate;
      break;
    }
    // 這一組不行就換一組。preferred 是本輪已收之字，
    // 重抽時不再偏好它們，避免一直撞到同一批。
    const retry = pickGivenName({
      want: target === 'auto' ? null : target,
      count: picked.count,
    });
    if (!retry.chars.length) break;
    picked = retry;
  }
  if (!full) return;
  // 用 picked 而不是 given：上面那一輪重抽可能換了字。
  const record = {
    name: full,
    chars: picked.chars.map((e) => e.c),
    pinyin: picked.chars.map((e) => e.p).join(' '),
    wx: picked.elements,
    // cite 本身就已經標了書名（「易經·大過·卦辭」），不要再疊一層
    // bookLabel（「古本易經」），否則會顯示成「古本易經 易經·大過·卦辭」。
    cites: picked.chars.map((e) => e.cite),
    meanings: picked.chars.map((e) => e.meaning),
    strokes: picked.chars.map((e) => e.s),
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
  // 拼音用不換行空格接起來。
  //
  // 理由：兩個音節之間用一般空格時，瀏覽器會在那裡斷行，
  // 「zhēn rén」會變成「zhēn」一行、「rén」一行——看起來像兩個詞。
  // 用 U+00A0（不換行空格）之後整組拼音保證同行，
  // 需要的話只會在「·」之後斷行。
  const pinyin = record.pinyin.replace(/ /g, '\u00a0');
  $('revealTag').textContent =
    picked.elements.map((w) => `${w}（${WU_XING[w].role}）`).join(' · ') +
    ' · ' +
    pinyin;
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
  updatePoolNote();
}

// 標題與副標跟著古本數量走，日後增刪不必改文案
const CN_NUM = '零一二三四五六七八九十';
function renderSourceTitles() {
  const count = SOURCES.length;
  $('booksTitle').textContent = `古本${CN_NUM[count] || count}部`;
  $('brandSub').textContent = SOURCES.map((s) =>
    s.name.replace('古本', '').replace('神農本草', '本草'),
  ).join(' · ');
}

// ── 複製名錄 ────────────────────────────────────────────
// 三種格式：只複製名字、複製含出處、複製全部。
// 主要用途是把名單貼給老師或命理師，讓人從中挑出更有 context 的名字。
// 單一名字的完整說明，逐字列出典據與寓意
function oneNameDetail(n) {
  const head = `${n.name}　${n.pinyin || ''}　${(n.wx || []).join(' · ')}`;
  const chars = n.chars
    .map((c, i) => `${c}（${(n.strokes || [])[i] ?? '?'}畫・${(n.cites || [])[i] || ''}・${(n.meanings || [])[i] || ''}）`)
    .join(' ');
  const tail = n.casting ? `成卦：${n.casting}` : '';
  return [head, `　${chars}`, tail].filter(Boolean).join('\n');
}

const COPY_MODES = {
  // 只給名字，一行一個，方便直接貼出去問
  names: () => names.map((n) => n.name).join('\n'),
  // 名字 + 逐字出處，讓人知道每個字的典據
  detail: () => names.map(oneNameDetail).join('\n\n'),
  // 全部欄位，給需要完整脈絡的人
  all: () =>
    names
      .map((n, i) => {
        const lines = [
          `${i + 1}. ${n.name}　${n.pinyin || ''}`,
          `　五行：${(n.wx || []).join(' · ')}`,
        ];
        if (n.casting) lines.push(`　成卦：${n.casting}`);
        if (n.strokes?.length) lines.push(`　筆畫：${n.strokes.join(' · ')}`);
        (n.cites || []).forEach((cite, k) => {
          lines.push(`　${n.chars[k]}：${cite}　${(n.meanings || [])[k] || ''}`);
        });
        return lines.join('\n');
      })
      .join('\n\n'),
};

// 貼上剪貼簿。navigator.clipboard 需要安全內容，
// 萬一不可用就退回舊的 execCommand 寫法（iPad Safari 較常遇到）。
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.append(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

async function copyMode(mode) {
  if (!names.length) return;
  const text = COPY_MODES[mode]();
  const ok = await copyText(text);
  const label = { names: '名字', detail: '含出處', all: '全部' }[mode];
  if (ok) {
    toast(`已複製 ${names.length} 個${label}到剪貼簿`);
    sound.play('rise', 0.6);
  } else {
    toast('這個瀏覽器不允許自動複製，請手動選取');
  }
}

// ── 名錄 ────────────────────────────────────────────────
function saveNames() {
  try {
    localStorage.setItem('wubaobao-names', JSON.stringify(names));
  } catch {}
}
// 舊名錄的每一筆都要通過結構檢查。
// 只驗 name/chars 是不夠的：wx、strokes、cites、meanings 若型別錯誤，
// 下面 renderBook 的 (n.wx || []).join 會拋錯，而那次呼叫在模組頂層，
// 會讓整個模組中止、連 QA 快照都不會定義，而且沒有任何復原管道。
// 這裡逐項驗過，任何一項不合格就丟棄該筆（寧可少一個名字，不可整頁壞掉）。
function sanitizeName(n) {
  if (!n || typeof n !== 'object') return null;
  if (typeof n.name !== 'string' || !n.name) return null;
  if (!Array.isArray(n.chars) || !n.chars.length) return null;
  if (!n.chars.every((c) => typeof c === 'string' && c)) return null;

  // 五行：舊格式是字串陣列，新格式是 {木,火} 物件。兩者都要能安全處理。
  let wx = [];
  if (Array.isArray(n.wx)) {
    wx = n.wx.filter((w) => w === '木' || w === '火');
  } else if (n.wx && typeof n.wx === 'object') {
    wx = [n.wx['木'], n.wx['火']].filter((w) => w === '木' || w === '火');
  }
  if (!wx.length) wx = n.chars.map((c) => CHAR_BY_CODE.get(c)?.w).filter(Boolean);

  // 筆畫／出處／字義：型別不符就補空字串，長度以 chars 為準。
  const strArray = (v, fallback = '') =>
    (Array.isArray(v) ? v : []).map((x) => (typeof x === 'string' ? x : fallback));

  const strokes = n.chars.map((c, i) => {
    const v = Array.isArray(n.strokes) ? n.strokes[i] : n.strokes;
    return typeof v === 'number' && Number.isFinite(v) ? v : (CHAR_BY_CODE.get(c)?.s ?? 0);
  });

  return {
    name: n.name,
    chars: n.chars,
    wx,
    pinyin: typeof n.pinyin === 'string' ? n.pinyin : n.chars.map((c) => CHAR_BY_CODE.get(c)?.p || '').join(' '),
    strokes,
    // 用 || 不用 ??：strArray 對型別不符的值會回傳空字串，
    // 而空字串是「舊資料缺這個欄位」，應該回填字庫裡的真實出處，
    // 不是把空白顯示給使用者。
    cites: n.chars.map((c, i) => strArray(n.cites)[i] || CHAR_BY_CODE.get(c)?.cite || ''),
    meanings: n.chars.map((c, i) => strArray(n.meanings)[i] || CHAR_BY_CODE.get(c)?.meaning || ''),
    hexagram: typeof n.hexagram === 'string' ? n.hexagram : '',
    book: typeof n.book === 'string' ? n.book : '',
  };
}

function loadNames() {
  try {
    const parsed = JSON.parse(localStorage.getItem('wubaobao-names') || '[]');
    if (!Array.isArray(parsed)) {
      names = [];
      return;
    }
    names = parsed
      .map(sanitizeName)
      .filter(Boolean)
      // 禁用字與取名忌字都要擋，而且要連 chars 一起檢查——
      // 只查 name 會讓 chars 裡夾帶的忌字漏過。
      .filter((n) => !findBanned(n.name).any.length)
      .filter((n) => !n.chars.some((c) => findBanned(c).any.length))
      .slice(0, 200);
  } catch {
    names = [];
  }
}
function renderBook() {
  $('bookCount').textContent = names.length;
  // 沒有名單時不顯示複製列
  $('bookActions').classList.toggle('hidden', !names.length);
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
    // 單筆複製，給已經心儀某一個名字時用
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'book-copy';
    copy.textContent = '複製';
    copy.ariaLabel = '複製' + n.name;
    copy.onclick = async () => {
      const ok = await copyText(oneNameDetail(n));
      toast(ok ? `已複製 ${n.name} 及其出處` : '這個瀏覽器不允許自動複製，請手動選取');
    };
    row.append(name, meta, copy, del);
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
$('copyNames').onclick = () => copyMode('names');
$('copyDetail').onclick = () => copyMode('detail');
$('copyAll').onclick = () => copyMode('all');
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
function updatePoolNote() {
  const s = sourceStats();
  $('poolNote').textContent =
    `${CHARACTERS.length} 個古本取名用字 · 木 ${s.木.total} 字（火 ${s.火.total} 字） · 七三之序取名`;
}
renderBooks();
renderSourceTitles();
renderHexagram();
renderProgress();
renderSlots();
renderPanel();
updatePoolNote();
loadSurname();
loadNames();
{
  const slot = $('surnameSlot');
  if (slot) slot.textContent = SURNAME;
  const input = $('surnameInput');
  if (input) {
    input.value = SURNAME;
    input.addEventListener('input', () => {
      // 輸入期間不打斷：只在看起來像一個完整漢字時才套用。
      const v = input.value.trim();
      if (surnameValid(v)) setSurname(v);
    });
    input.addEventListener('blur', () => {
      setSurname(input.value.trim() || DEFAULT_SURNAME);
    });
  }
}
renderBook();

if (new URLSearchParams(location.search).has('qa')) {
  window.wubaobaoQA = () => ({
    book,
    target,
    surname: SURNAME,
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