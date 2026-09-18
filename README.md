# 吳 · 泡泡取名機

給寶寶玩的繁體中文 3D 取名遊戲。姓固定「吳」，名字一至二字。

[線上玩](https://alastorid.github.io/wubaobao/)

摸一下、滑一下，泡泡帶來好字與能量。能量滿了就揭曉名字，自動存進名字簿。
點中／掃過泡泡會收集字，取名時優先採用；指定喜用神時以該五行優先。
揭曉的 4.6 秒內也能繼續累積、繼續取名，鍵盤輸入同樣有效。

- 翡翠綠與暖金介面、水嫩高光泡泡、美字金邊、呼吸水晶、星塵、彩紙迸發。
- WebAudio 合成點擊、破泡、能量音階、揭曉小號角／叮咚與五行慶祝音；低音量氛圍樂。
- 首次主動互動才開啟音訊，音效／音樂獨立開關並記住設定。
- 全螢幕切換；不支援的瀏覽器顯示 Safari「加入主畫面」提示。
- 512 個不重複繁體字：金 90、木 110、水 106、火 102、土 104。
- 新增 32 個 2～7 畫的美字；共 78 個 1～8 畫的字附起名寓意，揭曉時顯示字、筆畫及寓意。
- 名字簿支援檢視、單筆刪除、清空；保留 `wubaobao-names` 舊資料格式。
- 無 CDN、無建置步驟、無外部執行期請求；下載整份專案後可在離線本機 HTTP 伺服器遊玩。

## 本機執行

```sh
python3 -m http.server 8123
# 開啟 http://localhost:8123/
```

## 檔案

```
index.html           頁面骨架與控制項
css/style.css        響應式介面、安全區與觸控樣式
js/game.js           3D、遊戲輸入、全螢幕、名字簿
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
nodetests/namepool.cjs
# Playwright 僅供開發驗證，不是網站執行依賴：
npm install --prefix /tmp/wubaobao-qa playwright
node /tmp/wubaobao-qa/node_modules/playwright/cli.js install chromium webkit
NODE_PATH=/tmp/wubaobao-qa/node_modules nodetests/browser.cjs
NODE_PATH=/tmp/wubaobao-qa/node_modules ENGINE=webkit nodetests/browser.cjs
# 上線後同一套測試：
NODE_PATH=/tmp/wubaobao-qa/node_modules nodetests/browser.cjs https://alastorid.github.io/wubaobao/
```

`?qa` 僅啟用唯讀狀態快照；測試以真實滑鼠輸入操作。音訊以分析器檢查輸出波形及
靜音後歸零。測試包含十次點擊、連續揭曉、掃泡收字、五行、音量記憶、舊資料、
單筆刪除／清空、損壞儲存回復、全螢幕與 fallback、四種尺寸、大量輸入與資源上限。

效能上限：像素比 1.5、高像素比停用反鋸齒、36 泡泡（手機初始 28）、700 粒子、
100 張 instanced 彩紙、90 星塵、48 音訊聲部；沒有 bloom 或後製。文字貼圖 128px、
共用幾何與高光，數量受有限字庫限制。尊重減少動態效果設定。
桌面／模擬尺寸測試不能替代實機 iPad 長跑 60fps 的量測。
