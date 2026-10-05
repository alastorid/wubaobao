// 測試用的經文資料載入（把 js/classics.js 的 ESM 轉成 CJS）。
//
// js/classics.js 是 ESM（給瀏覽器用），檔尾也掛了 module.exports 給 Node。
// 但 Node 26 的 require() 讀這種「ESM + module.exports」的檔案會拿到
// namespace 卻有部分匯出是 undefined（實測 CHUJI 即如此，ESM import 正常）。
// 與其跟 require 的互動細節纏鬥，這裡自己轉一次 CJS。
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'js', 'classics.js');
const source = fs.readFileSync(file, 'utf8');

const EXPORTS = [
  'TRIGRAMS', 'HEXAGRAMS', 'HEXAGRAM_BY_LINES',
  'ZIWEI_STARS', 'ZIWEI_PALACES', 'ZIWEI_HUA', 'ZIWEI_SHEN', 'ZIWEI_AUX',
  'SHANHAI', 'SHANHAI_SECTIONS', 'BENCAO', 'BENCAO_CHAR_HINT',
  'DAODEJING', 'BAOPUZI', 'SHIJING', 'CHUJI', 'SOURCES', 'SOURCE_BY_ID',
];

const cjs =
  source
    // export const X = → const X =（不進 module.exports 的內容）
    .replace(/^export const /gm, 'const ')
    .replace(/^export function /gm, 'function ')
    .replace(/^export (let|class) /gm, '$1 ')
    // 檔尾原本的 module.exports 區塊不用了，我們自己組
    .replace(/if \(typeof module !== 'undefined'\) \{[\s\S]*?\n\}\n?$/m, '')
    + `\nmodule.exports = { ${EXPORTS.join(', ')} };\n`;

// 用 indirect eval 取得 module.exports，避免檔名結尾 .cjs 造成自我比對問題
const load = new Function('module', 'exports', 'require', '__filename', '__dirname', cjs);
const mod = { exports: {} };
load(mod, mod.exports, require, file, path.dirname(file));

module.exports = mod.exports;
