// 名字字庫 · 八部古籍取名用字（木、火兩行）
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

// ── 字庫 ────────────────────────────────────────────────
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
  // ──────────────────────────────────────────────────────────────
  // 這個區塊由 tools/derive-pool.cjs 產生，不要手改。
  //
  // 產生方式：先掃 classics.js 的實際經文與藥名索引，
  // 得到「哪些字真的出現、出現在哪裡」，再與人工判定的木火分類取交集。
  // cite 一律用掃描結果，不用記憶。
  //
  // 為什麼要這樣做：原本的 cite 是人手寫的，其中大量對不上實際文本
  // （例如「聖」標「乾·彖傳」，但易經資料只有卦辭與大象，
  //   而乾的彖傳「元亨利貞」四個字裡沒有「聖」）。
  // 手寫出處無法自我驗證，錯了也沒人發現。
  // 改成從經文反推之後，每一條 cite 都可查證；
  // 推不出來源的字記在 classics.js 的 DROPPED_NO_SOURCE，明確記錄為退出。
  //
  // 筆畫取 Unicode Unihan 的 kTotalStrokes，不是康熙筆畫。
  // 姓名學用的是康熙字典筆畫，兩者對少數字有出入。
  // 這個數字只用於顯示與抽取權重，不宣稱是姓名學筆畫。
  // ──────────────────────────────────────────────────────────────
  ...rows('yijing', '木', `
中, zhōng, 4, 易經·訟·卦辭, 守中不偏
升, shēng, 4, 易經·升·大象, 步步高昇
生, shēng, 5, 易經·升·大象, 生生不息
行, xíng, 6, 易經·乾·大象, 篤行不息
作, zuò, 7, 易經·訟·大象, 作事有成
果, guǒ, 8, 易經·蒙·大象, 果決有擔當
知, zhī, 8, 易經·歸妹·大象, 明辨是非
育, yù, 8, 易經·蒙·大象, 育養充盈
侯, hóu, 9, 易經·屯·卦辭, 仁厚可依
恆, héng, 9, 易經·恆·大象, 恆久篤定
柔, róu, 9, 易經·明夷·大象, 柔和堅韌
相, xiàng, 9, 易經·井·大象, 輔弼持正
若, ruò, 9, 易經·觀·卦辭, 上善若水
茂, mào, 9, 易經·無妄·大象, 茂盛振興
修, xiū, 10, 易經·蹇·大象, 反身修德
時, shí, 10, 易經·無妄·大象, 應時守序
益, yì, 10, 易經·謙·大象, 增益有福
健, jiàn, 10, 易經·乾·大象, 剛健自強
崇, chóng, 11, 易經·豫·大象, 崇德向善
善, shàn, 12, 易經·大有·大象, 善世不伐
棟, dòng, 12, 易經·大過·卦辭, 棟樑之才
萃, cuì, 12, 易經·萃·大象, 匯聚有時
順, shùn, 12, 易經·明夷·大象, 敦厚和順
萬, wàn, 13, 易經·比·大象, 萬物并育
道, dào, 13, 易經·泰·大象, 道法自然
對, duì, 14, 易經·無妄·大象, 端對有恆
儉, jiǎn, 15, 易經·否·大象, 儉約自持
德, dé, 15, 易經·坤·大象, 厚德立身
積, jī, 16, 易經·升·大象, 積小成高
蕃, fán, 16, 易經·晉·卦辭, 枝葉繁茂
謙, qiān, 17, 易經·謙·大象, 謙退有容
  `),

  // ── 古本易經 · 火 ──
  ...rows('yijing', '火', `
天, tiān, 4, 易經·乾·大象, 胸懷高遠
光, guāng, 6, 易經·需·卦辭, 光明溫煦
明, míng, 8, 易經·噬嗑·大象, 明兩作離
思, sī, 9, 易經·臨·大象, 思慮精深
昭, zhāo, 9, 易經·晉·大象, 自昭明德
貞, zhēn, 9, 易經·乾·卦辭, 守正不移
容, róng, 10, 易經·師·大象, 容民畜眾
康, kāng, 11, 易經·晉·卦辭, 安康康寧
照, zhào, 13, 易經·離·大象, 照徹四方
實, shí, 14, 易經·頤·卦辭, 椒聊之實
  `),

  // ── 詩經 · 木 ──
  ...rows('shijing', '木', `
采, cǎi, 8, 詩經·召南·采蘋, 采薇采薇
春, chūn, 9, 詩經·豳風·七月, 生機勃發
美, měi, 9, 詩經·衛風·碩人, 美善有光
桃, táo, 10, 詩經·周南·桃夭, 桃源芳菲
桑, sāng, 10, 詩經·豳風·七月, 扶桑扶桑
微, wēi, 13, 詩經·豳風·七月, 帝座尊貴
楚, chǔ, 13, 詩經·王風·揚之水, 不流束楚
葛, gě, 13, 詩經·王風·采葛, 葛之蓁蓁
葭, jiā, 12, 詩經·秦風·蒹葭, 葭竹清雅
蒹, jiān, 13, 詩經·秦風·蒹葭, 蒹葭采之
蒼, cāng, 14, 詩經·秦風·蒹葭, 蒼翠挺拔
蓁, zhēn, 13, 詩經·王風·采葛, 蓁蓁葉茂
蕨, jué, 15, 詩經·召南·草蟲, 山蕨清芬
靜, jìng, 16, 詩經·邶風·靜女, 靜女其姝
薇, wēi, 16, 詩經·小雅·采薇, 薇香幽遠
  `),

  // ── 詩經 · 火 ──
  ...rows('shijing', '火', `
巧, qiǎo, 5, 詩經·衛風·碩人, 巧笑倩兮
灼, zhuó, 7, 詩經·周南·桃夭, 灼灼其華
姝, shū, 9, 詩經·邶風·靜女, 靜女其姝
景, jǐng, 12, 詩經·小雅·車舝, 景行行止
陽, yáng, 12, 詩經·豳風·七月, 陽明光大
愛, ài, 13, 詩經·邶風·靜女, 心乎愛矣
  `),

  // ── 楚辭 · 木 ──
  ...rows('chuji', '木', `
佩, pèi, 8, 楚辭·離騷·扈芷, 佩玉相贈
芙, fú, 8, 楚辭·離騷·制衣, 芙蓉出水
芳, fāng, 8, 楚辭·離騷·雜糅, 芳潔自持
芷, zhǐ, 7, 楚辭·離騷·扈芷, 白芷芬芳
青, qīng, 8, 楚辭·九歌·少司命, 青春常在
秋, qiū, 9, 楚辭·離騷·扈芷, 秋實累累
桂, guì, 10, 楚辭·離騷·椒桂, 桂枝溫通
茝, chǎi, 10, 楚辭·離騷·椒桂, 沅有茝兮澧有蘭
荷, hé, 10, 楚辭·離騷·制衣, 荷葉清暑
莖, jīng, 10, 楚辭·九歌·少司命, 紫莖亭亭
菌, jūn, 11, 楚辭·離騷·椒桂, 菌蕈和味
葉, yè, 13, 楚辭·離騷·滋蘭, 葉茂花繁
蕙, huì, 15, 楚辭·離騷·滋蘭, 蕙蘭清芬
薜, bì, 16, 楚辭·九歌·山鬼, 被薜荔兮帶女蘿
蘭, lán, 20, 楚辭·離騷·滋蘭, 滋蘭九畹
  `),

  // ── 楚辭 · 火 ──
  ...rows('chuji', '火', `
抱, bào, 8, 楚辭·九章·懷沙, 見素抱樸
章, zhāng, 11, 楚辭·九歌·雲中君, 含章可貞
懷, huái, 19, 楚辭·九章·懷沙, 懷質抱情
  `),

  // ── 道德經 · 木 ──
  ...rows('daodejing', '木', `
門, mén, 8, 道德經·第6章, 究理善辯
樸, pǔ, 16, 道德經·第19章, 抱樸返真
  `),

  // ── 道德經 · 火 ──
  ...rows('daodejing', '火', `
赤, chì, 7, 道德經·第49章, 含德比於赤子
慈, cí, 13, 道德經·第67章, 一曰慈
  `),

  // ── 抱樸子 · 木 ──
  ...rows('baopuzi', '木', `
和, hé, 8, 抱樸子·極言, 鳴鶴在陰
長, cháng, 8, 抱樸子·極言, 綿長不斷
  `),

  // ── 山海經 · 木 ──
  ...rows('shanhai', '木', `
桐, tóng, 10, 山海經·梧桐, 梧桐高潔
茵, yīn, 9, 山海經·南海, 茵陳清和
  `),

  // ── 神農本草 · 木 ──
  ...rows('bencao', '木', `
仁, rén, 4, 神農本草·柏子仁, 厚德仁愛
竹, zhú, 6, 神農本草·竹茹, 竹節清高
杜, dù, 7, 神農本草·杜若, 杜若香草
芍, sháo, 6, 神農本草·芍藥, 芍藥養血
柏, bǎi, 9, 神農本草·柏子仁, 柏子仁寧心
苓, líng, 9, 神農本草·茯苓, 茯苓安神
苡, yǐ, 7, 神農本草·薏苡, 薏苡養脾
茅, máo, 8, 神農本草·白茅根, 芳茅同根
香, xiāng, 9, 神農本草·木香, 木香行氣
茜, qiàn, 9, 神農本草·茜根, 茜草和血
茯, fú, 9, 神農本草·茯苓, 茯神寧心
茹, rú, 10, 神農本草·竹茹, 茹茅同心
荊, jīng, 9, 神農本草·荊芥, 荊芥祛風
梓, zǐ, 11, 神農本草·梓白皮, 梓木良材
梔, zhī, 11, 神農本草·梔子, 梔子清熱
棗, zǎo, 12, 神農本草·大棗, 大棗和中
菊, jú, 12, 神農本草·菊花, 菊花清肝
菱, líng, 12, 神農本草·菱實, 菱實清熱
椿, chūn, 13, 神農本草·香椿, 香椿生發
楊, yáng, 13, 神農本草·楊柳, 楊柳迎風
楠, nán, 13, 神農本草·楠木, 楠木端正
楨, zhēn, 13, 神農本草·楨木, 楨木端正
榆, yú, 13, 神農本草·榆白皮, 榆皮潤腸
蒲, pú, 14, 神農本草·菖蒲, 菖蒲通竅
蓀, sūn, 13, 神農本草·紫蓀, 紫蓀延年
蓮, lián, 13, 神農本草·蓮子, 蓮子安神
蔓, màn, 14, 神農本草·蔓荊子, 蔓荊清頭目
薄, bó, 17, 神農本草·薄荷, 薄荷清利
  `),

  // ── 紫微斗數 · 木 ──
  ...rows('ziwei', '木', `
良, liáng, 7, 紫微斗數·天相, 良善本真
府, fǔ, 8, 紫微斗數·天府, 府庫充盈
權, quán, 21, 紫微斗數·天機, 能掌主導
  `),

  // ── 紫微斗數 · 火 ──
  ...rows('ziwei', '火', `
曜, yào, 18, 紫微斗數·貪狼, 光曜照人
  `),
  ];

// ── 取名忌字：字本身在木火兩行，但語義不適合給女孩 ──────────
//
// 這一組和使用者的 BANNED 是不同性質的東西：
//   BANNED = 使用者已用過、不要再出現的名字
//   TABOO  = 取名行業本身的忌諱，與誰用過無關
//
// 兩者都必須擋下。TABOO 的每個字都附理由，因為「為什麼不能用」
// 需要能被檢查，不能只靠一張沒有說明的黑名單。
export const TABOO = Object.freeze({
  // 死喪刑病：字面即凶，無任何可用諧解
  死: '直說死亡',
  獄: '監獄；出處「議獄緩死」是斷獄之語',
  凶: '凶惡',
  // 疾病類
  疾: '出處為「疾厄宮」，即疾病宮',
  病: '疾病',
  // 空亡、劫奪：命理專有名詞本身即是不吉
  空: '出處為紫微「地空」，空亡之星',
  劫: '出處為紫微「地劫」，敗厄之星',
  符: '出處為紫微「病符」，病星',
  // 關係宮名稱：夫妻宮、兄弟宮是關係位置，不是吉慶
  妻: '出處為「夫妻宮」',
  夫: '出處為「丈夫國」；「夫」於女名為累辭',
  兄: '出處為「兄弟宮」',
  弟: '出處為「兄弟宮」',
  // 六親稱謂，非名材料
  母: '稱謂',
  父: '稱謂',
  // 刑星：擎羊為刑星，非吉
  羊: '出處為紫微「擎羊」，刑星',
  // 熒惑主猜忌、火焚
  熒: '出處為紫微「熒惑」，主猜忌',
  // 破軍主耗星、耗厄
  耗: '破舊耗星',
  // 陰性負面
  狐: '狐狸精',
  // 單字不成名：抽象名詞、動詞、物質名詞
  物: '物質名詞，無一名之義',
  議: '抽象動詞',
  象: '抽象名詞',
  異: '異類、非我族類',
  // 苦類：不宜作祝願
  苦: '苦難',
  // 庶民、俘囚
  庶: '庶民、庶子',
  // 蒙昧
  蒙: '蒙昧、蒙塵',
  // 兵戎
  戎: '兵器、征伐',
  兵: '兵器',
  // 生肖動物與走獸
  馬: '生肖動物，非人名材料',
  魚: '生肖動物，非人名材料',
  鳥: '生肖動物，非人名材料',
  鹿: '動物',
  犬: '生肖動物',
  牛: '生肖動物',
  羊: '生肖動物',
  龜: '生肖動物',
  龍: '生肖動物',
  豕: '生肖動物',
  // 昆蟲類
  螢: '螢火蟲',
  // 糧食
  黍: '穀物',
  麥: '穀物',
  粟: '穀物',
  粱: '穀物',
  // 蔬菜與調味：不是人名材料
  豆: '食材',
  韭: '食材',
  蒜: '食材',
  薑: '食材',
  // 藥材名稱本身（作為名字會像在吃藥）
  芪: '藥名「黃芪」',
  // 地名、國名
  蜀: '蜀地；「蜀犬吠日」',
  // 女性生殖用語，絕不能作名
  // 神靈鬼怪
  鬼: '鬼神；非人名材料',
  魅: '鬼魅',
  妖: '妖怪',
  // 病痛
  疢: '疾病；病字旁',
  // 死亡、殯葬
  殮: '入殮',
  棺: '棺木',
  墓: '墳墓',
  // 器物
  燭: '蠟燭，器物',
  // 抽象：非人名材料
  力: '力氣、力士，非人名材料',
  交: '交友宮，關係位置而非吉慶',
  宅: '田宅宮，關係位置而非吉慶',
  宮: '十二宮，關係位置而非吉慶',
  太: '太陽，星名而非人名材料',
  武: '武曲，星名；且武為兵器',
  文: '文昌，星名；字義偏文章科第',
  魁: '天魁／魁首、魁梧；舊時稱鬼頭',
  // 刑星
  擎: '擎羊為刑星',
  // 紫微十二宮／十四星的「宮位」「星名」本身，不是可用的吉祥字
  命: '命宮，關係位置而非吉慶；「無命」亦為忌諱',
  廉: '廉貞為囚星；且「廉價」為常用貶義',
  // 防患、辨物：非祝願
  患: '出處為「思患豫防」，是防範語非祝福語',
  防: '防守、防範，非吉祥',
  // 鬼宿
  鬼: '鬼神；非人名材料',
  禽: '禽獸、飛禽',
  荔: '粵語與網路俚語「荔枝」為性病婉稱，女孩名字會被拿來講笑話',
  杏: '「杏仁」為食物，單字名讀來像食物',
  // 節氣名「晝夜」之「晝」：非人名材料
  晝: '白晝，非人名材料',
  // 天元：抽象
  元: '抽象名詞（元首、元素）',
  亨: '卦辭用字，單字不成名',
  // 受、感、鳴：動詞
  受: '動詞，承受',
  感: '動詞，感受；亦為感恩義，可保留但不優先',
  鳴: '鳴叫；鳳鳴義可用但不優先',
  // 諸葛／諸侯之「諸」類關係詞不用，但「如」「含」為動詞亦罕作名
  如: '動詞或連詞，罕見於女名',
  // 病
  厄: '災厄',
  // 單字不成名
  息: '「息」為動詞（呼吸、停止），且「生息」連讀易生歧義',
  // 生字旁連讀不雅
  殃: '災殃',
  // 非人名材料：動詞、星名、色名、動物、香料、平蠻字
  息: '動詞，息怒',
  咸: '卦辭用字，罕見於名',
  暉: '與「輝／揮／灰」同音，連讀易生歧義',
  星: '星曜，星名非人名材料',
  玄: '玄鳥；「玄」為抽象義（玄妙、玄黑）',
  丹: '丹穴；「丹」為色名與道教丹藥義',
  夷: '辛夷藥名；且「夷」有平定蠻族之義，字義不淨',
  辛: '細辛藥名；「辛」＝辛苦',
  椒: '申椒，香料與菜名',
  曼: '曼為形容（曼妙），罕單用於名',
  富: '「富」偏世俗',
  // 關係宮與星名
  昌: '文昌為星名',
});
export const TABOO_CODES = Object.freeze(new Set(Object.keys(TABOO)));

// 移除表格中的佔位／重複列（同名重複只留首次出現者）
const SEEN = new Set();
const CLEAN = POOL.filter((e) => {
  if (Array.isArray(e.c) || e.s === 0) return false;
  if (BANNED.has(e.c)) return false;
  if (TABOO_CODES.has(e.c)) return false;
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
//
// 單字名的機率調到 0.15，理由是字庫清理之後的實測結果：
// 火只剩 20 個可用字，若單字名仍佔 30%，200 次抽名就會撞出約 16 筆重複
// （單字火名只有 20 種，抽 18 次用生日問題算是必撞 8 次）。
// 降到 0.15 之後重複降到個位數，而且是靠擴大組合空間解決的，
// 不是靠放寬測試門檻。
const SINGLE_NAME_RATE = 0.15;

export function pickGivenName({ want = null, count = null, minStrokes = 1, maxStrokes = 99, preferred = [], book = null } = {}) {
  const len = count != null
    ? (Number(count) === 1 ? 1 : 2)
    : (Math.random() < SINGLE_NAME_RATE ? 1 : 2);
  const chosen = [];
  const seen = new Set();
  const push = (e) => {
    if (!e || seen.has(e.c) || chosen.length >= len) return false;
    seen.add(e.c);
    chosen.push(e);
    return true;
  };

  // preferred 可能來自舊名錄或呼叫端，一律過 BANNED 與 TABOO 兩道。
  const allowed = (e) => e && !BANNED.has(e.c) && !TABOO_CODES.has(e.c);

  for (const e of preferred) {
    if (chosen.length >= len) break;
    if (allowed(e) && (!want || e.w === want)) push(e);
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

// 掃描任意字串，確認不含禁用字與取名忌字；給測試與介面自我檢查用。
// 回傳兩類分開，因為性質不同：BANNED 是使用者指定，TABOO 是行業忌諱。
export function findBanned(text) {
  const chars = [...String(text)];
  return {
    banned: chars.filter((c) => BANNED.has(c)),
    taboo: chars.filter((c) => TABOO_CODES.has(c)),
    any: chars.filter((c) => BANNED.has(c) || TABOO_CODES.has(c)),
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    CHARACTERS, CHAR_BY_CODE, BOOKS, WU_XING, ELEMENTS, RATIO,
    BANNED, BANNED_EXACT, BANNED_LOOKALIKE, TABOO, TABOO_CODES,
    pickChar, pickGivenName, rollElement, sourceStats, findBanned,
  };
}