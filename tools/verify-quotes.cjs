// 驗證 tools/sources.cjs 裡的 classic 層引文真的出現在 js/classics.js 的經文中。
//
// 這條檢查的效力和它的邊界，必須講清楚：
//   它能驗的是「引文有沒有被改寫」——比對 classics.js 的實際文本。
//   它驗不了的是「classics.js 的文本本身對不對」——那是另一個問題，
//   需要拿外部原文比對，不是自我比對能解決的。
//
// 所以神農本草與紫微斗數的條目被排除在 classic 層之外：
// 那兩部的資料欄位是「藥名索引」與「現代命理描述」，不是原文。
// 把現代描述放進經文層再拿自己比對自己，等於自我循環，驗證不到任何東西。
const path = require('node:path');
const { CLASSIC_SAME_SENTENCE } = require(path.join(__dirname, 'sources.cjs'));
const loadClassics = require(path.join(__dirname, '..', 'tests', 'classics.cjs'));

// 把經文全部攤平成「書名 + 內文」的檢索池
loadClassics().then((C) => {
  const corpus = [];
  const add = (book, text, label) => { if (text) corpus.push({ book, text, label }); };

  for (const h of C.HEXAGRAMS) { add('yijing', h.judgement, h.name + ' 卦辭'); add('yijing', h.image, h.name + ' 大象'); }
  for (const p of C.SHIJING) add('shijing', p.text, p.part + '·' + p.title);
  for (const p of C.CHUCI) add('chuji', p.text, p.part + '·' + p.title);
  for (const d of C.DAODEJING) add('daodejing', d.text, '第' + d.ch + '章');
  for (const b of C.BAOPUZI) add('baopuzi', b.text, b.part + '·' + b.title);
  for (const k of Object.keys(C.SHANHAI)) for (const e of C.SHANHAI[k]) add('shanhai', e.note, e.name);
  for (const b of C.BENCAO) { add('bencao', b.use, b.name); add('bencao', b.note, b.name); }
  for (const s of C.ZIWEI_STARS) { add('ziwei', s.note, s.name); }
  for (const p of C.ZIWEI_PALACES) add('ziwei', p.note, p.name);

  console.log('經文條目數：', corpus.length);

  // 去掉標點後比對，因為引文常省略標點
  const norm = (s) => [...s].filter((c) => !'，。；：、？！　 '.includes(c)).join('');
  const index = corpus.map((e) => ({ ...e, n: norm(e.text) }));

  let bad = 0;
  for (const row of CLASSIC_SAME_SENTENCE) {
    const needle = norm(row.text);
    const hits = index.filter((e) => e.n.includes(needle));
    if (hits.length === 0) {
      bad++;
      console.log(`✗ 對不上：${row.text}　（宣稱出處 ${row.src}）`);
    } else {
      const where = hits.map((h) => h.book + '·' + h.label).join(' / ');
      // 出處標示是否與實際所在相符
      const claimed = row.src;
      const ok = hits.some((h) => claimed.includes(h.label.replace(/^第/, '').replace(/章$/, ''))
        || claimed.includes(h.book === 'yijing' ? '易經' : h.label));
      console.log(`${ok ? '✓' : '△'} ${row.text.padEnd(12)} 實際在：${where}`);
      if (!ok) console.log(`    （宣稱：${claimed}）`);
    }
  }
  console.log('\n對不上的條目：', bad, '/', CLASSIC_SAME_SENTENCE.length);
}).catch((e) => { console.error(e); process.exit(1); });