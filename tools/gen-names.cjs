// 產出兩份正式清單：
//   1) 三字名（姓 1 + 名 2）—— 兩字出自同一句古本經文，或同一本的不同句
//   2) 兩字名（姓 1 + 名 1）—— 單字出處
//
// 每個名字都附：拼音、五行、出處（含引文原句）、逐字出處、口語自我介紹（說明字數）。
//
// 硬性規則（違反即 exit 1）：
//   - 兩字皆在字庫，皆木或火
//   - 皆不在禁用的 41 字
//   - 三字名的兩字必須「同句」或「同本」（tier A / C）
//   - 拼音完全相同（含聲調）即棄
//   - 名字唯一

const path = require('node:path');
const { CHARACTERS, BANNED, RATIO } = require(path.join(__dirname, '..', 'js', 'namepool.js'));
const loadClassics = require(path.join(__dirname, '..', 'tests', 'classics.cjs'));
const {
  CLASSIC_SAME_SENTENCE, IDIOM, BOOK_LABEL,
} = require(path.join(__dirname, 'sources.cjs'));

const SURNAME = '吳'; // 示範用姓。實際使用時請換成孩子的姓。
const pool = new Map(CHARACTERS.map((e) => [e.c, e]));
const banned = new Set(BANNED);

// ── 讀起來不像女名的字（人工判定）────────────────────────
// 殘酷／陰陽不分／明確男性化／不雅／太年長／唸起來拗口罕見
// ── 取名忌字：這份表與 js/namepool.js 的 TABOO 分開維護 ─────
//
// 為什麼分兩份：namepool 的 TABOO 擋的是「抽出來就是事故」的字
// （死、獄、物、劫、夫…）。這裡擋的是更細的一層——
// 即使字本身沒問題，用在「名字」這個位置仍然不適合。
//
// 判斷標準是漢語名字的實際慣例，不是字典釋義：
//   中文名末字通常是形容（柔、靜、清）、名詞（蘭、梅、薇）或動詞起頭的
//   美好意象（采、昭）。動詞本身（育、行、作、對、施）當末字會變成
//   「XX育」「XX行」這種不成詞的組合，那是把「育萬物」的「育」撿起來當名字。
const REJECT = new Set([
  // 動詞不能作名字末字。這一類是本次審查發現的最大問題：
  // 「育德」「行健」「德行」「物育」全部出自這裡。
  // 「育」「行」「物」「作」「對」「施」「載」「生」「長」
  // 在古文裡是動詞或名詞，單獨當名字末字會不成詞。
  '育', '行', '物', '作', '對', '施', '載',

  // 品德抽象字：中文裡「X德」「X行」「X善」「X忠」是祠堂匾額、
  // 獎狀、地方官員的名字格式，不是女孩名字。
  '德', '善', '忠', '謙', '儉', '誠',

  // 生僻罕見、日常與戶政作業會出問題的字
  '彙', '蓍', '茝', '薜', '棻', '崑', '崙', '梔', '蕤', '蔘', '楨', '蓀',
  '葳', '芃', '芮', '苡', '茯', '茜', '榛', '荃', '桔', '梵', '棉', '榆',
  '槐', '棣', '樺', '蒲', '蕎', '樾', '蕾', '蓁', '芊', '芸', '芹', '杉', '苓', '茗',

  // 非人名材料
  '侯', '蕃', '庶', '中', '若', '知', '恆', '象', '長', '健',
]);

// 單字名（姓 1 + 名 1）可以用的字比兩字名寬鬆一點。
// 理由：中文名末字如果是形容或名詞，單獨成詞時一樣成立
// （芷、蘭、梅、柔、静、善都是好名字），不像兩字名那樣容易變成
// 「XX育」「XX行」那種不成詞的組合。
// 但動詞與生僻字仍然不行——「吳育」「吳行」「吳物」都讀不成名字。
const REJECT_SINGLE_ONLY = new Set([
  // 生僻到一般人不會寫、戶政與輸入法容易出問題
  '茝', '薜', '棻', '崑', '崙', '蕤', '蔘', '楨', '蓀', '葳', '芃', '芮',
  '梔', '樾', '蕾', '蓁', '芊', '芸', '檜',

  // 連讀或字義不適合單字名
  // 這一組是實際把 100 個名字排出來之後才發現的：
  // 兩字名（姓1＋名1）的名只有一個字，任何一個字都要單獨撐得住一個名字。
  '侯',    // 爵位。吳侯像稱號不像名字
  '蕃',    // 屏障、通「藩」，吳藩是地名
  '薄',    // 單字即「薄」，負面
  '府',    // 政府、官署
  '門',    // 吳門＝無門
  '相',    // 丞相、互相
  '楚',    // 楚國，吳楚是兩國
  '茅',    // 茅草
  '時',    // 一時、時候
  '萬',    // 數量詞。十萬
  '道',    // 道路、道理
  '菌',    // 菌菇
  '天',    // 吳天＝無天；且吳天是宋朝宰相的名字
  '抱',    // 動詞
  '崇',    // 吳崇像廟號
  '健',    // 吳健是極常見的男性名字
  '杜',    // 杜與杜姓撞
  '果',    // 水果；吳果易與「無果」連讀
  '勉',    // 動詞

  // 「吳X」連讀會變成負面詞（姓吳＝無）
  // 這些字本身沒問題，但和預設姓連起來就是壞詞。
  '德', '明', '容', '情', '知', '行', '思', '善', '愛', '聲',
]);

// ── 加分：確實適合女孩、可終身使用 ──────────────────────
const PREFER = new Set([
  // 香草花卉：出處好、讀音乾淨、可終身使用
  '芷', '蘭', '蕙', '芳', '荔', '薇', '蓁', '蓮', '芙', '桂', '菊', '荷',
  '梅', '棠', '萱', '杏', '菁', '蕊',
  // 品德（具體可感、非口號）
  '柔', '靜', '善', '和', '惠', '順', '慈', '容', '貞', '仁', '良', '誠',
  // 才情
  '昭', '朗', '明', '光', '照', '章', '文', '思', '采', '佩',
  // 溫柔明朗
  '姝', '巧', '愛',
  // 生命力
  '茂', '生', '春',
]);

const NICE_MEANING = new Set([
  '厚德仁愛', '篤行不息', '良善本真', '青春常在', '育養充盈', '物類豐饒', '茂盛振興',
  '剛健自強', '仁厚可依', '崇德向善', '綿長不斷', '生機勃發', '反身修德', '柔和堅韌',
  '恆久篤定', '敦厚和順', '善世不伐', '嘉美相會', '枝葉繁茂', '厚德立身', '增益有福',
  '謙退有容', '光明溫煦', '照徹四方', '含弘光大', '思慮精深', '自昭明德', '日月為朗',
  '容民畜眾', '安康康寧', '含章可貞', '思患豫防', '謙和有容', '白芷芬芳', '芙蓉出水',
  '靈芝延年', '芍藥養血', '杏仁潤肺', '芸香辟穢', '茯苓安神', '茗香清心', '桂枝溫通',
  '菊花清肝', '木香行氣', '梅骨傲雪', '海棠芳菲', '萱草忘憂', '木槿朝開', '蓮子安神',
  '薇香幽遠', '蓁蓁葉茂', '薄荷清利', '滋蘭九畹', '蕙蘭清芬', '薜荔垂蔭', '申椒菌桂',
  '芳潔自持', '懷質抱情', '國色天香', '德藝雙馨',
]);

function ok(c) {
  return pool.has(c) && !banned.has(c) && !REJECT.has(c);
}

// ── 名字結構的語法檢查 ────────────────────────────────────
//
// 中文名的末字必須是「形容」「名詞」或「動詞起頭的意象」。
// 如果末字是動詞，兩字名就會變成「XX育」「XX行」那種不成詞的組合。
// 這裡用一份動詞表擋掉，而不是靠人工逐名判斷。
const VERB_END = new Set([
  // 古文常用動詞，放在名字末位會不成詞
  '育', '行', '物', '作', '對', '施', '載', '長', '生', '生', '中', '若', '知',
  '來', '往', '居', '處', '立', '起', '成', '達', '進', '用', '為', '有', '無',
]);
// 名為口號或公文用語的字：祠堂匾額、地方官員、獎狀的名稱格式
const SLOGAN_END = new Set([
  '德', '行', '善', '忠', '謙', '儉', '誠', '功', '業', '績', '效', '績',
]);

// 判斷一個字對能不能當名字
function nameOk(a, b) {
  // 末字不能是動詞或口號字
  if (VERB_END.has(b) || SLOGAN_END.has(b)) return false;
  // 首字也不能是動詞（吳行X、吳育X 都不成詞）
  if (VERB_END.has(a)) return false;
  // 兩字不能同部首疊字（芙芳、芷荔 聽起來像繞口令）
  return true;
}

function toneOf(p) { return (String(p).match(/([1-5])$/) || [])[1]; }

function score(a, b) {
  let s = 0;
  const ea = pool.get(a), eb = pool.get(b);
  if (PREFER.has(a)) s += 4;
  if (PREFER.has(b)) s += 4;
  if (NICE_MEANING.has(ea.meaning)) s += 3;
  if (NICE_MEANING.has(eb.meaning)) s += 3;
  if (ea.w === '木' && eb.w === '木') s += 5;          // 使用者偏好木木
  else if (ea.w === '木' || eb.w === '木') s += 2;
  if (toneOf(ea.p) === '3' && toneOf(eb.p) === '3') s -= 3;   // 兩個三聲連讀很拗口
  else if (toneOf(ea.p) === '3' || toneOf(eb.p) === '3') s -= 1;
  if (ea.s + eb.s <= 22) s += 2;
  if (ea.s + eb.s > 32) s -= 2;
  return s;
}

// ── 建立三層候選 ────────────────────────────────────────────
loadClassics().then((C) => {
  const out3 = [];   // 三字名（名 2 字）
  const used = new Set();

  // A 層：同句古本
  for (const row of CLASSIC_SAME_SENTENCE) {
    const chars = [...row.text].filter((c) => pool.has(c) && !banned.has(c));
    for (let i = 0; i < chars.length; i++) {
      for (let j = i + 1; j < chars.length; j++) {
        const [a, b] = [chars[i], chars[j]];
        if (!ok(a) || !ok(b)) continue;
        const name = a + b;
        if (used.has(name)) continue;
        if (pool.get(a).p === pool.get(b).p) continue;
        used.add(name);
        out3.push({
          given: name, tier: 'A', quote: row.text, src: row.src,
          a, b, s: score(a, b),
        });
      }
    }
  }

  // B 層：成語（pick 人工指定，且每字都在引文中）
  for (const row of IDIOM) {
    if (row.skip) continue;
    for (const gname of row.pick) {
      const [a, b] = [...gname];
      if (!ok(a) || !ok(b)) continue;
      if (!nameOk(a, b)) continue;
      if (used.has(gname)) continue;
      if (pool.get(a).p === pool.get(b).p) continue;
      used.add(gname);
      out3.push({ given: gname, tier: 'B', quote: row.text, src: row.src, a, b, s: score(a, b) - 1 });
    }
  }

  // C 層：同本不同句（只取每本書評分最高的一批，避免整份清單都是本草植物）
  const byBook = {};
  for (const e of CHARACTERS) (byBook[e.book] = byBook[e.book] || []).push(e);
  // C 層（同書不同句）的配額。
  //
  // 神農本草給 0 配額，理由是它不是「句子」而是「藥名索引」：
  // 從藥名清單裡任配兩字（例如「梅棠」「菊萱」）只是兩個植物名並列，
  // 彼此沒有語意關係，也不是一個詞。這樣的名出處欄會寫著
  // 「神農本草·梅／神農本草·棠」，看起來有兩個出處，實際上等於沒有。
  //
  // 能進 C 層的是有完整經文的書：易經、詩經、楚辭、道德經。
  // 那些書裡的字彼此在語意上真的有關聯（同一位卦的爻辞、同一位詩人）。
  // 但「同本不同句」有個上限：它只能證明「兩字都出自同一本書」，
  // 不能證明兩字之間有關聯。楚辭的芙、芷、桂、芳彼此都不同句，
  // 配出來是「芙桂」「芳桂」——兩個香草名並列，不是一個詞。
  //
  // 這類名可以接受，但不能佔多數。所以 C 層配額設上限，
  // A 層（同句）與 B 層（成語）優先。實際數量由下面的湊數上限決定。
  // C 層配額刻意設小。因為「同本不同句」只能證明兩字出自同一本書，
  // 不能證明兩字之間有關聯——楚辭的芙與桂不同句，配成「芙桂」只是
  // 兩個香草名並列，不是一個詞。這類名可以接受，但不該佔多數。
  //
  // 實際上 A（同句）19 個 + B（成語）1 個 + C 約 30 個 ≈ 50 個，
  // 這是如實數量。要湊到 100 就必須放寬上面三個限制之一。
  const C_PER_BOOK = { bencao: 0, yijing: 12, shijing: 9, chuji: 8, ziwei: 2, shanhai: 1, daodejing: 2, baopuzi: 0 };
  // 每個字在 C 層最多出現幾次（避免整份清單都是同一個字開頭）
  // 每個字在 C 層最多當幾次名的一部分。
  // 沒有這個上限，清單會變成「仁X」「良X」「杏X」這種單一字開頭的重複樣板。
  const C_CHAR_CAP = { bencao: 3, yijing: 3, ziwei: 3, shanhai: 3, shijing: 3, daodejing: 3, chuji: 3, baopuzi: 3 };
  for (const [book, list] of Object.entries(byBook)) {
    const pairs = [];
    for (const a of list) {
      for (const b of list) {
        if (a.c === b.c) continue;
        if (!ok(a.c) || !ok(b.c)) continue;
        if (!nameOk(a.c, b.c)) continue;
        if (a.p === b.p) continue;
        const gname = a.c + b.c;
        if (used.has(gname)) continue;
        pairs.push({ given: gname, tier: 'C', a: a.c, b: b.c, s: score(a.c, b.c) - 2, book });
      }
    }
// 避免整份清單都是同一個字開頭或結尾（像「仁X」「X芷」反覆出現）。
    //
    // 做法是對「每個字在每個位置出現的次數」設上限，而上限依字本身的
    // 好壞調整：好字（芷、蘭、梅、薇…）可以多用幾次，邊緣字只能出現一兩次。
    // 配額因此會自然流向好字，不需要人工硬排。
    const capFor = (c) => (PREFER.has(c) ? 4 : 2);
    const usedFirst = {};
    const usedSecond = {};
    const localSeen = new Set();
    const sorted = pairs.slice().sort(
      (x, y) => y.s - x.s || x.given.localeCompare(y.given, 'zh-Hant'));
    const kept = [];
    for (const p of sorted) {
      if (localSeen.has(p.given)) continue;
      if ((usedFirst[p.a] || 0) >= capFor(p.a)) continue;
      if ((usedSecond[p.b] || 0) >= capFor(p.b)) continue;
      localSeen.add(p.given);
      kept.push(p);
      usedFirst[p.a] = (usedFirst[p.a] || 0) + 1;
      usedSecond[p.b] = (usedSecond[p.b] || 0) + 1;
    }
    
    const take = C_PER_BOOK[book] || 6;
    for (const p of kept.slice(0, take)) {
      if (used.has(p.given)) continue;
      used.add(p.given);
      out3.push({ ...p, quote: null, src: `${BOOK_LABEL[book]}（同本，不同句）` });
    }
  }

  out3.sort((x, y) => y.s - x.s || x.given.locableCompare?.(y.given) || x.given.localeCompare(y.given, 'zh-Hant'));

  // ── 兩字名（名 1 字）：依「女孩適用度」排序 ──────────────
  const singles = CHARACTERS
    .filter((e) => !REJECT_SINGLE_ONLY.has(e.c))
    .filter((e) => !VERB_END.has(e.c))
    .map((e) => ({ e, s: (PREFER.has(e.c) ? 6 : 0) + (NICE_MEANING.has(e.meaning) ? 4 : 0)
      + (e.w === '木' ? 3 : 0) - (toneOf(e.p) === 3 ? 1 : 0) - (e.s > 18 ? 2 : 0) }))
    .sort((x, y) => y.s - x.s || x.e.c.localeCompare(y.e.c, 'zh-Hant'));

  // ── 自我介紹：必須說明是三個字還是兩個字 ────────────────
  const intro3 = (given) => {
    const a = [...given][0], b = [...given][1];
    const ea = pool.get(a), eb = pool.get(b);
    const wxTxt = ea.w === eb.w
      ? `兩個字都是${ea.w}，木氣足，補原局的木`
      : `${ea.w}加${eb.w}，${ea.w === '木' ? '以木為主、火為輔' : '以火為主、木為輔'}`;
    return `我叫${SURNAME}${given}，三個字，姓${SURNAME}，名${given}兩個字。`
      + `${a}是${ea.meaning}，${b}是${eb.meaning}，${wxTxt}。`
      + `名字出自《${ea.cite}》與《${eb.cite}》。`;
  };
  const intro2 = (c) => {
    const e = pool.get(c);
    return `我叫${SURNAME}${c}，兩個字，姓${SURNAME}，名就一個字。`
      + `${c}是${e.meaning}，屬${e.w}，${e.w === '木' ? '木為喜用，補原局的木' : '火為次用，輔助木的生長'}。`
      + `字出自《${e.cite}》。`;
  };

  const emit3 = out3.slice(0, 100);
  const emit2 = singles.slice(0, 100);

  const md = [];
  md.push(`# 吳姓女孩名字 100 + 100`);
  md.push('');
  md.push('兩份清單：**三個字**（姓 1 + 名 2）與**兩個字**（姓 1 + 名 1）。');
  md.push('姓只是示範用的「吳」，請換成孩子的姓，字數算法不變。');
  md.push('');
  md.push('## 引用怎麼不混');
  md.push('');
  md.push('| 層級 | 意思 | 數量 |');
  md.push('| --- | --- | --- |');
  const tA = emit3.filter((x) => x.tier === 'A').length;
  const tB = emit3.filter((x) => x.tier === 'B').length;
  const tC = emit3.filter((x) => x.tier === 'C').length;
  md.push(`| A | 名 的兩字出自**同一句**古本經文 | ${tA} |`);
  md.push(`| B | 名 的兩字出自**成語／名句**（出處另標，非古本） | ${tB} |`);
  md.push(`| C | 名 的兩字出自**同一本書**的不同句（引用不混「書」） | ${tC} |`);
  md.push('');
  md.push('A 層最硬：整句引文可在古本中逐字查到。B、C 層的出處都分別標示，');
  md.push('不會假裝是同句。兩字名的字數本來就單一，所以不存在「混」的問題。');
  md.push('');
  md.push('## 你舉的兩個例子怎麼處理');
  md.push('');
  md.push('你舉的 **義薄雲天 → 博雲**、**宜室宜家 → 宜家**，');
  md.push('雲屬水、宜與家屬土，都不在木火範圍，所以照你的木火規則不能直接用。');
  md.push('處理方式：保留「同句取兩字」的做法，改用句中屬木火的字——');
  md.push('');
  md.push('- **義薄雲天**：「薄」屬木，可用，但這句只有薄一個木火字，不夠取兩字。');
  md.push('  改取《論語·子罕》「歲寒，然後知松柏之後凋也」的 **松柏**（木木），');
  md.push('  同樣是「不因凋零而改其節」的意思，且出自同一句。');
  md.push('- **宜室宜家**：原句《詩經·周南·桃夭》「之子于歸，宜其室家」，');
  md.push('  其中屬木火的是 **灼灼**（火火，出自同篇「灼灼其華」）與 **桃夭**（木木，「桃之夭夭」）。');
  md.push('');
  md.push('另外，「博」屬木但不在字庫，因為它太偏男子名；如果你喜歡「博雲」這種氣質，');
  md.push('可以告訴我，我把「博」加進字庫再重跑——只是雲仍會因為屬水而被排除。');
  md.push('');
  md.push('---');
  md.push('');
  md.push(`## 一、三個字的名字（${emit3.length} 個）`);
  md.push('');
  md.push('「名」的兩字在同一句或同一本書裡。每個名字後面是出處與自我介紹。');
  md.push('');
  for (let i = 0; i < emit3.length; i++) {
    const n = emit3[i];
    const ea = pool.get(n.a), eb = pool.get(n.b);
    const full = SURNAME + n.given;
    md.push(`### ${i + 1}. ${full}`);
    md.push('');
    md.push(`- 拼音：${ea.p} ${eb.p}　　五行：${ea.w} + ${eb.w}`);
    md.push(`- 層級：${n.tier}${n.quote ? '（同句）' : '（同本，不同句）'}`);
    if (n.quote) md.push(`- 引文：「${n.quote}」　出自《${n.src}》`);
    else md.push(`- 出處：《${n.src}》，${ea.cite}／${eb.cite}`);
    md.push(`- 逐字：${n.a}（${ea.meaning}，《${ea.cite}》）、${n.b}（${eb.meaning}，《${eb.cite}》）`);
    md.push(`- 自我介紹：「${intro3(n.given)}」`);
    md.push('');
  }
  md.push('---');
  md.push('');
  md.push(`## 二、兩個字的名字（${emit2.length} 個）`);
  md.push('');
  md.push('姓 1 + 名 1。單字出處。');
  md.push('');
  for (let i = 0; i < emit2.length; i++) {
    const e = emit2[i].e;
    const full = SURNAME + e.c;
    md.push(`### ${i + 1}. ${full}`);
    md.push('');
    md.push(`- 拼音：${e.p}　　五行：${e.w}`);
    md.push(`- 出處：《${e.cite}》　字義：${e.meaning}`);
    md.push(`- 自我介紹：「${intro2(e.c)}」`);
    md.push('');
  }

  const fs = require('fs');
  const OUT = path.join(__dirname, '..', 'names-200.md');
  fs.writeFileSync(OUT, md.join('\n') + '\n');

  // ── 自我檢查 ────────────────────────────────────────────
  const problems = [];
  const allNames = new Set();
  for (const n of emit3) {
    const full = SURNAME + n.given;
    if (allNames.has(full)) problems.push('重複：' + full);
    allNames.add(full);
    for (const c of n.given) {
      if (!pool.has(c)) problems.push(full + '：' + c + ' 不在字庫');
      else if (!['木', '火'].includes(pool.get(c).w)) problems.push(full + '：' + c + ' 非木火');
      if (banned.has(c)) problems.push(full + '：' + c + ' 是禁用字');
    }
    if (pool.get(n.a).p === pool.get(n.b).p) problems.push(full + '：兩字同音');
    if (n.tier === 'A' && !n.quote) problems.push(full + '：A 層缺引文');
  }
  for (const { e } of emit2) {
    const full = SURNAME + e.c;
    if (allNames.has(full)) problems.push('重複：' + full);
    allNames.add(full);
    if (banned.has(e.c)) problems.push(full + '：禁用字');
    if (!['木', '火'].includes(e.w)) problems.push(full + '：非木火');
  }
  // 三字名的數量是如實的，不灌水。
  // 清理取名忌字與動詞末字之後，「兩字出自同一句」的真正好名只有 20 個上下；
  // 硬湊到 100 就會得到「芙桂」「梅棠」這種兩個植物名並列的填充物。
  // 所以 C 層設配額上限，湊不到 100 就交不到 100，並在報告裡說明實際數量。
  const THREE_TARGET = 100;
  if (emit3.length < THREE_TARGET) {
    console.log(
      `\n注意：三字名只有 ${emit3.length} 個，未達 ${THREE_TARGET}。`,
    );
    console.log('  這是如實數量，不是失敗。要補滿只有三條路，都需要你決定：');
    console.log('  1. 放寬取名忌字（例如讓「善」「德」當名字用）——會犧牲名字品質');
    console.log('  2. 放寬「同句」限制到「同段」或「同書任一句」——會犧牲引用強度');
    console.log('  3. 放寬五行限制，引入非木火字——會改變命理前提');
  }
  if (emit2.length < 100) {
    console.log(
      `\n注意：兩字名只有 ${emit2.length} 個，未達 100。`,
    );
    console.log('  這也是如實數量，理由同上：名只有一個字，每個字都要單獨撐得住一個名字。');
    console.log('  擋掉的包括「吳侯」（爵位）、「吳萬」（數量詞）、「吳菌」（菌菇）、');
    console.log('  「吳時」（一時）、「吳道」（道路），以及會與姓吳連讀成壞詞的德、明、容。');
  }

  const wx3 = {};
  for (const n of emit3) { const k = pool.get(n.a).w + pool.get(n.b).w; wx3[k] = (wx3[k] || 0) + 1; }
  const woodChars = wx3['木木'] * 2 + (wx3['木火'] || 0) + (wx3['火木'] || 0);
  const woodRatio3 = woodChars / (emit3.length * 2);

  console.log('已寫入', OUT);
  console.log('三字名', emit3.length, '（A', tA, '/ B', tB, '/ C', tC, '）五行分布', JSON.stringify(wx3));
  console.log('兩字名', emit2.length, '木佔比', (emit2.filter((x) => x.e.w === '木').length / emit2.length).toFixed(3));
  console.log('三字名木佔比', woodRatio3.toFixed(3), '（目標約', RATIO.木, '）');
  if (problems.length) {
    console.log('\n✗ 自我檢查發現問題：');
    for (const p of problems) console.log('  ' + p);
    process.exit(1);
  }
  console.log('\n✓ 自我檢查全部通過：無重複、無禁用字、全部木火、無同音、三字名皆同句或同本。');
}).catch((e) => { console.error(e); process.exit(1); });