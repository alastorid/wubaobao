# 好字消消樂 · 給寶寶的好名字

明亮花園裡的繁體中文疊牌三消遊戲，姓固定「吳」，名字一至二字。

[線上玩](https://alastorid.github.io/wubaobao/)

- 每局 102 張立體字牌、五層錯位堆疊。只有未被上層遮住的牌可以取走。
- 點牌或滑過牌，收進七格托盤；三張同字立即消除，加 30 能量與分數。
- 每次觸碰加 10 能量，滑動也累積。滿 100 揭曉好名字，取名優先採用收集的字；揭曉的 4.6 秒內仍可繼續操作。
- 金色祝福牌額外加 25 能量，鎖定字優先進入下一個名字；再次選金牌會更新鎖字。
- 撤回最後一張、重排、精靈幫忙湊一組，全部不限次數。托盤滿了會自動整理重排，不會遊戲失敗。
- 初始牌局與重排按合法取牌順序配出三張一組，至少有一條可解路徑。清空牌堆後自動進入下一座花園。
- 每局使用 10 種以內的少筆畫美字，從原有 512 字庫中挑選 ≤8 畫文字；選擇五行時，整副字牌會改為該五行。
- 天空放射光、厚白牌面、彩色字、薰衣草色托盤、飛牌與消除彩紙；iPad 直向與手機橫向各有適配版面。
- 音效與音樂由本地 WebAudio 合成，首次互動後播放，兩者可獨立靜音並記住設定。
- 名字簿支援收藏、單筆刪除與清空，沿用 `wubaobao-names` 舊資料。
- 純靜態、無建置、無 CDN；現在以 DOM/CSS 繪製字牌，不需要 WebGL。保留原有 three.js 本地檔案。

## 本機執行

```sh
python3 -m http.server 8123
# 開啟 http://localhost:8123/
```

## 檔案

```
index.html           頁面骨架與控制項
css/style.css        響應式介面、安全區與觸控樣式
js/game.js           疊牌三消、遊戲輸入、全螢幕、名字簿
js/audio.js          WebAudio 合成音效與音樂
js/namepool.js       字庫與取名邏輯
js/three.module.js   three.js 模組入口，必須與核心一併保留
js/three.core.js     three.js 核心
tests/              可重跑的資料與瀏覽器測試
```

## 字庫規則

每字含 `c` 繁體字、`p` 拼音、`s` 實寫筆畫、`w` 五行、`b` 美字標記、`cat` 構形。
精選少筆畫字另附 `meaning` 起名寓意（給孩子的祝願，並非字典完整釋義）。
例如仁（4 畫，寬厚仁愛）、允（4 畫，誠信公允）、吉（6 畫，吉祥美好）、帆（6 畫，揚帆遠行）。
新增字參與原有抽字與收集流程，保留完整字庫。
本草字另有 `src`，列出對應藥材名稱。經方／本草是來源，並非六書類別；本庫涵蓋
象形、指事、會意、形聲四種構形，不宣稱涵蓋六書全部類型。

拼音與筆畫核對 Unicode 17.0 Unihan。筆畫使用繁體字的 `kTotalStrokes`，多值採後值，
不混用康熙部首加筆法；字形標準間仍可能有差異。原有多音字保留適合取名的讀音。
五行沿用本遊戲的命名分類，擴充以部首與意象分組；不同姓名學派有不同歸屬。
構形標籤是學習參考，兼具會意與形聲的字可能有不同分析。

來源：[Unicode Unihan 說明](https://www.unicode.org/reports/tr38/)、
[Unicode 17.0 資料](https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip)、
[教育部「形聲」解釋](https://dict.revised.moe.edu.tw/dictView.jsp?ID=110679&la=1&powerMode=0)。
起名寓意參考：[教育部「仁」](https://dict.concised.moe.edu.tw/dictView.jsp?ID=36200&la=1&powerMode=0)、
[「允」](https://dict.variants.moe.edu.tw/dictView.jsp?ID=2401&la=1)、
[「妤」](https://dict.variants.moe.edu.tw/dictView.jsp?ID=9754&la=1)（本義為古代女官名，取名延伸寄寓才華）。
Unicode 資料授權見 `UNICODE-LICENSE.txt`。three.js 保留原有 MIT 授權。

## 驗證

```sh
node tests/namepool.cjs
# Playwright 僅供開發驗證，不是網站執行依賴：
npm install --prefix /tmp/wubaobao-qa playwright
node /tmp/wubaobao-qa/node_modules/playwright/cli.js install chromium webkit
NODE_PATH=/tmp/wubaobao-qa/node_modules node tests/browser.cjs
NODE_PATH=/tmp/wubaobao-qa/node_modules ENGINE=webkit node tests/browser.cjs
# 上線後同一套測試：
NODE_PATH=/tmp/wubaobao-qa/node_modules node tests/browser.cjs https://alastorid.github.io/wubaobao/
```

`?qa` 啟用唯讀狀態快照，測試仍使用真實觸控與滑鼠操作。

`tests/tiles.cjs`（`tests/browser.cjs` 為共用入口）涵蓋六種尺寸、102 張完整解題、
三消、五行、道具、滿槽救援、下一局、取名、靜音持久化、名字簿 CRUD、損壞儲存回復及全螢幕 fallback。
`tests/audio.cjs` 驗證首次互動解鎖、實際波形、獨立靜音與歸零。
`tests/soak.cjs` 在 WebKit iPad 尺寸下持續觸控量測；`SOAK_MS=20000` 可縮短到 20 秒。

字牌固定 102 張，效果節點有上限且會定時清除；沒有每幀運算的碰撞迴圈或 WebGL 負載。
尊重減少動態效果設定。桌面模擬尺寸與效能量測不代表實體 iPad 效能保證。
