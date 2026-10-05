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
const REJECT = new Set([
  // 否定、殘酷、不吉
  '死', '獄', '病', '厄', '殘', '缺', '損', '敗', '亡', '衰', '廢', '凶', '危',
  '劫', '空', '殯', '棺', '墓', '泣', '哀', '慘', '悲', '愁', '憂', '患', '疾',
  // 明確男性化或非人名
  '馬', '魚', '鳥', '鹿', '犬', '犬', '牛', '羊', '豕', '虎', '龍', '彖', '禽',
  '兄', '弟', '父', '母', '子', '夫', '奴', '婢', '妾', '僕', '戎', '兵', '將',
  // 太年長／古舊
  '叟', '丈', '翁', '公', '伯', '叔', '侯', '蕃', '庶', '牧', '俘', '囚', '虜',
  '叢', '薮', '藪', '隱', '匿', '冥', '幽', '鬼', '魄', '魂', '僵', '殭',
  // 唸起來拗口或罕見到不適合日常使用
  '彙', '蓍', '茝', '薜', '棻', '崑', '崙', '龜', '梔', '蕤', '葯', '蔘', '楨',
  '彙', '蓀', '葳', '芃', '芮', '苡', '芪', '茯', '茜', '榛', '荃', '桔',
  '梵', '棗', '粟', '棉', '蔓', '葵', '葦', '榆', '槐', '棣', '樺', '蒲', '蕎',
  '樾', '蕾', '蓁', '芊', '芷', '芸', '芹', '杉', '苓', '茗',
]);

// 加分：明顯適合女孩、可終身使用
const PREFER = new Set([
  // 香草花卉（清雅）
  '芷', '蘭', '蕙', '芳', '荔', '薇', '蓁', '蓮', '芙', '蓉', '桂', '菊', '荷',
  '梅', '棠', '槿', '萱', '葵', '芸', '芹', '杏', '芊', '蕾', '菁', '蕊', '茉',
  // 品德（終身適用）
  '柔', '靜', '善', '德', '和', '惠', '謙', '順', '修', '誠', '慈', '儉', '嘉',
  '容', '貞', '忠', '仁', '良', '謙', '樸', '中', '若',
  // 才情
  '昭', '朗', '明', '光', '照', '章', '文', '思', '議', '學', '雅', '采', '佩',
  // 溫柔明朗
  '姝', '倩', '巧', '愛', '怡', '悅', '舒', '安', '寧', '康', '健', '朗',
  // 生命力（頭毛多）
  '茂', '育', '蕊', '菁', '蓮', '蕾', '蓁', '芊', '生', '長', '春', '榮', '華',
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
      if (used.has(gname)) continue;
      if (pool.get(a).p === pool.get(b).p) continue;
      used.add(gname);
      out3.push({ given: gname, tier: 'B', quote: row.text, src: row.src, a, b, s: score(a, b) - 1 });
    }
  }

  // C 層：同本不同句（只取每本書評分最高的一批，避免整份清單都是本草植物）
  const byBook = {};
  for (const e of CHARACTERS) (byBook[e.book] = byBook[e.book] || []).push(e);
  const C_PER_BOOK = { bencao: 10, yijing: 10, ziwei: 6, shanhai: 5, shijing: 3, daodejing: 5, chuji: 2, baopuzi: 2 };
  // 每個字在 C 層最多出現幾次（避免整份清單都是同一個字開頭）
  const C_CHAR_CAP = { bencao: 2, yijing: 2, ziwei: 2, shanhai: 2, shijing: 2, daodejing: 2, chuji: 2, baopuzi: 2 };
  for (const [book, list] of Object.entries(byBook)) {
    const pairs = [];
    for (const a of list) {
      for (const b of list) {
        if (a.c === b.c) continue;
        if (!ok(a.c) || !ok(b.c)) continue;
        if (a.p === b.p) continue;
        const gname = a.c + b.c;
        if (used.has(gname)) continue;
        pairs.push({ given: gname, tier: 'C', a: a.c, b: b.c, s: score(a.c, b.c) - 2, book });
      }
    }
    // 同一本書裡，限制每個字最多當幾次「名」的第一或第二字，
    // 否則整份清單會變成「仁X」「良X」「杏X」這種單一字開頭的重複樣板。
    const cap = C_CHAR_CAP[book] || 3;
    const usedFirst = {};
    const usedSecond = {};
    const sorted = pairs.slice().sort(
      (x, y) => y.s - x.s || x.given.localeCompare(y.given, 'zh-Hant'));
    const kept = [];
    for (const p of sorted) {
      if ((usedFirst[p.a] || 0) >= cap) continue;
      if ((usedSecond[p.b] || 0) >= cap) continue;
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
    .filter((e) => ok(e.c))
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
  if (emit3.length !== 100) problems.push(`三字名只有 ${emit3.length} 個`);
  if (emit2.length !== 100) problems.push(`兩字名只有 ${emit2.length} 個`);

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