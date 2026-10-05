// 名字字庫 · 古本四部取名用字
//
// 喜用神只有木、火：原局木弱，火雖有而不得令，故木為喜用、火為次用。
// 木約七成、火約三成 —— 喜木而不狂補火。本庫所有字都只屬木、火兩行。
//
// 每個字附：
//   c        字（繁體）
//   p        漢語拼音
//   s        繁體實寫筆畫數（Unicode 17.0 Unihan kTotalStrokes；多值採後值）
//   w        五行：本庫只收木、火兩行
//   book     出處古本：yijing / ziwei / shanhai / bencao
//   cite     書中出處（卦·篇 / 星·宮 / 山海篇目 / 藥名）
//   meaning  起名寓意：給孩子的祝願，並非字典完整釋義
//
// 說明：出處是「取名用典」索引，標明該字取自哪一部、哪一篇，不代表字只見於該處。
//      五行歸屬各姓名學派別有出入，本庫提供固定分類供遊戲使用。

// ── 禁用字：使用者指定排除的名 ──────────────────────────
export const BANNED_EXACT = Object.freeze(
  '丞以品妍妤宇宥宸希彤恩承晨晴樂沁沐泓涵淇淳渝澄熙睿祐語霏霖'.split(''),
);
// 連帶排除的近形近音字，避免與上列混淆
export const BANNED_LOOKALIKE = Object.freeze(
  '佑右辰曦琪祺純瑜愉橙叡晶'.split(''),
);
export const BANNED = Object.freeze(new Set([...BANNED_EXACT, ...BANNED_LOOKALIKE]));

// ── 五行：喜用神只有木、火 ──────────────────────────────
export const WU_XING = Object.freeze({
  木: { label: '木', icon: '🌿', color: '#3f7a4e', role: '喜用 · 首選', ratio: 0.7 },
  火: { label: '火', icon: '🔥', color: '#a8412c', role: '次用 · 輔助', ratio: 0.3 },
});
export const ELEMENTS = Object.freeze(Object.keys(WU_XING));
// 木為喜用，火為次用：木約七成、火約三成
export const RATIO = Object.freeze({ 木: 0.7, 火: 0.3 });

// ── 古本四部取名用字 ────────────────────────────────────
// 格式：「字, 拼音, 筆畫, 出處, 寓意」
function rows(book, w, text) {
  return text
    .trim()
    .split('\n')
    .map((line) => {
      const [c, p, s, cite, meaning] = line.split(',').map((v) => v.trim());
      return Object.freeze({ c, p, s: Number(s), w, book, cite, meaning });
    });
}

const POOL = [
  // ── 古本易經 · 木 ──────────────────────────────────
  ...rows('yijing', '木', `
仁, rén, 4, 坤·象, 厚德仁愛
行, xíng, 6, 乾·彖, 篤行不息
升, shēng, 4, 升·象, 步步高昇
良, liáng, 7, 坤·文言, 良善本真
作, zuò, 7, 離·象, 作事有成
青, qīng, 8, 艮·彖, 青春常在
育, yù, 8, 無妄·象, 育養充盈
物, wù, 8, 無妄·象, 物類豐饒
茂, mào, 8, 無妄·象, 茂盛振興
果, guǒ, 8, 蒙·象, 果決有擔當
林, lín, 8, 說卦·震, 東方生木
茅, máo, 8, 泰·初九, 芳茅同根
和, hé, 8, 中孚·九二, 鳴鶴在陰
時, shí, 10, 無妄·象, 應時守序
健, jiàn, 10, 乾·象, 剛健自強
侯, hóu, 9, 屯·初九, 仁厚可依
桓, huán, 10, 屯·初九, 磐桓有守
崇, chóng, 11, 豫·象, 崇德向善
長, cháng, 8, 坤·彖, 綿長不斷
春, chūn, 9, 說卦·震, 生機勃發
修, xiū, 9, 蹇·象, 反身修德
衍, yǎn, 9, 繫辭, 衍展無窮
茹, rú, 9, 泰·初九, 茹茅同心
柔, róu, 9, 晉·六二, 柔和堅韌
恆, héng, 9, 恆·象, 恆久篤定
彙, huì, 13, 泰·初九, 匯聚成林
象, xiàng, 11, 繫辭, 觀物取象
庶, shù, 11, 賁·象, 眾多溫厚
萃, cuì, 11, 萃·彖, 匯聚有時
棟, dòng, 12, 大過·辭, 棟樑之才
順, shùn, 12, 坤·象, 敦厚和順
善, shàn, 12, 兌·彌傳, 善世不伐
聖, shèng, 13, 乾·彌傳, 聖賢之德
嘉, jiā, 14, 乾·彌傳, 嘉美相會
蕃, fán, 15, 晉·象, 枝葉繁茂
德, dé, 15, 艮·象, 厚德立身
對, duì, 14, 無妄·象, 端對有恆
萬, wàn, 12, 無妄·象, 萬物并育
蒙, méng, 13, 蒙·彖, 蒙養有功
益, yì, 10, 益·象, 增益有福
蓍, shī, 13, 繫辭, 蓍草通靈
積, jī, 16, 升·象, 積小成高
隱, yǐn, 16, 遯·象, 潛隱自守
議, yì, 20, 中孚·象, 明議慎斷
謙, qiān, 17, 謙·象, 謙退有容
`),

  // ── 古本紫微斗數 · 木 ──────────────────────────────
  ...rows('ziwei', '木', `
相, xiàng, 9, 天相, 輔弼持正
科, kē, 9, 化科, 名聲科第
門, mén, 8, 巨門, 究理善辯
府, fǔ, 8, 天府, 府庫充盈
梁, liáng, 11, 天梁, 蔭庇老成
符, fú, 11, 病符, 化煞成福
微, wēi, 13, 紫微, 帝座尊貴
機, jī, 16, 天機, 智慧善謀
權, quán, 21, 化權, 能掌主導
`),

  // ── 古本山海經 · 木 ────────────────────────────────
  ...rows('shanhai', '木', `
扶, fú, 7, 扶桑, 扶桑之木
桑, sāng, 10, 扶桑, 扶桑扶桑
崑, kūn, 11, 崑崙, 崑崙之柱
桐, tóng, 10, 梧桐, 梧桐高潔
桃, táo, 10, 桃林, 桃源芳菲
梧, wú, 11, 梧桐, 梧庭清蔭
棻, fēn, 11, 棻, 棻木成林
崙, lún, 11, 崑崙, 崑崙峻極
龜, guī, 17, 旋龜, 靈龜壽永
`),

  // ── 古本神農本草 · 木 ──────────────────────────────
  ...rows('bencao', '木', `
竹, zhú, 6, 本經·竹茹, 竹節清高
芋, yù, 6, 本經·芋, 芋艿綿延
芝, zhī, 6, 本經·靈芝, 靈芝延年
芍, sháo, 6, 本經·芍藥, 芍藥養血
芃, péng, 6, 本經·芃, 草木蓬勃
芊, qiān, 6, 本經·芊, 芊芊眾草
芙, fú, 7, 本經·芙蓉, 芙蓉出水
芮, ruì, 7, 本經·芮草, 小草自強
芷, zhǐ, 7, 本經·白芷, 白芷芬芳
苡, yǐ, 7, 本經·薏苡, 薏苡養脾
芪, qí, 7, 本經·黃芪, 黃芪補氣
荊, jīng, 9, 本經·荊芥, 荊芥祛風
杏, xìng, 7, 本經·杏仁, 杏仁潤肺
芸, yún, 7, 本經·芸香, 芸香辟穢
芹, qín, 7, 本經·芹菜, 芹菜清潤
杉, shān, 7, 本經·杉葉, 杉葉挺直
松, sōng, 8, 本經·松脂, 松貞不折
苦, kǔ, 8, 本經·苦參, 苦而能降
苓, líng, 8, 本經·茯苓, 茯苓安神
茗, míng, 9, 本經·茗茶, 茗香清心
柏, bǎi, 9, 本經·柏子仁, 柏子仁寧心
茯, fú, 9, 本經·茯苓, 茯神寧心
茜, qiàn, 9, 本經·茜草, 茜草和血
茵, yīn, 9, 本經·茵陳, 茵陳清和
香, xiāng, 9, 本經·木香, 木香行氣
蕙, huì, 15, 本經·蕙草, 蕙蘭清芬
榛, zhēn, 14, 本經·榛實, 榛實溫潤
荃, quán, 9, 本經·荃草, 荃蘭之香
桔, jié, 10, 本經·枳殼, 桔井甘泉
荷, hé, 10, 本經·荷葉, 荷葉清暑
桂, guì, 10, 本經·桂枝, 桂枝溫通
菊, jú, 11, 本經·菊花, 菊花清肝
菌, jūn, 11, 本經·菌蕈, 菌蕈和味
楨, zhēn, 13, 本經·楨木, 楨木端正
梅, méi, 11, 本經·烏梅, 梅骨傲雪
梓, zǐ, 11, 本經·梓皮, 梓木良材
麥, mài, 11, 本經·小麥, 麥養心脾
菁, jīng, 11, 本經·蔓荊子, 蔓荊清利
梵, fàn, 11, 本經·梵木, 梵木清寂
菱, líng, 11, 本經·菱實, 菱實清熱
棗, zǎo, 12, 本經·大棗, 大棗和中
梔, zhī, 11, 本經·梔子, 梔子清熱
粟, sù, 12, 本經·粟米, 粟米養胃
棉, mián, 12, 本經·棉花, 棉花溫軟
蔓, màn, 14, 本經·蔓荊, 蔓荊清頭目
棠, táng, 12, 本經·海棠, 海棠芳菲
萱, xuān, 12, 本經·萱草, 萱草忘憂
葵, kuí, 12, 本經·冬葵, 冬葵滑利
葦, wěi, 12, 本經·葦根, 葦根清熱
葳, wēi, 12, 本經·葳蕤, 葳蕤滋陰
葯, yào, 12, 本經·草藥, 草藥濟人
楠, nán, 13, 本經·楠木, 楠木端正
楊, yáng, 13, 本經·楊柳, 楊柳迎風
榆, yú, 13, 本經·榆白皮, 榆皮潤腸
槐, huái, 13, 本經·槐花, 槐花清熱
棣, dì, 12, 本經·棣葉, 棣萼同心
椿, chūn, 13, 本經·香椿, 香椿生發
楓, fēng, 13, 本經·楓香脂, 楓香通竅
樺, huà, 14, 本經·樺皮, 樺皮通經
槿, jǐn, 15, 本經·木槿花, 朝開暮落
蒲, pú, 13, 本經·菖蒲, 菖蒲通竅
蕎, qiáo, 15, 本經·蕎麥, 蕎麥和脾
蕤, ruí, 15, 本經·蕤蕤, 蕤蕤葉嫩
蕊, ruǐ, 15, 本經·花蕊, 花蕊含英
蓮, lián, 13, 本經·蓮子, 蓮子安神
薇, wēi, 16, 本經·薇香, 薇香幽遠
樾, yuè, 16, 本經·樹樾, 樹樾庇蔭
蕾, lěi, 16, 本經·蕾葉, 蕾葉含苞
薄, bó, 16, 本經·薄荷, 薄荷清利
蓁, zhēn, 13, 本經·蓁蓁, 蓁蓁葉茂
蓀, sūn, 13, 本經·紫蓀, 紫蓀延年
蔘, shēn, 13, 本經·人參, 人參大補
`),

  // ── 古本詩經 · 木 ──────────────────────────────────
  ...rows('shijing', '木', `
采, cǎi, 8, 小雅·采薇, 采薇采薇
佩, pèi, 8, 鄭風·有女同車, 佩玉相贈
蕙, huì, 15, 召南·采蘩, 蕙草清芬
靜, jìng, 16, 邶風·靜女, 靜女其姝
楚, chǔ, 13, 王風·揚之水, 不流束楚
葛, gě, 12, 王風·采葛, 葛之蓁蓁
`),

  // ── 古本詩經 · 火 ──────────────────────────────────
  ...rows('shijing', '火', `
巧, qiǎo, 5, 衛風·碩人, 巧笑倩兮
灼, zhuó, 7, 周南·桃夭, 灼灼其華
姝, shū, 9, 邶風·靜女, 靜女其姝
愛, ài, 13, 鄭風·褰裳, 心乎愛矣
倩, qiàn, 10, 衛風·碩人, 巧笑倩兮
`),

  // ── 古本楚辭 · 木 ──────────────────────────────────
  ...rows('chuji', '木', `
芳, fāng, 7, 離騷·雜糅, 芳潔自持
杜, dù, 7, 離騷·制衣, 杜若香草
茝, chǎi, 10, 九歌·湘夫人, 沅有茝兮澧有蘭
薜, bì, 16, 九歌·山鬼, 被薜荔兮帶女蘿
荔, lì, 9, 九歌·山鬼, 薜荔垂蔭
蘭, lán, 20, 離騷·滋蘭, 滋蘭九畹
`),

  // ── 古本楚辭 · 火 ──────────────────────────────────
  ...rows('chuji', '火', `
椒, jiāo, 12, 離騷·椒桂, 申椒菌桂
曼, màn, 11, 離騷·路漫, 漫漫其修遠
懷, huái, 19, 離騷·懷質, 懷質抱情
`),

  // ── 古本道德經 · 木 ──────────────────────────────────
  ...rows('daodejing', '木', `
中, zhōng, 4, 道德經·五章, 守中不偏
若, ruò, 8, 道德經·八章, 上善若水
美, měi, 9, 道德經·二章, 美善有光
儉, jiǎn, 15, 道德經·六十七章, 儉約自持
樸, pǔ, 16, 道德經·十九章, 抱樸返真
`),

  // ── 古本道德經 · 火 ──────────────────────────────────
  ...rows('daodejing', '火', `
赤, chì, 7, 道德經·四十九章, 含德比於赤子
抱, bào, 8, 道德經·十九章, 見素抱樸
富, fù, 12, 道德經·三十三章, 知足者富
敦, dūn, 12, 道德經·五十六章, 敦兮其若朴
慈, cí, 13, 道德經·六十七章, 一曰慈
`),

  // ── 古本抱樸子 · 木 ──────────────────────────────────
  ...rows('baopuzi', '木', `
誠, chéng, 13, 抱樸子·內篇·誠實, 誠實為本
`),

  // ── 古本抱樸子 · 火 ──────────────────────────────────
  ...rows('baopuzi', '火', `
忠, zhōng, 8, 抱樸子·內篇·忠臣, 盡忠不阿
煉, liàn, 13, 抱樸子·內篇·極論, 煉養延年
壽, shòu, 14, 抱樸子·內篇·極論, 養生致壽
`),

  // ── 古本易經 · 火 ──────────────────────────────────
  ...rows('yijing', '火', `
天, tiān, 4, 乾·彌傳, 胸懷高遠
元, yuán, 4, 乾·彌傳, 元氣充沛
生, shēng, 5, 乾·彌傳, 生生不息
死, sǐ, 6, 中孚·象, 生死有命
光, guāng, 6, 離·象, 光明溫煦
照, zhào, 13, 離·象, 照徹四方
明, míng, 8, 離·象, 明兩作離
亨, hēng, 7, 乾·彌傳, 萬物亨通
含, hán, 7, 坤·彖, 含弘光大
如, rú, 6, 屯·上六, 如意稱心
狐, hú, 8, 未濟·彖, 謹慎如狐
受, shòu, 8, 咸·象, 虛心能受
思, sī, 9, 艮·象, 思慮精深
咸, xián, 9, 咸·彌傳, 咸感遂通
貞, zhēn, 9, 乾·彖, 守正不移
昭, zhāo, 9, 晉·象, 自昭明德
朗, lǎng, 10, 繫辭, 日月為朗
容, róng, 10, 師·象, 容民畜眾
康, kāng, 11, 晉·彖, 安康康寧
章, zhāng, 11, 坤·彖, 含章可貞
晝, zhòu, 11, 晉·彖, 日夜有恆
患, huàn, 11, 既濟·象, 思患豫防
發, fā, 12, 乾·彌傳, 發育萬物
暉, huī, 13, 繫辭, 日月之暉
感, gǎn, 13, 咸·彌傳, 感而遂通
鳴, míng, 14, 中孚·彌傳, 鳴鶴在陰
防, fáng, 6, 既濟·象, 防患未然
獄, yù, 14, 中孚·象, 議獄緩死
鶴, hè, 21, 中孚·九二, 鳴鶴九二
辨, biàn, 16, 未濟·象, 慎辨物居
`),

  // ── 古本紫微斗數 · 火 ──────────────────────────────
  ...rows('ziwei', '火', `
力, lì, 2, 力士, 氣力充沛
太, tài, 4, 太陽, 太陽中天
文, wén, 4, 文昌, 文采斐然
羊, yáng, 6, 擎羊, 擎羊得力
同, tóng, 6, 天同, 天同福德
交, jiāo, 6, 交友宮, 善交遠近
宅, zhái, 6, 田宅宮, 宅第安穩
弟, dì, 7, 兄弟宮, 兄弟和睦
劫, jié, 7, 地劫, 地劫化用
兄, xiōng, 5, 兄弟宮, 兄友弟恭
武, wǔ, 8, 武曲, 武曲剛毅
星, xīng, 9, 星曜, 星曜朗照
命, mìng, 8, 命宮, 命宮樞紐
空, kōng, 8, 地空, 地空求實
昌, chāng, 8, 文昌, 昌明天文
妻, qī, 8, 夫妻宮, 夫妻和順
宮, gōng, 10, 十二宮, 宮位有恆
疾, jí, 10, 疾厄宮, 疾厄有守
息, xī, 10, 息神, 息怒養神
移, yí, 11, 遷移宮, 遷移得助
喜, xǐ, 12, 喜神, 喜氣盈門
陽, yáng, 11, 太陽, 陽明光大
廉, lián, 13, 廉貞, 廉貞剛正
魁, kuí, 13, 天魁, 天魁夾輔
熒, yíng, 14, 熒惑, 熒惑成器
馬, mǎ, 10, 天馬, 天馬奔騰
曜, yào, 18, 星曜, 光曜照人
龍, lóng, 16, 龍池, 龍池煥彩
擎, qíng, 16, 擎羊, 擎羊開路
`),

  // ── 古本山海經 · 火 ────────────────────────────────
  ...rows('shanhai', '火', `
丹, dān, 4, 丹穴之山, 丹穴燭光
夫, fū, 4, 丈夫國, 丈夫之志
玄, xuán, 5, 玄鳥, 玄鳥司雨
鹿, lù, 11, 鹿蜀, 鹿蜀祥瑞
鳥, niǎo, 11, 鳳凰, 鳳鳥嘉祥
魚, yú, 11, 魚所處, 魚躍於淵
異, yì, 11, 異獸, 異獸獻瑞
蜀, shǔ, 13, 鹿蜀, 蜀地靈秀
精, jīng, 14, 精衛, 精衛填海
燭, zhú, 17, 燭陰, 燭照幽冥
`),

  // ── 古本神農本草 · 火 ──────────────────────────────
  ...rows('bencao', '火', `
夷, yí, 6, 本經·辛夷, 辛夷通竅
辛, xīn, 7, 本經·細辛, 細辛通脈
豆, dòu, 7, 本經·大豆, 大豆養脾
韭, jiǔ, 9, 本經·韭菜, 韭健溫中
黍, shǔ, 12, 本經·黍米, 黍米溫潤
粱, liáng, 13, 本經·粱米, 粱米厚養
`),
];

// 移除表格中的佔位／重複列（同名重複只留首次出現者）
const SEEN = new Set();
const CLEAN = POOL.filter((e) => {
  if (Array.isArray(e.c) || e.s === 0) return false;
  if (BANNED.has(e.c)) return false;
  if (SEEN.has(e.c)) return false;
  SEEN.add(e.c);
  return true;
});

export const CHARACTERS = Object.freeze(CLEAN);
export const CHAR_BY_CODE = new Map(CHARACTERS.map((e) => [e.c, e]));

// ── 統計 ────────────────────────────────────────────────
// 古本清單由實際字庫推導，日後增刪古本不必改這裡
export const BOOKS = Object.freeze([...new Set(CHARACTERS.map((e) => e.book))]);

export const sourceStats = () => {
  const by = {};
  for (const w of ELEMENTS) {
    by[w] = {
      total: CHARACTERS.filter((e) => e.w === w).length,
      books: Object.fromEntries(
        BOOKS.map((b) => [b, CHARACTERS.filter((e) => e.w === w && e.book === b).length]),
      ),
    };
  }
  return by;
};

// ── 抽字 ────────────────────────────────────────────────
const weightedPick = (list, weightOf) => {
  let total = 0;
  for (const e of list) total += weightOf(e);
  if (total <= 0) return list[(Math.random() * list.length) | 0] || null;
  let roll = Math.random() * total;
  for (const e of list) {
    roll -= weightOf(e);
    if (roll <= 0) return e;
  }
  return list[list.length - 1] || null;
};

// 筆畫偏好：4～14 畫最宜取名，越近加權越高
const strokeWeight = (e) => {
  const d = Math.abs(e.s - 9);
  return d <= 5 ? 3 : 1;
};

// 依喜用神抽五行：木約七成、火約三成
export function rollElement(want) {
  if (want && WU_XING[want]) return want;
  return Math.random() < RATIO.木 ? '木' : '火';
}

function candidates({ want, book, minStrokes = 1, maxStrokes = 99 }) {
  let list = CHARACTERS.filter(
    (e) => e.s >= minStrokes && e.s <= maxStrokes && (!book || e.book === book),
  );
  if (!want) return list;
  const inElement = list.filter((e) => e.w === want);
  // 指定喜用神但該書無字時，放寬到全庫該行，再放寬到全庫
  return inElement.length ? inElement : CHARACTERS.filter((e) => e.w === want);
}

export function pickChar({ want = null, book = null, minStrokes = 1, maxStrokes = 99 } = {}) {
  const target = want && WU_XING[want] ? want : rollElement(want);
  let pool = candidates({ want: target, book, minStrokes, maxStrokes });
  let pick = weightedPick(pool, strokeWeight);
  if (!pick && book) pick = weightedPick(candidates({ want: target, minStrokes, maxStrokes }), strokeWeight);
  return pick || weightedPick(CHARACTERS, strokeWeight);
}

// 依喜用神抽出 1～2 個相異美字。
// preferred（已收之字）優先採用；want 為 null 時每字各自按木七火三抽。
export function pickGivenName({ want = null, count = null, minStrokes = 1, maxStrokes = 99, preferred = [], book = null } = {}) {
  const len = count != null ? (Number(count) === 1 ? 1 : 2) : Math.random() < 0.3 ? 1 : 2;
  const chosen = [];
  const seen = new Set();
  const push = (e) => {
    if (!e || seen.has(e.c) || chosen.length >= len) return false;
    seen.add(e.c);
    chosen.push(e);
    return true;
  };

  for (const e of preferred) {
    if (chosen.length >= len) break;
    if (e && !BANNED.has(e.c) && (!want || e.w === want)) push(e);
  }

  let guard = 0;
  while (chosen.length < len && guard++ < 40) {
    const target = want && WU_XING[want] ? want : rollElement(want);
    // 先從指定古本抽；該古本這一行不夠湊兩個字時，放寬到全庫該行。
    // 抱樸子這類古本可用的字少，但名字絕不能因此抽不出來。
    let pool = candidates({ want: target, book, minStrokes, maxStrokes }).filter((e) => !seen.has(e.c));
    let entry = weightedPick(pool, strokeWeight);
    if (!entry) {
      pool = candidates({ want: target, minStrokes, maxStrokes }).filter((e) => !seen.has(e.c));
      entry = weightedPick(pool, strokeWeight);
    }
    if (!entry) break;
    push(entry);
  }

  return {
    chars: chosen,
    elements: chosen.map((e) => e.w),
    count: len,
  };
}

// 掃描任意字串，確認不含禁用字；給測試與介面自我檢查用
export function findBanned(text) {
  return [...String(text)].filter((c) => BANNED.has(c));
}

if (typeof module !== 'undefined') {
  module.exports = {
    CHARACTERS, BOOKS, WU_XING, ELEMENTS, RATIO, BANNED, BANNED_EXACT, BANNED_LOOKALIKE,
    pickChar, pickGivenName, rollElement, sourceStats, findBanned,
  };
}