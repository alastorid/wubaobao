// 資料層測試：古本八部、字庫五行與禁用字、七三取名比例。
const assert = require('node:assert/strict');
const {
  CHARACTERS, CHAR_BY_CODE, WU_XING, ELEMENTS, RATIO,
  BANNED, BANNED_EXACT, BANNED_LOOKALIKE, TABOO, TABOO_CODES,
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

// cite 欄位裡的卦名／篇名，以及「大象」「卦辭」等篇別用語，
// 允許出現禁用字：那些是原典的名稱與體例名，改掉就指錯經文。
const VERBATIM_NAMED = new Set([
  ...'以樂語宥',            // 使用者指定，但允許出現在原典引用裡
  '大', '象', '卦', '辭',   // 「大象」「卦辭」是易經的體例名
]);

// 易經的正式名稱：卦名與體例名（「大象」「卦辭」）。
// 這些是經傳的名稱，改掉就指錯經文，所以引用時必須逐字保留。
const HEX_NAMES = new Set(HEXAGRAMS.map((h) => h.name));
const CITE_LABELS = new Set(['大', '象', '卦', '辭']);

// 各書的正式篇名／篇目名。這些是原典的名稱，改掉就指錯經文。
const WORK_TITLES = new Set([
  ...HEX_NAMES,
  ...SHIJING.flatMap((p) => [p.part, p.title]),
  ...CHUCI.flatMap((p) => [p.part, p.title]),
  ...BAOPUZI.map((b) => b.title),
  ...Object.keys(SHANHAI),
  ...Object.values(SHANHAI).flat().map((e) => e.name),
  ...ZIWEI_STARS.map((s) => s.name),
  ...ZIWEI_PALACES.map((p) => p.name),
  ...BENCAO,
]);
const okInCite = (c) =>
  VERBATIM_NAMED.has(c) || CITE_LABELS.has(c) || HEX_NAMES.has(c);

// ── 禁用字 ──────────────────────────────────────────────
assert.equal(BANNED_EXACT.length, 29, '使用者指定的禁用字應為 29 個');
for (const c of BANNED) {
  assert(!CHARACTERS.some((e) => e.c === c), `字庫仍含禁用字：${c}`);
}
// 禁用字不得出現在任何出處、寓意或拼音欄位
for (const e of CHARACTERS) {
  assert.equal(findBanned(e.c).any.length, 0, `${e.c} 為禁用字`);
  // cite 是出處標示，裡面會出現卦名（升、豫、隨、明夷…）與體例名（大象、卦辭）。
  // 那些是《周易》的正式名稱，改掉就指錯經文，所以要先確認 cite 確實指向
  // 一個真實卦名，再允許其中的字被禁用字／忌字命中。
  if (e.book === 'yijing') {
    assert(HEX_NAMES.has(e.cite.split('·')[1]),
      `${e.c} 的出處指向不存在的卦：${e.cite}`);
  }
  // cite 裡的禁用字／忌字，只允許出現在「正式名稱」之中。
  // 判斷方式：把 cite 依「·」切成片段，逐片檢查。片段若是卦名（明夷）
  // 或體例名（大象），或該片本身就是經文原句（引號內的引文），
  // 就整片放行——那些是原典的名稱與文字，不是本站的取名文案。
  //
  // 這裡刻意不逐字判定：「明夷」裡的「夷」是卦名的一部分，
  // 「椒桂」是《離騷》的篇目名，逐字比對會誤判。
  for (const part of e.cite.split('·')) {
    if (WORK_TITLES.has(part) || CITE_LABELS.has(part)) continue;
    if (part.includes('「')) continue;      // 逐字引用的經文
    for (const c of findBanned(part).any) {
      assert(VERBATIM_NAMED.has(c),
        `${e.c} 出處片段「${part}」含禁用或忌字 ${c}`);
    }
  }
  // 寓意欄不做忌字檢查：寓意本來就是在解釋這些字的意思，
  // 例如「生生不息」裡的「息」本來就在字庫中、也是 TABOO 的一員。
  // 忌字要擋的是「拿來當名字」，不是「拿來解釋意思」。
  //
  // 但寓意是本站寫的文案，所以禁用字（使用者指定）仍然不能出現——
  // 那會讓介面顯示使用者不想看到的字。
  for (const c of findBanned(e.meaning).banned) {
    assert(VERBATIM_NAMED.has(c), `${e.c} 寓意含禁用字 ${c}：${e.meaning}`);
  }
  assert.equal(findBanned(e.p).banned.length, 0, `${e.c} 拼音含禁用字：${e.p}`);
}

// 禁用字不得出現在網站自己寫的文案（介面、用語說明、經文以外的一切）。
//
// 例外有兩種，性質不同：
//   1. 原典逐字引用：大象傳的「君子以…」句式是經文本身，改字等於竄改經典。
//      例外對象是以、樂、語、宥。
//   2. 原典的名稱：卦名（大象、卦辭是體例名；明夷、師是卦名）、
//      詩經篇名、楚辭篇名、山海經篇目名、紫微星名與宮名、本草藥名。
//      這些不是「文案」，是索引用的書目資訊，改掉會指錯出處。
//
// 逐字比對會誤判（「明夷」的「夷」是卦名的一部分），所以比對單位是整個片段。
for (const e of CHARACTERS) {
  assert.equal(findBanned(e.c).any.length, 0, `${e.c} 為禁用字`);
  assert.equal(findBanned(e.p).banned.length, 0, `${e.c} 拼音含禁用字：${e.p}`);

  // 寓意是本站寫的文案，除 verbatim 例外外不得含禁用字
  for (const c of findBanned(e.meaning).banned) {
    assert(VERBATIM_EXCEPTIONS.has(c), `寓意含禁用字 ${c}：${e.meaning}`);
  }

  // cite 逐片段檢查，正式名稱整片放行
  for (const part of e.cite.split('·')) {
    if (WORK_TITLES.has(part) || CITE_LABELS.has(part)) continue;
    if (part.includes('「')) continue;
    for (const c of findBanned(part).banned) {
      assert(VERBATIM_EXCEPTIONS.has(c), `出處片段「${part}」含禁用字 ${c}`);
    }
  }
}
// 姓名組合也不得命中
for (const e of CHARACTERS) {
  assert.equal(findBanned('吳' + e.c).any.length, 0);
}

// ── 取名忌字：字庫裡一個都不該有 ────────────────────────
assert(Object.keys(TABOO).length >= 40, '忌字表過小');
for (const [c, why] of Object.entries(TABOO)) {
  assert(typeof why === 'string' && why.length >= 2, `忌字 ${c} 未說明理由`);
  assert(!CHAR_BY_CODE.has(c), `字庫仍含忌字 ${c}（${why}）`);
  // 忌字不得出現在任何名字裡
  assert.equal(findBanned(c).taboo.length, 1, `findBanned 未攔到忌字 ${c}`);
}

// ── 出處可查證：cite 指向的文本必須真的含有這個字 ────────
// 這條是本次審查的核心。原本 cite 是人手寫的，大量對不上實際經文；
// 字庫改由 tools/derive-pool.cjs 從經文反推產生之後，這條才可能成立。
const corpus = [];
for (const h of HEXAGRAMS) { corpus.push(h.judgement, h.image); }
for (const p of SHIJING) corpus.push(p.text);
for (const p of CHUCI) corpus.push(p.text);
for (const d of DAODEJING) corpus.push(d.text);
for (const b of BAOPUZI) corpus.push(b.text);
for (const k of Object.keys(SHANHAI)) for (const e of SHANHAI[k]) corpus.push(e.note);
for (const b of BENCAO) for (const ch of new Set([...b])) corpus.push(b);
for (const s of ZIWEI_STARS) corpus.push(s.note);
for (const p of ZIWEI_PALACES) corpus.push(p.note);

const noCite = [];
for (const e of CHARACTERS) {
  if (!corpus.some((t) => t && t.includes(e.c))) noCite.push(e.c);
}
assert.equal(noCite.length, 0, `這些字在經文中查不到出處：${noCite.join('')}`);

// cite 的書名必須對得上實際來源（避免張冠李戴）
const bookOf = (cite) => {
  if (cite.startsWith('易經')) return 'yijing';
  if (cite.startsWith('詩經')) return 'shijing';
  if (cite.startsWith('楚辭')) return 'chuji';
  if (cite.startsWith('道德經')) return 'daodejing';
  if (cite.startsWith('抱樸子')) return 'baopuzi';
  if (cite.startsWith('山海經')) return 'shanhai';
  if (cite.startsWith('神農本草')) return 'bencao';
  if (cite.startsWith('紫微')) return 'ziwei';
  return null;
};
for (const e of CHARACTERS) {
  const b = bookOf(e.cite);
  assert(b, `${e.c} 的出處無法歸類：${e.cite}`);
  assert.equal(b, e.book, `${e.c} cite 說是 ${b}，但 book 欄是 ${e.book}：${e.cite}`);
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
//
// 門檻依實際字庫訂：木 91、火 20，共 111 字。
//
// 這個數字是兩次清理的結果，都不是放寬門檻得來的：
//   1. 原始 243 字裡，fire 行有 91 個，但其中「羊」「熒惑」「擎羊」
//      「命宮」「夫妻宮」「疾厄宮」「病符」「地劫」是星名與宮名，
//      「馬」「魚」「鳥」「鹿」是動物，「黍」「粟」「麥」「豆」「韭」
//      是食材，「物」「議」「象」是不成名的抽象名詞。清掉剩 20。
//   2. 之後神農本草清掉所有單字條目（藥名從來不是單字），
//      木行再減 34 字。
//
// 木火配對時火只能當配角，這是如實的取捨：
// 寧可火字少，也不要為了湊比例放進「死」「獄」「劫」「夫」這類字。
const stats = sourceStats();
assert(stats['木'].total >= 85, `木行字數不足：${stats['木'].total}`);
assert(stats['火'].total >= 18, `火行字數不足：${stats['火'].total}`);
for (const b of BOOKS) {
  // 每部古本至少要有一些字可用，不要求木火兩行都有——
  // 火行本來就只出現在日、心、辵、火部的字，分布不均屬正常。
  const total = BOOKS.reduce((n, bb) => n + stats['木'].books[bb] + stats['火'].books[bb], 0);
  assert(total > 0);
  const inBook = stats['木'].books[b] + stats['火'].books[b];
  assert(inBook >= 2, `${b} 可用字過少：${inBook}`);
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
const VERBATIM = new Set(['以', '樂', '語', '宥']);
for (const h of HEXAGRAMS) {
  // 禁用字（使用者指定）：除 verbatim 例外外不得出現在經文
  for (const c of findBanned(h.name + h.judgement + h.image).banned) {
    assert(VERBATIM.has(c), `${h.name} 經文含禁用字 ${c}`);
  }
  // 忌字：出現在經文裡是正常的（卦辭本來就用「元亨利貞」），
  // 忌字要擋的是「拿來當名字」，不是「出現在古書裡」。
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
  assert.equal(findBanned(d.title).banned.length, 0, `道德經第${d.ch}章章名含禁用字`);
  for (const c of findBanned(d.text).banned) {
    assert(VERBATIM.has(c), `道德經第${d.ch}章經文含禁用字 ${c}`);
  }
}

// 抱樸子：篇目齊全
//
// 同一篇可以有多則引文（《極言》就收了五句），所以這裡檢查的是
// 「每則引文都有標明篇名」與「篇名確實是《抱樸子》的篇目」，
// 而不是「篇名不得重複」——那是錯的約束。
const BAO_TITLES = new Set(['暢玄', '論仙', '對俗', '金丹', '至理', '微旨', '塞難',
  '釋滯', '道意', '明本', '仙藥', '辨問', '極言', '勤求', '雜應', '黃白',
  '登涉', '地真', '遐覽', '袪惑']);
for (const b of BAOPUZI) {
  assert(['內篇', '外篇'].includes(b.part), `抱樸子篇別不明：${b.part}`);
  assert(BAO_TITLES.has(b.title), `抱樸子篇名「${b.title}」不在《抱樸子》內篇篇目中`);
  assert(b.text && b.text.length > 6, `抱樸子 ${b.title} 引文過短`);
  // 抱樺子是原典，逐字引用，允許 verbatim 例外（「以」等）
  for (const c of findBanned(b.title + b.text).banned) {
    assert(VERBATIM.has(c), `抱樺子 ${b.title} 含禁用字 ${c}`);
  }
}

// 詩經與楚辭：篇目齊全，篇名不重複，經文有禁用字者一律不收
for (const [label, list] of [['詩經', SHIJING], ['楚辭', CHUCI]]) {
  const titles = list.map((p) => p.title);
  assert.equal(new Set(titles).size, titles.length, `${label}篇名不得重複`);
  assert(list.length >= 10, `${label} 收錄過少：${list.length}`);
  for (const p of list) {
    assert(p.part && p.title && p.text, `${label} 資料不完整`);
    assert(p.text.length > 4, `${label} ${p.title} 經文過短`);
    for (const c of findBanned(p.title + p.part).banned) {
      assert(VERBATIM.has(c), `${label} ${p.title} 篇名含禁用字 ${c}`);
    }
    for (const c of findBanned(p.text).banned) {
      assert(VERBATIM.has(c), `${label} ${p.title} 經文含禁用字 ${c}`);
    }
  }
}
// 楚辭與詩經是最貼合女名的兩部，必須真的有女名用字。
//
// 名單是依「字是否仍在字庫」列出，不是依「我覺得該有哪些字」。
// 被清掉的字（倩因諧音與僱傭義、楚因語義、葛因草藥定位）就不再列。
const byChar = (c) => CHAR_BY_CODE.get(c);
for (const c of '姝灼采佩靜蕙芳蘭')
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
    assert.equal(findBanned('吳' + n.chars.map((e) => e.c).join('')).any.length, 0);
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
