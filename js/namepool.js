// wubaobao · 名字字庫（金可喜）
//
// 依「六書」分類（象形 / 形聲 / 會意 / 指事），並參考 倪海廈《天紀》經方/本草
// （dashi · hantang 兩庫）與 紫微斗數五行平衡之說（bazi）收字。
//
// 每個字附：
//   c  字（繁體）
//   p  漢語拼音
//   s  康熙/繁體筆畫數
//   w  五行　：以「部首取五行」之通行取法（氵→水、木艹禾竹→木、王玉→金、
//              日火→火、土山石田→土、心忄→火、女→土、亻→木、宀→土…）
//   b  美字　：1 = 推薦常用 / 寓意佳（抽中機率加權）
//   src 來源註記：（經方）= 出自 倪師經方/本草 方劑藥材之字
//
// 說明：五行歸屬各姓名學派別有出入，本庫採部首取法以求「望文生義」、邏輯一致；
//      遊戲中每個字都會顯示五行標記，父母一眼看懂取名走勢，便於補喜用神。

const WU_XING = Object.freeze({
  金: { label: '金', icon: '🪙', color: '#d4af37' },
  木: { label: '木', icon: '🌿', color: '#2e9e5b' },
  水: { label: '水', icon: '💧', color: '#3a86ff' },
  火: { label: '火', icon: '🔥', color: '#ff5c5c' },
  土: { label: '土', icon: '⛰️', color: '#b08452' }
});

const POOL = {

  // ── 象形字：望文生義，字如圖畫 ────────────────
  xiangxing: [
    { c: '山', p: 'shān', s: 3,  w: '土', b: 1 },
    { c: '川', p: 'chuān', s: 3, w: '水', b: 1 },
    { c: '水', p: 'shuǐ', s: 4,  w: '水', b: 1 },
    { c: '木', p: 'mù', s: 4,   w: '木', b: 1 },
    { c: '林', p: 'lín', s: 8,  w: '木', b: 1 },
    { c: '田', p: 'tián', s: 5, w: '土', b: 0 },
    { c: '日', p: 'rì', s: 4,   w: '火', b: 0 },
    { c: '月', p: 'yuè', s: 4,  w: '火', b: 1 },
    { c: '玉', p: 'yù', s: 5,   w: '金', b: 1 },
    { c: '心', p: 'xīn', s: 4,  w: '火', b: 1 },
    { c: '子', p: 'zǐ', s: 3,   w: '水', b: 1 },
    { c: '女', p: 'nǚ', s: 3,   w: '土', b: 0 },
    { c: '人', p: 'rén', s: 2,  w: '木', b: 0 },
    { c: '大', p: 'dà', s: 3,   w: '火', b: 0 },
    { c: '雨', p: 'yǔ', s: 8,   w: '水', b: 1 },
    { c: '竹', p: 'zhú', s: 6,  w: '木', b: 1 },
    { c: '米', p: 'mǐ', s: 6,   w: '土', b: 0 },
    { c: '禾', p: 'hé', s: 5,   w: '木', b: 0 },
    { c: '泉', p: 'quán', s: 9, w: '水', b: 1 },
    { c: '雲', p: 'yún', s: 12, w: '水', b: 1 },
    { c: '星', p: 'xīng', s: 9, w: '火', b: 1 },
    { c: '龍', p: 'lóng', s: 16, w: '土', b: 1 },
    { c: '石', p: 'shí', s: 5,  w: '土', b: 0 }
  ],

  // ── 形聲字：一半表義、一半表音，占漢字大半 ─────
  xingsheng: [
    { c: '詩', p: 'shī', s: 13, w: '金', b: 1 },
    { c: '詠', p: 'yǒng', s: 12, w: '木', b: 1 },
    { c: '思', p: 'sī', s: 9,  w: '火', b: 1 },
    { c: '恩', p: 'ēn', s: 10, w: '土', b: 1 },
    { c: '惠', p: 'huì', s: 12, w: '火', b: 1 },
    { c: '慈', p: 'cí', s: 13, w: '金', b: 1 },
    { c: '慧', p: 'huì', s: 15, w: '火', b: 1 },
    { c: '欣', p: 'xīn', s: 8, w: '火', b: 1 },
    { c: '樂', p: 'lè', s: 15, w: '木', b: 1 },
    { c: '康', p: 'kāng', s: 11, w: '木', b: 1 },
    { c: '和', p: 'hé', s: 8,  w: '土', b: 1 },
    { c: '哲', p: 'zhé', s: 10, w: '火', b: 1 },
    { c: '軒', p: 'xuān', s: 10, w: '金', b: 1 },
    { c: '宇', p: 'yǔ', s: 6,  w: '土', b: 1 },
    { c: '承', p: 'chéng', s: 8, w: '土', b: 1 },
    { c: '浩', p: 'hào', s: 11, w: '水', b: 1 },
    { c: '澤', p: 'zé', s: 17, w: '水', b: 1 },
    { c: '翔', p: 'xiáng', s: 12, w: '木', b: 1 },
    { c: '睿', p: 'ruì', s: 14, w: '金', b: 1 },
    { c: '沐', p: 'mù', s: 7, w: '水', b: 1 },
    { c: '澄', p: 'chéng', s: 16, w: '水', b: 1 },
    { c: '書', p: 'shū', s: 10, w: '金', b: 1 },
    { c: '墨', p: 'mò', s: 15, w: '土', b: 1 },
    { c: '璃', p: 'lí', s: 15, w: '金', b: 1 },
    { c: '玥', p: 'yuè', s: 9, w: '土', b: 1 },
    { c: '妍', p: 'yán', s: 7, w: '土', b: 1 },
    { c: '姝', p: 'shū', s: 9, w: '土', b: 1 },
    { c: '婉', p: 'wǎn', s: 11, w: '土', b: 1 },
    { c: '婷', p: 'tíng', s: 12, w: '土', b: 1 },
    { c: '晴', p: 'qíng', s: 12, w: '火', b: 1 },
    { c: '嵐', p: 'lán', s: 12, w: '土', b: 1 },
    { c: '曦', p: 'xī', s: 20, w: '火', b: 1 },
    { c: '晨', p: 'chén', s: 11, w: '火', b: 1 },
    { c: '彤', p: 'tóng', s: 7, w: '火', b: 1 },
    { c: '可', p: 'kě', s: 5,  w: '木', b: 1 },
    { c: '予', p: 'yǔ', s: 4,  w: '水', b: 1 },
    { c: '依', p: 'yī', s: 8,  w: '木', b: 1 },
    { c: '希', p: 'xī', s: 7,  w: '水', b: 1 },
    { c: '悅', p: 'yuè', s: 10, w: '火', b: 1 },
    { c: '怡', p: 'yí', s: 8,  w: '火', b: 1 },
    { c: '恬', p: 'tián', s: 9, w: '火', b: 1 },
    { c: '恆', p: 'héng', s: 9, w: '水', b: 1 },
    { c: '謙', p: 'qiān', s: 17, w: '火', b: 1 },
    { c: '禮', p: 'lǐ', s: 18, w: '火', b: 0 },
    { c: '楷', p: 'kǎi', s: 13, w: '木', b: 0 },
    { c: '柏', p: 'bó', s: 9,  w: '木', b: 1 },
    { c: '松', p: 'sōng', s: 8, w: '木', b: 1 },
    { c: '楠', p: 'nán', s: 13, w: '木', b: 1 },
    { c: '洛', p: 'luò', s: 9, w: '水', b: 1 },
    { c: '淇', p: 'qí', s: 11, w: '水', b: 1 },
    { c: '洋', p: 'yáng', s: 9, w: '水', b: 1 },
    { c: '涵', p: 'hán', s: 11, w: '水', b: 1 },
    { c: '沛', p: 'pèi', s: 7, w: '水', b: 1 },
    { c: '波', p: 'bō', s: 8,  w: '水', b: 1 },
    { c: '濤', p: 'tāo', s: 17, w: '水', b: 1 },
    { c: '泓', p: 'hóng', s: 8, w: '水', b: 1 },
    { c: '湖', p: 'hú', s: 12, w: '水', b: 0 },
    { c: '沁', p: 'qìn', s: 7, w: '水', b: 1 },
    { c: '潔', p: 'jié', s: 15, w: '水', b: 1 },
    { c: '濟', p: 'jì', s: 17, w: '水', b: 0 },
    { c: '漢', p: 'hàn', s: 14, w: '水', b: 0 },
    { c: '梅', p: 'méi', s: 11, w: '木', b: 1 },
    { c: '桃', p: 'táo', s: 10, w: '木', b: 0 },
    { c: '杏', p: 'xìng', s: 7, w: '木', b: 0 },
    { c: '桂', p: 'guì', s: 10, w: '木', b: 0 },
    { c: '柳', p: 'liǔ', s: 9, w: '木', b: 0 },
    { c: '琳', p: 'lín', s: 12, w: '金', b: 1 },
    { c: '琪', p: 'qí', s: 12, w: '金', b: 1 },
    { c: '瑜', p: 'yú', s: 13, w: '金', b: 1 },
    { c: '瑋', p: 'wěi', s: 14, w: '金', b: 1 },
    { c: '珍', p: 'zhēn', s: 9, w: '金', b: 1 },
    { c: '玲', p: 'líng', s: 9, w: '金', b: 1 },
    { c: '珊', p: 'shān', s: 9, w: '金', b: 1 },
    { c: '珮', p: 'pèi', s: 10, w: '金', b: 1 },
    { c: '璇', p: 'xuán', s: 15, w: '金', b: 1 },
    { c: '瑞', p: 'ruì', s: 13, w: '金', b: 1 },
    { c: '瑾', p: 'jǐn', s: 15, w: '金', b: 1 },
    { c: '璐', p: 'lù', s: 17, w: '金', b: 1 },
    { c: '綺', p: 'qǐ', s: 14, w: '金', b: 1 },
    { c: '紋', p: 'wén', s: 10, w: '金', b: 0 },
    { c: '純', p: 'chún', s: 10, w: '金', b: 1 },
    { c: '柔', p: 'róu', s: 9,  w: '木', b: 1 },
    { c: '佳', p: 'jiā', s: 8,  w: '木', b: 1 },
    { c: '佩', p: 'pèi', s: 8,  w: '金', b: 1 },
    { c: '佑', p: 'yòu', s: 7,  w: '土', b: 1 },
    { c: '佐', p: 'zuǒ', s: 7,  w: '金', b: 0 },
    { c: '俊', p: 'jùn', s: 9,  w: '木', b: 1 },
    { c: '傑', p: 'jié', s: 12, w: '木', b: 1 },
    { c: '偉', p: 'wěi', s: 11, w: '木', b: 1 },
    { c: '儒', p: 'rú', s: 16, w: '木', b: 0 },
    { c: '倫', p: 'lún', s: 10, w: '木', b: 1 },
    { c: '健', p: 'jiàn', s: 11, w: '木', b: 1 },
    { c: '儀', p: 'yí', s: 15, w: '木', b: 1 },
    { c: '修', p: 'xiū', s: 10, w: '金', b: 1 },
    { c: '倩', p: 'qiàn', s: 10, w: '木', b: 1 }
  ],

  // ── 會意字：合兩字之義，會出新意 ─────────────
  huiyi: [
    { c: '安', p: 'ān', s: 6,  w: '土', b: 1 },
    { c: '明', p: 'míng', s: 8, w: '火', b: 1 },
    { c: '昌', p: 'chāng', s: 8, w: '火', b: 1 },
    { c: '平', p: 'píng', s: 5, w: '土', b: 1 },
    { c: '正', p: 'zhèng', s: 5, w: '土', b: 1 },
    { c: '立', p: 'lì', s: 5,  w: '木', b: 1 },
    { c: '成', p: 'chéng', s: 6, w: '土', b: 1 },
    { c: '好', p: 'hǎo', s: 6, w: '水', b: 1 },
    { c: '春', p: 'chūn', s: 9, w: '木', b: 1 },
    { c: '秋', p: 'qiū', s: 9, w: '金', b: 1 },
    { c: '新', p: 'xīn', s: 13, w: '木', b: 1 },
    { c: '卓', p: 'zhuó', s: 8, w: '火', b: 1 },
    { c: '賢', p: 'xián', s: 15, w: '木', b: 1 },
    { c: '聖', p: 'shèng', s: 13, w: '土', b: 1 },
    { c: '文', p: 'wén', s: 4, w: '火', b: 1 },
    { c: '武', p: 'wǔ', s: 8, w: '水', b: 1 },
    { c: '光', p: 'guāng', s: 6, w: '火', b: 1 },
    { c: '晶', p: 'jīng', s: 12, w: '火', b: 1 },
    { c: '磊', p: 'lěi', s: 15, w: '土', b: 0 },
    { c: '森', p: 'sēn', s: 12, w: '木', b: 0 },
    { c: '炎', p: 'yán', s: 8, w: '火', b: 0 },
    { c: '彬', p: 'bīn', s: 11, w: '木', b: 1 },
    { c: '采', p: 'cǎi', s: 7, w: '金', b: 1 },
    { c: '智', p: 'zhì', s: 12, w: '火', b: 1 },
    { c: '嘉', p: 'jiā', s: 14, w: '木', b: 1 }
  ],

  // ── 指事字：以符號標示抽象之意 ───────────────
  zhishi: [
    { c: '元', p: 'yuán', s: 4, w: '火', b: 1 },
    { c: '中', p: 'zhōng', s: 4, w: '土', b: 1 },
    { c: '一', p: 'yī', s: 1,  w: '水', b: 1 },
    { c: '至', p: 'zhì', s: 6, w: '土', b: 1 }
  ],

  // ── 經方字：出自 倪海廈《天紀》經方 / 本草 之字 ──
  jingfang: [
    { c: '參', p: 'shēn', s: 11, w: '金', b: 1, src: '經方' },   // 人參
    { c: '苓', p: 'líng', s: 11, w: '木', b: 1, src: '經方' },   // 茯苓
    { c: '歸', p: 'guī', s: 18, w: '水', b: 1, src: '經方' },   // 當歸
    { c: '蓮', p: 'lián', s: 15, w: '木', b: 1, src: '經方' },   // 蓮子
    { c: '丹', p: 'dān', s: 4,  w: '火', b: 1, src: '經方' },   // 丹參
    { c: '甘', p: 'gān', s: 5,  w: '木', b: 1, src: '經方' },   // 甘草
    { c: '茵', p: 'yīn', s: 12, w: '木', b: 1, src: '經方' },   // 茵陳
    { c: '苡', p: 'yǐ', s: 9,  w: '木', b: 1, src: '經方' },   // 薏苡
    { c: '香', p: 'xiāng', s: 9, w: '木', b: 1, src: '經方' },  // 木香
    { c: '芷', p: 'zhǐ', s: 10, w: '木', b: 1, src: '經方' },  // 白芷
    { c: '羽', p: 'yǔ', s: 6,  w: '水', b: 1, src: '經方' }    // (翼/羽族祥物)
  ]
};

// 把各類展平成單一陣列
POOL.all = Object.keys(POOL)
  .filter(k => Array.isArray(POOL[k]))
  .flatMap(k => POOL[k]);

// 五行資訊
function wxInfo(w) { return WU_XING[w] || { label: w, color: '#888' }; }

// 依條件挑選單一「美」字或任一符合之字（可加權）
function pickChar({ type = 'all', minStrokes = 1, maxStrokes = 99, beautyOnly = true, want = null, n = 1 } = {}) {
  const src = (type === 'all' ? POOL.all : (POOL[type] || POOL.all)).filter(x =>
    x.s >= minStrokes && x.s <= maxStrokes && (!beautyOnly || x.b === 1) && (!want || x.w === want));
  if (!src.length) return n === 1 ? null : [];
  if (n === 1) return src[(Math.random() * src.length) | 0];
  const out = [];
  while (out.length < n) out.push(src[(Math.random() * src.length) | 0]);
  return out;
}

// 依五行「想補」的目標抽出 1~2 個相異美字。
// 若 want 未指定（隨機），從五種五行中隨機取一個當目標，再抽該五行之字。
// 回傳 { chars: [entry,...], elements: [w,...] }
function pickGivenName({ want = null, count = null, minStrokes = 1, maxStrokes = 99 } = {}) {
  // 決定長度：1 或 2 字
  const len = count != null ? count : (Math.random() < 0.30 ? 1 : 2);
  // 決定目標五行：沒指定則隨機一種
  const target = want || Object.keys(WU_XING)[(Math.random() * 5) | 0];
  const chosen = [];
  const seen = new Set();
  const src = POOL.all.filter(x => x.b === 1 && x.w === target && x.s >= minStrokes && x.s <= maxStrokes);
  const fallback = POOL.all.filter(x => x.b === 1);
  while (chosen.length < len) {
    let pick = null;
    const cand = src.filter(x => !seen.has(x.c));
    if (cand.length) { pick = cand[(Math.random() * cand.length) | 0]; }
    else {
      const fb = fallback.filter(x => !seen.has(x.c));
      if (!fb.length) break;
      pick = fb[(Math.random() * fb.length) | 0];
    }
    if (!pick) break;
    seen.add(pick.c);
    chosen.push(pick);
  }
  return {
    chars: chosen,
    elements: chosen.map(x => x.w),
    target,
    count: len
  };
}

if (typeof module !== 'undefined') module.exports = { POOL, WU_XING, wxInfo, pickChar, pickGivenName };