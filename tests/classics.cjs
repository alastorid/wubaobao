// 測試用的古本經文載入（回傳 Promise）。
//
// js/classics.js 是 ESM。js/oracle.js 用 import 載它，測試端若用 require()
// 讀同一個檔案，匯出行為不一致，所以這裡一律走動態 import()，
// 和瀏覽器、js/oracle.js 走同一條路徑。回傳 Promise，呼叫端自行 await。
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const FILE = path.join(__dirname, '..', 'js', 'classics.js');

let cached = null;
const load = () => {
  if (!cached) cached = import(pathToFileURL(FILE).href);
  return cached;
};

module.exports = load;
