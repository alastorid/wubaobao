// 驗證 sources.cjs 裡每一則「同句」引文，真的出現在 js/classics.js 的經文中。
// 引文若對不上就是偽造，必須抓出來。
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