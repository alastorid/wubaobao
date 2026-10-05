// 資料層測試的進入點。
//
// 古本經文是 ESM 模組（給瀏覽器用），Node 的 require() 讀不到
// 部分匯出，所以這裡先以動態 import 載入，再交給 namepool.body.cjs 跑斷言。
// 拆成兩檔只是為了讓 body 能讀到 module scope 之外的 CLASSICS 資料。
const loadClassics = require('./classics.cjs');

loadClassics()
  .then((CLASSICS) => {
    global.__CLASSICS = CLASSICS;
    require('./namepool.body.cjs');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });