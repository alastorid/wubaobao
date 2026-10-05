// 資料層測試：古本八部、字庫五行與禁用字、七三取名比例。
const assert = require('node:assert/strict');
const {
  CHARACTERS, WU_XING, ELEMENTS, RATIO, BANNED, BANNED_EXACT, BANNED_LOOKALIKE,
  pickChar, pickGivenName, rollElement, sourceStats, findBanned,
} = require('../js/namepool.js');
// 古本經文由 tests/namepool.cjs 以動態 import 載入後放在 global.__CLASSICS
const {
  HEXAGRAMS, HEXAGRAM_BY_LINES, ZIWEI_STARS, ZIWEI_PALACES, SHANHAI, BENCAO,
  DAODEJING, BAOPUZI, SHIJING, CHUCI, SOURCES,
} = global.__CLASSICS;

// 古本清單由 SOURCES 推導，日後增刪古本不必再改測試
const BOOKS = SOURCES.map((s) => s.id);

// ── 五行：喜用神只有木、火 ──────────────────────────────
assert.deepEqual(ELEMENTS, ['木', '火'], '喜用神只允許木、火');
assert.equal(RATIO.木 + RATIO.火, 1);
assert(RATIO.木 > RATIO.火, '木為喜用，比例須高於火');
assert.equal(WU_XING.木.role, '喜用 · 首選');
assert.equal(WU_XING.火.role, '次用 · 輔助');

for (const e of CHARACTERS) {
  assert(['木', '火'].includes(e.w), `${e.c} 只能屬木或火，實為 ${e.w}`);
}

// ── 禁用字 ──────────────────────────────────────────────
assert.equal(BANNED_EXACT.length, 29, '使用者指定的禁用字應為 29 個');
for (const c of BANNED) {
  assert(!CHARACTERS.some((e) => e.c === c), `字庫仍含禁用字：${c}`);
}
// 禁用字不得出現在任何出處、寓意或拼音欄位
for (const e of CHARACTERS) {
  assert.equal(findBanned(e.c).length, 0, `${e.c} 為禁用字`);
  assert.equal(findBanned(e.cite).length, 0, `${e.c} 出處含禁用字：${e.cite}`);
  assert.equal(findBanned(e.meaning).length, 0, `${e.c} 寓意含禁用字`);
  assert.equal(findBanned(e.p).length, 0, `${e.c} 拼音含禁用字：${e.p}`);
}

// 禁用字不得出現在網站自己寫的文案（介面、用語說明、經文以外的一切）
// 例外只針對「原典逐字引用」：大象傳的「君子以…」句式是經文本身，
// 改字等於竄改經典，所以這幾個字在卦辭／大象裡保留原文。
const VERBATIM_EXCEPTIONS = new Set(['以', '樂', '語', '宥']);
for (const e of CHARACTERS) {
  for (const v of [e.c, e.p, e.cite, e.meaning]) {
    for (const c of findBanned(v)) {
      assert(VERBATIM_EXCEPTIONS.has(c), `文案含禁用字 ${c}：${v}`);
    }
  }
}
// 姓名組合也不得命中
for (const e of CHARACTERS) {
  assert.equal(findBanned('吳' + e.c).length, 0);
}

// ── 欄位完整性 ──────────────────────────────────────────
const codes = CHARACTERS.map((e) => e.c);
assert.equal(new Set(codes).size, codes.length, '字庫不得重複');
for (const e of CHARACTERS) {
  assert([...e.c].length === 1, `${e.c} 須為單字`);
  assert(e.p && typeof e.p === 'string' && e.p.length > 0, `${e.c} 缺拼音`);
  assert(Number.isInteger(e.s) && e.s > 0 && e.s <= 24, `${e.c} 筆畫異常：${e.s}`);
  assert(e.cite && typeof e.cite === 'string', `${e.c} 缺出處`);
  assert(e.meaning && typeof e.meaning === 'string', `${e.c} 缺寓意`);
  assert(BOOKS.includes(e.book), `${e.c} 出處古本不明：${e.book}`);
}

// ── 每一部古本都有字，木火兩行都抽得到 ──────────────────
const stats = sourceStats();
for (const w of ELEMENTS) {
  assert(stats[w].total >= 40, `${w} 行字數不足：${stats[w].total}`);
  for (const b of BOOKS) {
    assert(stats[w].books[b] > 0, `${w} 行在 ${b} 沒有字`);
  }
}
assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length, '古本 id 不得重複');
assert.equal(new Set(SOURCES.map((s) => s.seal)).size, SOURCES.length, '古本印文不得重複');
for (const s of SOURCES) {
  assert(s.name.startsWith('古本'), `${s.name} 應以「古本」開頭`);
  assert(s.blurb && s.blurb.length > 10, `${s.name} 缺介紹`);
}

// ── 古本易經：六十四卦不重複、爻象自洽 ──────────────────
assert.equal(HEXAGRAMS.length, 64);
const names = HEXAGRAMS.map((h) => h.name);
assert.equal(new Set(names).size, 64, '卦名不得重複');
const indices = HEXAGRAMS.map((h) => h.index).sort((a, b) => a - b);
assert.deepEqual(indices, Array.from({ length: 64 }, (_, i) => i + 1), '卦序應為 1..64');
for (const h of HEXAGRAMS) {
  assert.equal(h.lines.length, 6);
  assert(h.judgement && h.image, `${h.name} 缺卦辭或大象`);
  const bits = h.lines.map((y) => (y ? '1' : '0')).join('');
  assert.equal(HEXAGRAM_BY_LINES.get(bits)?.name, h.name, `${h.name} 爻象查回不一致`);
}
assert.equal(HEXAGRAM_BY_LINES.get('111111').name, '乾');
assert.equal(HEXAGRAM_BY_LINES.get('000000').name, '坤');
assert.equal(HEXAGRAM_BY_LINES.get('100010').name, '屯');
assert.equal(HEXAGRAM_BY_LINES.get('101010').name, '既濟');
assert.equal(HEXAGRAM_BY_LINES.get('010101').name, '未濟');
assert.equal(HEXAGRAM_BY_LINES.size, 64, '六十四卦爻象必須互異');
// 禁用字：原典逐字引用者（以／樂／語／宥）保留原文，其餘一律不得出現
const VERBATIM = VERBATIM_EXCEPTIONS;
for (const h of HEXAGRAMS) {
  for (const c of findBanned(h.name + h.judgement + h.image)) {
    assert(VERBATIM.has(c), `${h.name} 經文含禁用字 ${c}`);
  }
}

// ── 紫微斗數 ────────────────────────────────────────────
assert.equal(ZIWEI_STARS.length, 14, '紫微斗數十四主星');
assert.equal(new Set(ZIWEI_STARS.map((s) => s.name)).size, 14);
assert.equal(ZIWEI_PALACES.length, 12, '紫微斗數十二宮');
assert.equal(new Set(ZIWEI_PALACES.map((s) => s.name)).size, 12);

// ── 山海經 / 本草 / 道德經 / 抱樸子 ─────────────────────
assert(SHANHAI.山.length > 0 && SHANHAI.海.length > 0 && SHANHAI.草木.length > 0);
assert(BENCAO.length > 0);

// 道德經：章號合法、不重複、經文齊全，且都在 1..81 之內
const chapters = DAODEJING.map((d) => d.ch);
assert.equal(new Set(chapters).size, chapters.length, '道德經章號不得重複');
for (const d of DAODEJING) {
  assert(d.ch >= 1 && d.ch <= 81, `道德經第${d.ch}章超出範圍`);
  assert(d.title && d.text, `道德經第${d.ch}章缺章名或經文`);
  assert.equal(findBanned(d.title).length, 0, `道德經第${d.ch}章章名含禁用字`);
  for (const c of findBanned(d.text)) {
    assert(VERBATIM.has(c), `道德經第${d.ch}章經文含禁用字 ${c}`);
  }
}

// 抱樸子：篇目齊全
const baoTitles = BAOPUZI.map((b) => b.title);
assert.equal(new Set(baoTitles).size, baoTitles.length, '抱樸子篇名不得重複');
for (const b of BAOPUZI) {
  assert(['內篇', '外篇'].includes(b.part), `抱樸子篇別不明：${b.part}`);
  assert(b.text && b.text.length > 4, `抱樸子 ${b.title} 缺篇旨`);
  assert.equal(findBanned(b.title + b.text).length, 0, `抱樸子 ${b.title} 含禁用字`);
}

// 詩經與楚辭：篇目齊全，篇名不重複，經文有禁用字者一律不收
for (const [label, list] of [['詩經', SHIJING], ['楚辭', CHUCI]]) {
  const titles = list.map((p) => p.title);
  assert.equal(new Set(titles).size, titles.length, `${label}篇名不得重複`);
  assert(list.length >= 10, `${label} 收錄過少：${list.length}`);
  for (const p of list) {
    assert(p.part && p.title && p.text, `${label} 資料不完整`);
    assert(p.text.length > 4, `${label} ${p.title} 經文過短`);
    for (const c of findBanned(p.title + p.part)) {
      assert(VERBATIM.has(c), `${label} ${p.title} 篇名含禁用字 ${c}`);
    }
    for (const c of findBanned(p.text)) {
      assert(VERBATIM.has(c), `${label} ${p.title} 經文含禁用字 ${c}`);
    }
  }
}
// 楚辭與詩經是最貼合女名的兩部，必須真的有女名用字
const byChar = (c) => CHARACTERS.find((e) => e.c === c);
for (const c of '姝倩灼采佩靜楚葛蕙芳蘭')
  assert(byChar(c), `${c} 應在字庫（詩經／楚辭用字）`);
assert(
  CHARACTERS.some((e) => e.book === 'chuji' && e.w === '火'),
  '楚辭應有火行用字',
);

// ── 取名：指定喜用神時，每字都必須是該行 ──────────────
for (const want of ELEMENTS) {
  for (const book of BOOKS) {
    const n = pickGivenName({ want, count: 2, book });
    assert.equal(n.chars.length, 2, `${want}/${book} 抽不出兩個字`);
    assert(n.chars.every((e) => e.w === want), `${want}/${book} 抽到別行`);
    assert.equal(new Set(n.chars.map((e) => e.c)).size, 2, `${want}/${book} 出現重字`);
  }
  // 筆畫不可能時仍要給得出名字
  const impossible = pickGivenName({ want, count: 2, minStrokes: 99, maxStrokes: 0 });
  assert.equal(impossible.chars.length, 2);
  assert(impossible.chars.every((e) => e.w === want));
}

// ── 取名：不指定時每字各自按木七火三，且單字不出重複 ────
for (const count of [1, 2]) {
  for (let i = 0; i < 4000; i++) {
    const n = pickGivenName({ count });
    assert.equal(n.chars.length, count);
    assert.equal(new Set(n.chars.map((e) => e.c)).size, count, '名字內不得重字');
    assert(n.chars.every((e) => ['木', '火'].includes(e.w)));
    assert.equal(findBanned('吳' + n.chars.map((e) => e.c).join('')).length, 0);
  }
}

// ── 七三之序：抽 6000 次單字，木應明顯多於火 ────────────
let mu = 0;
const TRIALS = 6000;
for (let i = 0; i < TRIALS; i++) if (rollElement(null) === '木') mu++;
const ratio = mu / TRIALS;
assert(Math.abs(ratio - RATIO.木) < 0.035, `木的比例應接近 0.70，實測 ${ratio.toFixed(3)}`);

// ── 單字抽樣也遵守七三 ─────────────────────────────────
let mu2 = 0;
for (let i = 0; i < TRIALS; i++) if (pickChar({}).w === '木') mu2++;
assert(Math.abs(mu2 / TRIALS - RATIO.木) < 0.04, `pickChar 木比例應接近 0.70，實測 ${(mu2 / TRIALS).toFixed(3)}`);

// ── 已收之字優先，但不得跨越指定的喜用神 ────────────────
const woodChar = CHARACTERS.find((e) => e.w === '木');
const fireChar = CHARACTERS.find((e) => e.w === '火');
assert.equal(pickGivenName({ count: 1, preferred: [woodChar] }).chars[0].c, woodChar.c);
assert.equal(pickGivenName({ want: '火', count: 2, preferred: [woodChar] }).chars.length, 2);
assert(pickGivenName({ want: '火', count: 2, preferred: [woodChar] }).chars.every((e) => e.w === '火'));
assert(pickGivenName({ want: '火', count: 2, preferred: [fireChar] }).chars[0].c === fireChar.c);

console.log(
  JSON.stringify({
    total: CHARACTERS.length,
    duplicates: 0,
    elements: Object.fromEntries(ELEMENTS.map((w) => [w, stats[w].total])),
    perBook: Object.fromEntries(BOOKS.map((b) => [b, CHARACTERS.filter((e) => e.book === b).length])),
    banned: BANNED.size,
    woodRatio: Number(ratio.toFixed(3)),
    nameCases: 20000,
  }),
);
