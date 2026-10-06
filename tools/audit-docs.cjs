// 文件與程式碼的一致性檢查。
//
// 為什麼需要這個：文件裡的數字一旦手寫，就會和程式碼慢慢脫節。
// 實際發生過兩次——
//   1. README 寫「243 字」、實際 120
//   2. VERIFICATION 寫「忌字 99 個」、實際 92
// 兩次都是靠人眼看出來的，不會自己浮出來。
//
// 這裡把每個會出現在文件裡的數字都綁到實際值上。
// 改動字庫或名單而沒改文件（或反過來）就會 exit 1。
//
// 規則：不列舉「文件裡不該出現的字串」當主要手段——那會隨著內容演進
// 產生假陽性。改成「文件必須宣告這個數字，且宣告的值要等於實際值」。

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { CHARACTERS, BANNED, TABOO } = require(path.join(ROOT, 'js', 'namepool.js'));
const loadClassics = require(path.join(ROOT, 'tests', 'classics.cjs'));

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

async function audit() {
  const C = await loadClassics();
  const names = read('names-200.md');
  const i3 = names.indexOf('## 一、三個字');
  const i2 = names.indexOf('## 二、兩個字');
  const n3 = names.slice(i3, i2).split('\n').filter((l) => l.startsWith('### ')).length;
  const n2 = names.slice(i2).split('\n').filter((l) => l.startsWith('### ')).length;

  const problems = [];
  // 以檔名為 key，與 required 的索引一致
  const docs = { 'README.md': read('README.md'), 'VERIFICATION.md': read('VERIFICATION.md') };

  // ── 實際值 ─────────────────────────────────────────────
  const facts = [
    ['字庫總數', CHARACTERS.length],
    ['木行字數', CHARACTERS.filter((e) => e.w === '木').length],
    ['火行字數', CHARACTERS.filter((e) => e.w === '火').length],
    ['禁用字數', BANNED.size],
    ['取名忌字數', Object.keys(TABOO).length],
    ['三個字名單數', n3],
    ['兩個字名單數', n2],
    ['詩經篇數', C.SHIJING.length],
    ['楚辭篇數', C.CHUCI.length],
    ['道德經章數', C.DAODEJING.length],
    ['古籍部數', C.SOURCES.length],
  ];

  // ── 哪些文件必須寫哪個數字 ─────────────────────────────
  // 用「必須出現的字串」而不是「解析表格」：數字散在敘述句裡，
  // 解析只會漏掉。缺宣告 = 文件沒跟上程式碼。
  const required = [
    ['README.md', '字庫總數', `${CHARACTERS.length} 個**取名用字`],
    ['README.md', '木行字數', `| **合計** | **${CHARACTERS.filter((e) => e.w === '木').length}** | **${CHARACTERS.filter((e) => e.w === '火').length}** |`],
    ['README.md', '禁用字數', `\`BANNED\` | ${BANNED.size}`],
    ['README.md', '取名忌字數', `\`TABOO\` | ${Object.keys(TABOO).length}`],
    ['README.md', '三個字名單數', `**${n3} 個**`],
    ['README.md', '兩個字名單數', `**${n2} 個**`],
    ['README.md', '古籍部數', `${C.SOURCES.length} 部古籍`],
    ['VERIFICATION.md', '字庫總數', `${CHARACTERS.length} 字`],
    ['VERIFICATION.md', '取名忌字數', `${Object.keys(TABOO).length} 字`],
    ['VERIFICATION.md', '三個字名單數', `${n3} 個`],
    ['VERIFICATION.md', '兩個字名單數', `${n2} 個`],
    ['VERIFICATION.md', '詩經篇數', `${C.SHIJING.length} 篇`],
  ];

  for (const [file, label, needle] of required) {
    if (!docs[file].includes(needle)) {
      problems.push(`${file} 沒有寫出${label}（應含「${needle}」）`);
    }
  }
  // 逐行檢查：宣告的數字必須和實際值同處一行。
  // 檢查點用完整字串比對會被排版改動（多一個空格）誤判，所以再補一層
  // 「數字與標籤同行」的比對，兩者都過才算寫到。
  const sameLine = (file, label, numRe, labelRe) => {
    const hit = docs[file].split('\n').some((l) => numRe.test(l) && labelRe.test(l));
    if (!hit) problems.push(`${file} 的「${label}」沒有和數字寫在同一行`);
  };
  sameLine('README.md', '字庫總數', new RegExp(`\\b${CHARACTERS.length}\\b`), /取名用字/);
  sameLine('README.md', '禁用字數', new RegExp(`\\b${BANNED.size}\\b`), /BANNED/);
  sameLine('README.md', '取名忌字數', new RegExp(`\\b${Object.keys(TABOO).length}\\b`), /TABOO/);
  sameLine('README.md', '古籍部數', new RegExp(`\\b${C.SOURCES.length}\\b`), /部古籍/);
  sameLine('VERIFICATION.md', '詩經篇數', new RegExp(`\\b${C.SHIJING.length}\\b`), /篇/);

  // ── 分層一致性：只有 text 層能當引文 ───────────────────
  for (const s of C.SOURCES) {
    if (!['text', 'index', 'modern'].includes(s.tier)) {
      problems.push(`${s.name} 未宣告 tier`);
    }
  }

  // ── 自我介紹的字數宣稱 ────────────────────────────────
  const blocks = names.split(/^### /m).slice(1);
  let checked = 0;
  for (const b of blocks) {
    const head = b.match(/^(\d+)\. (.+)\n/);
    if (!head) continue;
    const nm = head[2].trim();
    const intro = (b.match(/自我介紹：「(.+?)」/) || [])[1] || '';
    if (!intro) {
      problems.push(`${nm} 沒有自我介紹`);
      continue;
    }
    const claim = /，(三|兩)個字，/.exec(intro);
    const want = nm.length === 3 ? '三' : '兩';
    if (!claim) problems.push(`${nm} 的自我介紹沒有宣告字數`);
    else if (claim[1] !== want) {
      problems.push(`${nm} 是 ${nm.length} 個字，自我介紹卻說「${claim[1]}個字」`);
    }
    // 同行不得提到另一行
    const sameTag = /兩個字都是([木火])/.exec(intro);
    if (sameTag) {
      const other = sameTag[1] === '木' ? '火氣足' : '木氣足';
      if (intro.includes(other)) {
        problems.push(`${nm} 是${sameTag[1]}${sameTag[1]}，自我介紹卻提到${other}`);
      }
    }
    checked++;
  }
  if (checked !== n3 + n2) {
    problems.push(`自我介紹數量 ${checked} ≠ 名單數量 ${n3 + n2}`);
  }

  // ── 報告 ──────────────────────────────────────────────
  console.log('實際值：');
  for (const [label, v] of facts) console.log(`  ${label.padEnd(14)} ${v}`);
  console.log(`  文件檢查點      ${required.length} 條、自我介紹 ${checked} 條`);

  return { facts, checks: required.length, intros: checked, problems };
}

// CLI：直接跑時印出報告並以狀態碼表示結果。
if (require.main === module) {
  audit()
    .then(({ facts, checks, intros, problems }) => {
      console.log('實際值：');
      for (const [label, v] of facts) console.log(`  ${label.padEnd(14)} ${v}`);
      console.log(`  文件檢查點      ${checks} 條、自我介紹 ${intros} 條`);
      if (problems.length) {
        console.log('\n✗ 文件與程式碼不一致：');
        for (const p of problems) console.log(`  · ${p}`);
        process.exit(1);
      }
      console.log('\n✓ 文件與程式碼一致');
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { audit };