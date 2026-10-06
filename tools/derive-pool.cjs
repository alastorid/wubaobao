// 產生誠實字庫：五行沿用原庫（已人工判定），
// cite 則從 classics.js 的實際經文推導——推導不出來的字不收。
//
// 這是對「憑印象寫出處」的根治辦法。
// 原本 cite 是人手寫的，例如 仁 標「坤·象」，但 classics.js 的易經欄位只有
// judgement（卦辭）與 image（大象），坤的大象是「地勢坤，謙」，
// 裡面沒有「仁」字。也就是說出處無法查證。
//
// 現在反過來做：先掃經文得到「哪些字真的出現、出現在哪裡」，
// 再與原庫（判過木火、查過筆畫）取交集，cite 用掃描結果。

const fs = require('fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const loadClassics = require('../tests/classics.cjs');

// Unihan.zip 從 Unicode 官方站取得後快取於此目錄。
// 只用於取 kTotalStrokes，不參與網站執行。
const ZIP = path.join(__dirname, '.unihan-cache', 'Unihan.zip');
let UNIHAN = null;
function unihanStrokes() {
  if (UNIHAN) return UNIHAN;
  UNIHAN = new Map();
  for (const f of ['Unihan_IRGSources.txt', 'Unihan_DictionaryLikeData.txt']) {
    const out = execFileSync('unzip', ['-p', ZIP, f], { maxBuffer: 1 << 29 }).toString('utf8');
    for (const line of out.split('\n')) {
      if (!line || line[0] === '#') continue;
      const m = line.match(/^U\+([0-9A-F]+)\tkTotalStrokes\t(\d+)/);
      if (m) UNIHAN.set(parseInt(m[1], 16), parseInt(m[2], 10));
    }
  }
  return UNIHAN;
}

loadClassics().then((C) => {
  const strokes = unihanStrokes();
  const { CHARACTERS } = require('../js/namepool.js');

  // 字 -> [{cite, book}]，全部來自實際經文
  const where = new Map();
  const note = (text, label, book) => {
    if (!text) return;
    for (const ch of new Set([...text])) {
      if (!where.has(ch)) where.set(ch, []);
      where.get(ch).push({ cite: label, book });
    }
  };

  for (const h of C.HEXAGRAMS) {
    note(h.judgement, `易經·${h.name}·卦辭`, 'yijing');
    note(h.image, `易經·${h.name}·大象`, 'yijing');
  }
  for (const p of C.SHIJING) note(p.text, `詩經·${p.part}·${p.title}`, 'shijing');
  for (const p of C.CHUCI) note(p.text, `楚辭·${p.part}·${p.title}`, 'chuji');
  for (const d of C.DAODEJING) note(d.text, `道德經·第${d.ch}章`, 'daodejing');
  for (const b of C.BAOPUZI) note(b.text, `抱樸子·${b.title}`, 'baopuzi');
  for (const k of Object.keys(C.SHANHAI)) for (const e of C.SHANHAI[k]) note(e.note, `山海經·${e.name}`, 'shanhai');
  // 本草：藥名索引的每個字都可入池，因為「神農本草·白芷」指的是
  // 《本草經》的白芷條，不是引用某句經文。use 欄是現代中藥學描述，不參與。
  for (const b of C.BENCAO) {
    for (const ch of new Set([...b])) note(ch, `神農本草·${b}`, 'bencao');
  }
  for (const s of C.ZIWEI_STARS) note(s.note, `紫微斗數·${s.name}`, 'ziwei');
  for (const p of C.ZIWEI_PALACES) note(p.note, `紫微斗數·${p.name}`, 'ziwei');

  const kept = [];
  const dropped = [];
  const citeChanged = [];

  for (const e of CHARACTERS) {
    const spots = where.get(e.c);
    if (!spots || !spots.length) {
      dropped.push({ c: e.c, old: `${e.book} ${e.cite}` });
      continue;
    }
    const unihan = strokes.get(e.c.codePointAt(0));
    const row = {
      c: e.c, p: e.p, w: e.w,
      s: unihan || e.s,
      cite: spots[0].cite,
      meaning: e.meaning,
      book: spots[0].book,
    };
    // cite 有變就記下來，因為這些是原本「出處對不上」的證據
    const oldCite = `${e.book === e.book ? '' : ''}${e.cite}`;
    if (!spots.some((sp) => sp.cite.includes(e.cite) || e.cite.includes(sp.cite))) {
      citeChanged.push({ c: e.c, was: e.cite, now: row.cite });
    }
    kept.push(row);
  }

  // 分書輸出
  const ORDER = ['yijing', 'shijing', 'chuji', 'daodejing', 'baopuzi', 'shanhai', 'bencao', 'ziwei'];
  const LABEL = {
    yijing: '古本易經', shijing: '詩經', chuji: '楚辭', daodejing: '道德經',
    baopuzi: '抱樸子', shanhai: '山海經', bencao: '神農本草', ziwei: '紫微斗數',
  };
  const lines = ['// 本區塊由 tools/derive-pool.cjs 產生：cite 全部來自 classics.js 實際經文。', '// 格式：字, 拼音, 筆畫(Unihan kTotalStrokes), 出處, 寓意', ''];
  for (const book of ORDER) {
    for (const w of ['木', '火']) {
      const rows = kept.filter((r) => r.book === book && r.w === w)
        .sort((a, b) => a.c.localeCompare(b.c, 'zh-Hant'));
      if (!rows.length) continue;
      lines.push(`  // ── ${LABEL[book]} · ${w} ──`);
      lines.push(`  ...rows('${book}', '${w}', \``);
      for (const r of rows) lines.push(`${r.c}, ${r.p}, ${r.s}, ${r.cite}, ${r.meaning}`);
      lines.push('  `),');
      lines.push('');
    }
  }

  // 只輸出到 stdout。寫入 js/namepool.js 必須人工確認後再做，
// 因為這個工具會改變整個字庫，自動寫入風險太高。
  process.stdout.write(lines.join('\n') + '\n');

  const byBook = {};
  for (const r of kept) byBook[r.book] = (byBook[r.book] || 0) + 1;
  console.log('保留', kept.length, '字（原', CHARACTERS.length, '）');
  console.log('  木', kept.filter((r) => r.w === '木').length,
    '火', kept.filter((r) => r.w === '火').length);
  console.log('  分書：', JSON.stringify(byBook));
  console.log('剔除（經文中查不到出處）：', dropped.length, '→', dropped.map((d) => d.c).join(''));
  console.log('cite 被改寫的：', citeChanged.length, '（這些原本的出處對不上經文）');
  console.log('');
  console.log('Unihan 筆畫修正的：',
    kept.filter((r) => strokes.get(r.c.codePointAt(0)) !== undefined && r.s !== CHARACTERS.find((e) => e.c === r.c).s).length);
}).catch((e) => { console.error(e); process.exit(1); });