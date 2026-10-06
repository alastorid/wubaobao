// 資料層測試的進入點。
//
// js/classics.js 是 ESM 模組（給瀏覽器用），Node 的 require() 讀不到
// 部分匯出，所以這裡先以動態 import 載入，再交給 namepool.body.cjs 跑斷言。
// 拆成兩檔只是為了讓 body 能讀到 module scope 之外的 CLASSICS 資料。
const loadClassics = require('./classics.cjs');
const { audit } = require('../tools/audit-docs.cjs');

loadClassics()
  .then(async (CLASSICS) => {
    global.__CLASSICS = CLASSICS;
    require('./namepool.body.cjs');

    // 文件與程式碼的一致性檢查。
    //
    // 放在這裡是因為它和資料層斷言檢查的是同一批東西（字庫、名單、篇章），
    // 而文件裡的數字一旦手寫就會慢慢脫節——實際發生過兩次，
    // 都是靠人眼看出來而不是自己浮出來。
    const { facts, checks, intros, problems } = await audit();
    for (const [label, v] of facts) console.log(`  ${label.padEnd(14)} ${v}`);
    console.log(`  文件檢查點      ${checks} 條、自我介紹 ${intros} 條`);
    if (problems.length) {
      console.log('\\n✗ 文件與程式碼不一致：');
      for (const p of problems) console.log(`  · ${p}`);
      process.exitCode = 1;
      return;
    }
    console.log('  ✓ 文件與程式碼一致');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });