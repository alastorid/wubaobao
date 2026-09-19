// 好字消消樂：三張配對、立體疊牌；每次觸碰都有取名能量。
import { SoundGarden } from "./audio.js";
const $ = (id) => document.getElementById(id);
const sound = new SoundGarden();
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const colors = [
  ["#ec739d", "#bc507f", "#ffe1ed", "✿"],
  ["#65af64", "#428e49", "#e0f3cb", "♧"],
  ["#6aacf1", "#4d7fb9", "#dcedff", "◆"],
  ["#b481dc", "#8c5ab9", "#f0e2ff", "✦"],
  ["#e4a540", "#b7802d", "#fff0c4", "☀"],
  ["#46b8bd", "#288c98", "#d6f5ef", "❋"],
];
let tiles = [],
  tray = [],
  caught = [],
  names = [],
  energy = 0,
  target = "auto";
let level = 1,
  matches = 0,
  score = 0,
  initialCount = 0,
  lastPick = null,
  goldChoice = null;
let nextTimer,
  revealTimer,
  toastTimer,
  pointer = null;
const stats = { selections: 0, reveals: 0, goldSelections: 0, rescues: 0 };
const shuffled = (array) => {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
function covered(tile, pool = tiles) {
  return pool.some(
    (t) =>
      t.state === "board" &&
      t.layer > tile.layer &&
      Math.abs(t.x - tile.x) < 1.04 &&
      Math.abs(t.y - tile.y) < 1.08,
  );
}
function makeBoard() {
  clearTimeout(nextTimer);
  tray = [];
  lastPick = null;
  matches = 0;
  tiles = [];
  // 五層錯位菱形堆疊；覆蓋關係與畫面座標一致。
  for (let layer = 0; layer < 5; layer++) {
    const size = 7 - layer;
    for (let row = 0; row < size; row++)
      for (let col = 0; col < size; col++) {
        const x = col - (size - 1) / 2,
          y = row - (size - 1) / 2;
        if (Math.abs(x) + Math.abs(y) > (size + 1) / 2) continue;
        tiles.push({
          id: tiles.length,
          x,
          y: y - layer * 0.1,
          layer,
          state: "board",
          entry: null,
          color: 0,
          gold: false,
        });
      }
  }
  while (tiles.length % 3) tiles.pop();
  initialCount = tiles.length;
  assignEntries();
  renderBoard();
  renderTray();
  updateRound();
}
function assignEntries() {
  // 按合法取牌順序每三張配同一字，保證重排後至少有一條可解路徑。
  const pool = tiles.filter((t) => t.state === "board").map((t) => ({ ...t }));
  const order = [];
  while (pool.some((t) => t.state === "board")) {
    const available = pool.filter(
      (t) => t.state === "board" && !covered(t, pool),
    );
    const chosen = available[Math.floor(Math.random() * available.length)];
    order.push(tiles.find((t) => t.id === chosen.id));
    chosen.state = "removed";
  }
  let options = shuffled(
    POOL.all.filter(
      (e) => e.b === 1 && e.s <= 8 && (target === "auto" || e.w === target),
    ),
  );
  options = options.slice(0, Math.min(10, options.length));
  for (let i = 0; i < order.length; i++) {
    const type = Math.floor(i / 3) % options.length;
    Object.assign(order[i], {
      entry: options[type],
      color: type % colors.length,
      gold: type === options.length - 1,
      solution: i,
    });
  }
}
function tileElement(t, miniature = false) {
  const el = document.createElement(miniature ? "div" : "button");
  el.className = "tile" + (t.gold ? " gold" : "");
  const [face, shade, tint, symbol] = colors[t.color];
  el.style.setProperty("--face", face);
  el.style.setProperty("--shade", shade);
  el.style.setProperty("--tint", tint);
  const glyph = document.createElement("span");
  glyph.className = "tile-glyph";
  glyph.textContent = t.entry.c;
  const icon = document.createElement("span");
  icon.className = "tile-symbol";
  icon.textContent = t.gold ? "★" : symbol;
  el.append(glyph, icon);
  if (!miniature) {
    el.dataset.id = t.id;
    el.setAttribute(
      "aria-label",
      `${t.entry.c}，${t.entry.s}畫${t.gold ? "，金色祝福牌" : ""}`,
    );
    el.onclick = (e) => {
      if (e.detail === 0) {
        sound.unlock();
        selectTile(t);
        addEnergy(10);
      }
    };
  }
  return el;
}
function renderBoard() {
  const fragment = document.createDocumentFragment();
  for (const t of tiles.filter((t) => t.state === "board")) {
    const el = tileElement(t);
    t.el = el;
    el.style.zIndex = t.layer * 10 + 1;
    fragment.append(el);
  }
  $("board").replaceChildren(fragment);
  layout();
  updateBlocked();
}
function layout() {
  const r = $("board").getBoundingClientRect();
  const size = Math.min(r.width / 7.4, r.height / 7.8, 83);
  $("board").style.setProperty("--tile", size + "px");
  for (const t of tiles.filter((t) => t.state === "board")) {
    t.el.style.left = r.width / 2 + t.x * size * 0.97 + "px";
    t.el.style.top = r.height / 2 + t.y * size * 1.01 + size * 0.12 + "px";
  }
}
function updateBlocked() {
  for (const t of tiles.filter((t) => t.state === "board")) {
    const blocked = covered(t);
    t.el.classList.toggle("blocked", blocked);
    t.el.setAttribute("aria-disabled", String(blocked));
    t.el.tabIndex = blocked ? -1 : 0;
  }
}
function renderTray() {
  const f = document.createDocumentFragment();
  for (let i = 0; i < 7; i++) {
    const slot = document.createElement("div");
    slot.className = "tray-slot";
    if (tray[i]) slot.append(tileElement(tray[i], true));
    f.append(slot);
  }
  $("tray").replaceChildren(f);
}
function burst(x, y, big = false) {
  if (reduced) return;
  const root = $("effects");
  for (let i = 0; i < (big ? 30 : 10) && root.childElementCount < 96; i++) {
    const p = document.createElement("i");
    p.className = "spark";
    p.style.left = x + "px";
    p.style.top = y + "px";
    p.style.background = [
      "#ffc963",
      "#ee91b5",
      "#a58add",
      "#7fc6da",
      "#95ce85",
    ][i % 5];
    p.style.setProperty(
      "--dx",
      (Math.random() - 0.5) * (big ? 650 : 170) + "px",
    );
    p.style.setProperty(
      "--dy",
      (Math.random() - 0.65) * (big ? 520 : 180) + "px",
    );
    root.append(p);
    setTimeout(() => p.remove(), 850);
  }
}
function fly(t, from, index) {
  if (reduced) return;
  const destination = $("tray").children[index].getBoundingClientRect();
  const f = document.createElement("div");
  f.className = "flying";
  f.style.cssText = `left:${from.x}px;top:${from.y}px;width:${from.width}px;height:${from.height}px`;
  f.append(tileElement(t, true));
  $("effects").append(f);
  requestAnimationFrame(() => {
    f.style.transform = `translate(${destination.x - from.x}px,${destination.y - from.y}px) scale(${destination.width / from.width})`;
    f.style.opacity = "0";
  });
  setTimeout(() => f.remove(), 350);
}
function selectTile(t) {
  if (t.state !== "board" || covered(t)) return;
  const rect = t.el.getBoundingClientRect();
  t.state = "tray";
  lastPick = t;
  stats.selections++;
  sound.play("pop");
  const same = tray.findLastIndex((v) => v.entry.c === t.entry.c);
  const index = same < 0 ? tray.length : same + 1;
  tray.splice(index, 0, t);
  caught = [t.entry, ...caught.filter((e) => e.c !== t.entry.c)].slice(0, 2);
  if (t.gold) {
    goldChoice = t.entry;
    stats.goldSelections++;
    toast("★ 金色祝福牌：+25 能量，這個字會進入下一個名字");
  }
  t.el.remove();
  updateBlocked();
  renderTray();
  fly(t, rect, index);
  renderSlots();
  const group = tray.filter((v) => v.entry.c === t.entry.c);
  if (group.length === 3) clearGroup(group);
  else if (tray.length === 7) rescue();
  if (t.gold) addEnergy(25);
  updateRound();
}
function clearGroup(group) {
  const entry = group[0].entry;
  group.forEach((t) => (t.state = "removed"));
  tray = tray.filter((t) => !group.includes(t));
  lastPick = null;
  matches++;
  score += group.some((t) => t.gold) ? 150 : 100;
  caught = [entry, ...caught.filter((e) => e.c !== entry.c)].slice(0, 2);
  renderSlots();
  renderTray();
  sound.play("celebrate");
  const r = $("tray").getBoundingClientRect();
  burst(r.x + r.width / 2, r.y, true);
  showCombo(matches % 3 === 0 ? "太棒了！ ✦" : "好字成三！");
  $("playHint").textContent =
    `${entry.c} · ${entry.s}畫${entry.meaning ? " · " + entry.meaning : " · 又收下一份祝福"}`;
  addEnergy(30);
  updateRound();
  if (tiles.every((t) => t.state === "removed")) {
    showCombo("花園盛開！ ✿");
    addEnergy(100);
    level++;
    nextTimer = setTimeout(makeBoard, 1200);
  }
}
function showCombo(text) {
  const el = $("combo");
  el.textContent = text;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
}
function rescue() {
  tray.forEach((t) => (t.state = "board"));
  tray = [];
  lastPick = null;
  stats.rescues++;
  assignEntries();
  renderBoard();
  renderTray();
  toast("小花精靈幫你整理好了，繼續收集吧！");
}
function updateRound() {
  $("remaining").textContent =
    tiles.filter((t) => t.state === "board").length + " 張好字";
  $("levelLabel").textContent = "花園 " + String(level).padStart(2, "0");
  $("matchLabel").textContent = matches + " 組好字";
  $("score").textContent = score;
  $("matchFill").style.width = ((matches * 3) / initialCount) * 100 + "%";
}
$("undoButton").onclick = () => {
  if (!lastPick || lastPick.state !== "tray") {
    toast("先選一張字牌，就可以撤回。");
    return;
  }
  tray = tray.filter((t) => t !== lastPick);
  lastPick.state = "board";
  if (goldChoice?.c === lastPick.entry.c) goldChoice = null;
  caught = [
    ...new Map([...tray].reverse().map((t) => [t.entry.c, t.entry])).values(),
  ].slice(0, 2);
  lastPick = null;
  renderSlots();
  renderBoard();
  renderTray();
  updateRound();
  sound.play("tap");
};
$("shuffleButton").onclick = () => {
  tray.forEach((t) => (t.state = "board"));
  tray = [];
  lastPick = null;
  assignEntries();
  renderBoard();
  renderTray();
  updateRound();
  showCombo("換個好心情！");
  sound.play("rise", 0.5);
};
$("hintButton").onclick = () => {
  const first =
    tray[0] || tiles.find((t) => t.state === "board" && !covered(t));
  if (!first) return;
  const group = [...tray, ...tiles.filter((t) => t.state === "board")]
    .filter((t) => t.entry.c === first.entry.c)
    .slice(0, 3);
  if (group.length !== 3) return;
  group.forEach((t) => {
    if (t.state === "board") t.el.remove();
  });
  clearGroup(group);
  updateBlocked();
  toast("小花精靈幫你湊成一組 " + first.entry.c + "！");
};
function addEnergy(amount) {
  energy += amount;
  sound.play("rise", Math.min(1, energy / 100));
  while (energy >= 100) {
    energy -= 100;
    generateName();
  }
  renderEnergy();
}
function renderEnergy() {
  $("energyFill").style.width = energy + "%";
  $("energyLabel").textContent = Math.round(energy) + "%";
  $("energy").setAttribute("aria-valuenow", Math.round(energy));
}
function renderSlots() {
  for (let i = 0; i < 2; i++) {
    const el = $("slot" + (i + 1));
    el.textContent = caught[i]?.c || "?";
    el.classList.toggle("empty", !caught[i]);
  }
}
function generateName() {
  const preferred = goldChoice
    ? [goldChoice, ...caught.filter((e) => e.c !== goldChoice.c)]
    : caught;
  const given = pickGivenName({
    want: target === "auto" ? null : target,
    count: null,
    preferred,
  });
  const chars = given.chars.map((e) => e.c),
    full = "吳" + chars.join("");
  const catLabels = {
    xiangxing: "象形",
    xingsheng: "形聲",
    huiyi: "會意",
    zhishi: "指事",
    jingfang: "經方",
  };
  const tags = given.chars
      .map((e) => catLabels[e.cat] || "")
      .filter(Boolean)
      .join(" · "),
    pinyin = given.chars.map((e) => e.p).join(" ");
  names.unshift({
    name: full,
    chars,
    pinyin,
    wx: given.elements,
    tags,
    ts: Date.now(),
  });
  names = names.slice(0, 200);
  saveNames();
  renderBook();
  $("revealName").textContent = full;
  $("revealTag").textContent =
    given.elements.join(" · ") + " / " + tags + " / " + pinyin;
  $("revealMeaning").textContent = given.chars
    .map((e) => `${e.c} · ${e.s}畫${e.meaning ? " · " + e.meaning : ""}`)
    .join("\n");
  $("reveal").classList.remove("hidden");
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => $("reveal").classList.add("hidden"), 4600);
  burst(innerWidth / 2, innerHeight * 0.45, true);
  sound.play("reveal");
  stats.reveals++;
  caught = [];
  goldChoice = null;
  renderSlots();
}
function saveNames() {
  try {
    localStorage.setItem("wubaobao-names", JSON.stringify(names));
  } catch {}
}
function loadNames() {
  try {
    const parsed = JSON.parse(localStorage.getItem("wubaobao-names") || "[]");
    names = Array.isArray(parsed)
      ? parsed
          .filter(
            (n) => n && typeof n.name === "string" && Array.isArray(n.chars),
          )
          .slice(0, 200)
      : [];
  } catch {
    names = [];
  }
}
function renderBook() {
  $("bookCount").textContent = names.length;
  $("bookList").replaceChildren();
  if (!names.length) {
    const p = document.createElement("p");
    p.className = "book-empty";
    p.textContent = "摸一摸字牌，第一個好名字就要來了。";
    $("bookList").append(p);
    return;
  }
  names.forEach((n, i) => {
    const row = document.createElement("div");
    row.className = "book-item";
    const name = document.createElement("span");
    name.className = "nm";
    name.textContent = n.name;
    const meta = document.createElement("div");
    meta.className = "meta";
    const py = document.createElement("p");
    py.className = "py";
    py.textContent = n.pinyin || "";
    const tg = document.createElement("p");
    tg.className = "tg";
    tg.textContent = Array.isArray(n.wx) ? n.wx.join(" · ") : "";
    meta.append(py, tg);
    const del = document.createElement("button");
    del.className = "book-delete";
    del.textContent = "×";
    del.ariaLabel = "刪除" + n.name;
    del.onclick = () => {
      names.splice(i, 1);
      saveNames();
      renderBook();
    };
    row.append(name, meta, del);
    $("bookList").append(row);
  });
  const clear = document.createElement("button");
  clear.id = "bookClear";
  clear.textContent = "清空名字簿";
  clear.onclick = () => {
    names = [];
    saveNames();
    renderBook();
  };
  $("bookList").append(clear);
}
$("bookToggle").onclick = () => $("book").classList.toggle("hidden");
$("bookClose").onclick = () => $("book").classList.add("hidden");
for (const button of $("wxbar").querySelectorAll("button"))
  button.onclick = () => {
    target = button.dataset.w;
    caught = [];
    goldChoice = null;
    renderSlots();
    for (const b of $("wxbar").querySelectorAll("button")) {
      b.classList.toggle("active", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    }
    makeBoard();
    sound.play("rise", 0.5);
  };
function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.add("hidden"), 3200);
}
$("fullscreenToggle").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else toast("iPad 可在 Safari 點「分享」→「加入主畫面」，享受全螢幕。");
  } catch {
    toast("可從 Safari「分享」→「加入主畫面」開啟。");
  }
};
document.addEventListener("fullscreenchange", () => {
  $("fullscreenToggle").ariaLabel = document.fullscreenElement
    ? "退出全螢幕"
    : "進入全螢幕";
  layout();
});
// 牌與空白處都能累積；揭曉期間不攔截輸入。設定按鈕保留原本操作。
document.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button:not(.tile),#book")) return;
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  sound.play("tap");
  const el = e.target.closest(".tile[data-id]");
  if (el) {
    const t = tiles.find((t) => t.id === Number(el.dataset.id));
    if (t) selectTile(t);
  } else burst(e.clientX, e.clientY);
  addEnergy(10);
});
document.addEventListener("pointermove", (e) => {
  if (!pointer || pointer.id !== e.pointerId) return;
  const distance = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
  if (distance < 12) return;
  addEnergy(Math.min(distance, 100) * 0.18);
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  const el = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest(".tile[data-id]");
  if (el) {
    const t = tiles.find((t) => t.id === Number(el.dataset.id));
    if (t) selectTile(t);
  }
});
for (const event of ["pointerup", "pointercancel"])
  document.addEventListener(event, () => (pointer = null));
document.addEventListener("keydown", (e) => {
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    ["Tab", "Escape"].includes(e.key) ||
    e.target.closest("button")
  )
    return;
  sound.unlock();
  sound.play("tap");
  addEnergy(10);
});
new ResizeObserver(layout).observe($("stage"));
loadNames();
renderBook();
makeBoard();
renderSlots();
renderEnergy();
if (new URLSearchParams(location.search).has("qa"))
  window.wubaobaoQA = () => ({
    energy,
    names: names.length,
    caught: caught.map((e) => e.c),
    target,
    level,
    matches,
    score,
    initialCount,
    tray: tray.map((t) => t.entry.c),
    ...stats,
    audio: sound.ctx?.state,
    sound: { ...sound.settings },
    gains: sound.ctx ? [sound.effects.gain.value, sound.music.gain.value] : [],
    voices: sound.voices,
    particles: $("effects").childElementCount,
    tiles: tiles.map((t) => ({
      id: t.id,
      c: t.entry.c,
      w: t.entry.w,
      state: t.state,
      layer: t.layer,
      gold: t.gold,
      solution: t.solution,
      blocked: t.state === "board" && covered(t),
    })),
  });
