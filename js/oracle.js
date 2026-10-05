// 六爻成卦：每一次觸碰都擲一爻，滿六爻則成名。
//
// 這是整個站的核心機制：卦盤只有六條爻線，點任何地方都會擲下一爻
//（少陰 ⚋ / 少陽 ⚊），並從當前古本抽一個字收進「所收之字」。
// 六爻滿 → 成卦 → 取名 → 卦盤自動歸零重新起卦。
//
// 四部古本共用同一副卦盤，只是成卦後顯出的經文與抽字來源不同：
//   古本易經      → 查六十四卦，得卦名、卦辭、大象
//   古本紫微斗數  → 排命盤，得命宮主星與四化
//   古本山海經    → 擲山海，得山川草木與祥禽異獸
//   古本神農本草  → 開藥櫃，得經方本草之材

import { HEXAGRAMS, HEXAGRAM_BY_LINES, ZIWEI_STARS, ZIWEI_PALACES, ZIWEI_HUA, ZIWEI_SHEN, ZIWEI_AUX, SHANHAI, BENCAO } from './classics.js';
import { pickChar } from './namepool.js';

export const LINE_COUNT = 6;

const pick = (list) => list[(Math.random() * list.length) | 0];

// 擲一爻：true 為少陽 ⚊，false 為少陰 ⚋。爻由初爻往上排。
export const castLine = () => Math.random() < 0.5;

// 為當前古本抽一個字；want 有指定五行時以該行為主，抽不到再放寬到全庫。
export function castChar(book, want = null) {
  const entry = pickChar({ book, want });
  return entry && (!want || entry.w === want) ? entry : pickChar({ want });
}

// 六爻合成後，依當前古本產生「經文面板」內容
export function resolveCasting(book, lines) {
  const bits = lines.map((y) => (y ? '1' : '0')).join('');

  if (book === 'yijing') {
    const hexagram = HEXAGRAM_BY_LINES.get(bits);
    if (hexagram) {
      return {
        kind: 'hexagram',
        seal: hexagram.name[0],
        title: hexagram.name,
        wx: hexagram.wx,
        lines: [
          { k: '卦象', v: `${hexagram.low}下${hexagram.up}上 · ${hexagram.glyph}` },
          { k: '卦辭', v: hexagram.judgement },
          { k: '大象', v: hexagram.image },
        ],
      };
    }
  }

  if (book === 'ziwei') {
    // 以少陽數定命宮位次，排出該宮主星與四化
    const count = lines.filter(Boolean).length;
    const palace = ZIWEI_PALACES[count % ZIWEI_PALACES.length];
    const star = ZIWEI_STARS[count % ZIWEI_STARS.length];
    const hua = ZIWEI_HUA[lines.filter((v) => !v).length % ZIWEI_HUA.length];
    return {
      kind: 'ziwei',
      seal: star.name[0],
      title: star.name,
      wx: star.wx,
      lines: [
        { k: '命宮', v: `${palace.name} · ${palace.note}` },
        { k: '主星', v: `${star.name}（${star.group}）· ${star.note}` },
        { k: '四化', v: `${hua.name} · ${hua.note}` },
        { k: '神曜', v: `${pick(ZIWEI_SHEN)}　${pick(ZIWEI_AUX)}` },
      ],
    };
  }

  if (book === 'shanhai') {
    const section = pick(Object.keys(SHANHAI));
    const entry = pick(SHANHAI[section]);
    return {
      kind: 'shanhai',
      seal: entry.name[0],
      title: entry.name,
      wx: section === '草木' ? '木' : section === '海' ? '水' : '火',
      lines: [
        { k: '篇目', v: `山海經 · ${section}` },
        { k: '所載', v: entry.name },
        { k: '原文意', v: entry.note },
      ],
    };
  }

  const herb = pick(BENCAO);
  return {
    kind: 'bencao',
    seal: herb.name[0],
    title: herb.name,
    wx: herb.wx,
    lines: [
      { k: '出處', v: herb.src },
      { k: '歸經', v: herb.wx2 },
      { k: '性味', v: herb.taste },
      { k: '功用', v: herb.use },
    ],
  };
}

// 測試與介面用的無隨機查詢
export const lookupHexagram = (bits) => HEXAGRAM_BY_LINES.get(bits);
export const ALL_HEXAGRAMS = HEXAGRAMS;