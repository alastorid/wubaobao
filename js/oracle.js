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
//   古本道德經    → 依六爻定章，得老子八十一章的章句
//   古本抱樸子    → 依六爻定篇，得葛洪內篇的篇旨
//   古本詩經      → 依六爻定篇，得風雅頌的名句
//   古本楚辭      → 依六爻定篇，得離騷九歌的名句

import { HEXAGRAMS, HEXAGRAM_BY_LINES, ZIWEI_STARS, ZIWEI_PALACES, ZIWEI_HUA, ZIWEI_SHEN, ZIWEI_AUX, SHANHAI, BENCAO, DAODEJING, BAOPUZI, SHIJING, CHUCI } from './classics.js';
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

  if (book === 'shijing') {
    const poem = SHIJING[parseInt(bits, 2) % SHIJING.length];
    return {
      kind: 'shijing',
      seal: '詩',
      title: `${poem.part}·${poem.title}`,
      wx: '木',
      lines: [
        { k: '出處', v: `詩經 · ${poem.part} · ${poem.title}` },
        { k: '篇名', v: poem.title },
        { k: '經文', v: poem.text },
      ],
    };
  }

  if (book === 'chuji') {
    const poem = CHUCI[parseInt(bits, 2) % CHUCI.length];
    return {
      kind: 'chuji',
      seal: '騷',
      title: `${poem.part}·${poem.title}`,
      wx: '木',
      lines: [
        { k: '出處', v: `楚辭 · ${poem.part} · ${poem.title}` },
        { k: '篇名', v: poem.title },
        { k: '經文', v: poem.text },
      ],
    };
  }

  if (book === 'daodejing') {
    // 六爻直接定章：同一副卦得同一章，與易經一致
    const bits = lines.map((y) => (y ? '1' : '0')).join('');
    const chapter = DAODEJING[parseInt(bits, 2) % DAODEJING.length];
    return {
      kind: 'daodejing',
      seal: '道',
      title: `第${chapter.ch}章　${chapter.title}`,
      wx: '火',
      lines: [
        { k: '出處', v: `道德經 · 第${chapter.ch}章` },
        { k: '章名', v: chapter.title },
        { k: '經文', v: chapter.text },
      ],
    };
  }

  if (book === 'baopuzi') {
    const bits = lines.map((y) => (y ? '1' : '0')).join('');
    const item = BAOPUZI[parseInt(bits, 2) % BAOPUZI.length];
    return {
      kind: 'baopuzi',
      seal: '樸',
      title: `${item.part}　${item.title}`,
      wx: '木',
      lines: [
        { k: '出處', v: `抱樸子 · ${item.part} · ${item.title}` },
        { k: '篇旨', v: item.text },
        { k: '作者', v: '葛洪　晉' },
      ],
    };
  }

  // 神農本草：這裡是「藥名索引」，不是引文。
  // 本站沒有《本草經》的原文，所以面板只呈現藥名與出處，
  // 不列現代中藥學的歸經、性味、功用——那會讓人誤以為是古籍內容。
  const herb = pick(BENCAO);
  return {
    kind: 'bencao',
    seal: herb[0],
    title: herb,
    wx: '木',
    lines: [
      { k: '出處', v: `神農本草 · ${herb}` },
      { k: '說明', v: '《神農本草經》收載之藥名。本站只列藥名索引，不引經文。' },
    ],
  };
}

// 測試與介面用的無隨機查詢
export const lookupHexagram = (bits) => HEXAGRAM_BY_LINES.get(bits);
export const ALL_HEXAGRAMS = HEXAGRAMS;