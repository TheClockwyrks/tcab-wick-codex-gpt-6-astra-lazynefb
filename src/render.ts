import type { DeepReadonly } from "ts-essentials";
import type { RenderApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { WickState, WeaponId, OfferId } from "./types";
import { images } from "./assets";
import { stats, xpNext, figures, row, isWeapon, isPassive } from "./model";
import { menuRects, tabRects, entries } from "./menus";
import type { WickRect } from "./debug-types";
export const BACKGROUND = "#0b151d";
const PALETTE = {
  ink: BACKGROUND,
  panel: "#10212a",
  line: "#34464a",
  gold: "#d7ad6c",
  cream: "#f3e6c6",
  muted: "#8da5a8",
  mint: "#8fcebb",
};
type Context = RenderApi["ctx"];
function text(
  ctx: Context,
  value: string,
  x: number,
  y: number,
  size = 18,
  color = PALETTE.cream,
  align: CanvasTextAlign = "left",
  serif = false,
) {
  ctx.font = `${size}px ${serif ? "Georgia, serif" : '"Courier New", monospace'}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}
function line(
  ctx: Context,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color = PALETTE.line,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function panel(
  ctx: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  color = PALETTE.panel,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.line;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function sprite(
  ctx: Context,
  path: string,
  x: number,
  y: number,
  w?: number,
  h?: number,
  mirror = false,
) {
  const image = images.get(path);
  if (!image) return;
  const width = w ?? image.width,
    height = h ?? image.height;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}
function circle(
  ctx: Context,
  x: number,
  y: number,
  r: number,
  color = PALETTE.line,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
}
function glow(ctx: Context, x: number, y: number, r: number, strength = 0.15) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(235,175,87,${strength})`);
  g.addColorStop(0.35, `rgba(235,175,87,${strength * 0.3})`);
  g.addColorStop(1, "rgba(235,175,87,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
export const clockText = (tick: number) =>
  `${Math.floor(tick / C.TICK_HZ / 60)}:${String(Math.floor(tick / C.TICK_HZ) % 60).padStart(2, "0")}`;
function label(ctx: Context, value: string, x: number, y: number) {
  text(ctx, value, x, y, 12, PALETTE.gold);
}
function nameOf(id: string): string {
  if (isWeapon(id)) return C.WEAPON_NAMES[id];
  if (isPassive(id)) return C.PASSIVES[id].name;
  if (id === C.LAMP_OIL_ID) return C.LAMP_OIL_NAME;
  if (id in C.ENEMIES) return C.ENEMIES[id as C.EnemyId].name;
  if (id in C.GEM_NAMES) return C.GEM_NAMES[id as C.GemTier];
  return C.PICKUP_NAMES[id as C.PickupKind];
}
function description(id: string): string {
  if (isWeapon(id)) return C.WEAPON_DESCRIPTIONS[id];
  if (isPassive(id)) return C.PASSIVE_DESCRIPTIONS[id];
  if (id === C.LAMP_OIL_ID) return C.LAMP_OIL_DESCRIPTION;
  if (id in C.ENEMIES) return C.ENEMY_DESCRIPTIONS[id as C.EnemyId];
  if (id in C.GEM_NAMES) return C.GEM_DESCRIPTIONS[id as C.GemTier];
  return C.PICKUP_DESCRIPTIONS[id as C.PickupKind];
}
function button(
  ctx: Context,
  rect: WickRect,
  title: string,
  selected: boolean,
  index?: number,
) {
  const { x, y, width: w, height: h } = rect;
  panel(ctx, x, y, w, h, selected ? "#26352f" : "#101d25");
  if (selected) {
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(x, y, 3, h);
  }
  text(
    ctx,
    title,
    x + 24,
    y + h / 2,
    17,
    selected ? PALETTE.cream : PALETTE.muted,
  );
  if (index !== undefined)
    text(
      ctx,
      String(index + 1).padStart(2, "0"),
      x + w - 24,
      y + h / 2,
      12,
      selected ? PALETTE.gold : "#55666a",
      "right",
    );
  else if (selected)
    text(ctx, "→", x + w - 24, y + h / 2, 22, PALETTE.gold, "right");
}
function footer(
  ctx: Context,
  s: DeepReadonly<WickState>,
  copy = "↑ ↓  SELECT     ENTER  CONFIRM",
) {
  line(ctx, 64, 664, 1216, 664);
  text(ctx, copy, 72, 688, 12, PALETTE.muted);
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    1208,
    688,
    12,
    PALETTE.muted,
    "right",
  );
}
function ground(ctx: Context, s: DeepReadonly<WickState>) {
  const p = s.run.player,
    size = C.GROUND_TILE_SIZE;
  const startX = Math.floor((p.x - C.STAGE_CX) / size),
    startY = Math.floor((p.y - C.STAGE_CY) / size);
  const tile = images.get(C.GROUND_TILE_PATH);
  if (tile)
    for (let x = startX; x <= startX + C.STAGE_W / size + 1; x++)
      for (let y = startY; y <= startY + C.STAGE_H / size + 1; y++)
        ctx.drawImage(
          tile,
          Math.round(x * size - p.x + C.STAGE_CX),
          Math.round(y * size - p.y + C.STAGE_CY),
          size,
          size,
        );
}
function effect(
  ctx: Context,
  id: WeaponId,
  x: number,
  y: number,
  w: number,
  h: number,
  frame: number,
) {
  const e = C.EFFECT_SPRITES[id];
  sprite(
    ctx,
    e.frames === 1
      ? e.path
      : `${e.path}/${Math.max(0, Math.min(e.frames - 1, frame))}.png`,
    x,
    y,
    w,
    h,
  );
}
function world(ctx: Context, s: DeepReadonly<WickState>) {
  ground(ctx, s);
  const r = s.run,
    p = r.player;
  const x = (v: number) => v - p.x + C.STAGE_CX,
    y = (v: number) => v - p.y + C.STAGE_CY;
  glow(ctx, C.STAGE_CX, C.STAGE_CY, 300, 0.15);
  for (const z of r.zones) {
    const meta = s.visuals.shapes[z.id],
      age = (r.tick - (meta?.born ?? r.tick)) * C.TICK_DT;
    let frame = 0;
    if (z.kind === "strike")
      frame = Math.floor(age / (C.SPARK_FLASH / C.EFFECT_SPRITES.spark.frames));
    if (z.kind === "burst")
      frame = Math.floor(age / (C.FLARE_FLASH / C.EFFECT_SPRITES.flare.frames));
    ctx.save();
    if (z.kind === "puddle" || z.kind === "aura") {
      const pulse =
        z.kind === "aura"
          ? (r.weapons.find((w) => w.id === z.weapon)?.cooldown ?? 0)
          : ((r.tick - (meta?.pulse ?? 0)) * C.TICK_DT) %
            (z.weapon === "blaze" ? C.BLAZE_PULSE : C.OIL_PULSE);
      ctx.globalAlpha =
        z.kind === "aura"
          ? 0.55 + 0.3 * Math.cos(pulse * 6)
          : 0.65 + 0.3 * Math.cos(pulse * 20);
    }
    effect(
      ctx,
      z.weapon,
      x(z.x),
      y(z.y),
      z.width ?? z.radius * 2,
      z.height ?? z.radius * 2,
      frame,
    );
    ctx.restore();
  }
  for (const gem of r.gems)
    sprite(ctx, C.GEM_PATHS[gem.tier], x(gem.x), y(gem.y));
  for (const pickup of r.pickups) {
    glow(ctx, x(pickup.x), y(pickup.y), 35, 0.14);
    sprite(ctx, C.PICKUP_PATHS[pickup.kind], x(pickup.x), y(pickup.y));
  }
  for (const e of r.enemies) {
    const size = C.ENEMIES[e.type].radius * 2;
    sprite(
      ctx,
      `${C.ENEMY_SHEET_DIR}/${e.type}/${Math.floor(e.age / C.WALK_FRAME_TIME) % C.ENEMY_FRAMES}.png`,
      x(e.x),
      y(e.y),
      size,
      size,
      e.heading.x < 0,
    );
    if (C.ENEMIES[e.type].rank !== "common") {
      const width = size + 12;
      ctx.fillStyle = "#0c131c";
      ctx.fillRect(x(e.x) - width / 2, y(e.y) - size / 2 - 10, width, 3);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(
        x(e.x) - width / 2,
        y(e.y) - size / 2 - 10,
        width * Math.max(0, e.hp / e.maxHp),
        3,
      );
    }
  }
  for (const projectile of r.projectiles) {
    const age =
      (r.tick - (s.visuals.shapes[projectile.id]?.born ?? r.tick)) * C.TICK_DT;
    effect(
      ctx,
      projectile.weapon,
      x(projectile.x),
      y(projectile.y),
      projectile.radius * 2,
      projectile.radius * 2,
      Math.floor(age / C.WALK_FRAME_TIME) %
        C.EFFECT_SPRITES[projectile.weapon].frames,
    );
  }
  for (const puff of s.visuals.puffs) {
    const frame = Math.floor(
      ((r.tick - puff.tick) * C.TICK_DT) / (C.PUFF_TIME / C.PUFF_SHEET.frames),
    );
    sprite(ctx, `${C.PUFF_SHEET.dir}/${frame}.png`, x(puff.x), y(puff.y));
  }
  const frame =
    Math.floor((s.visuals.moveTicks * C.TICK_DT) / C.WALK_FRAME_TIME) %
    C.LAMPLIGHTER_WALK_SHEET.frames;
  glow(ctx, C.STAGE_CX + 8, C.STAGE_CY, 54, 0.24);
  sprite(
    ctx,
    s.visuals.moved
      ? `${C.LAMPLIGHTER_WALK_SHEET.dir}/${frame}.png`
      : C.LAMPLIGHTER_IDLE_PATH,
    C.STAGE_CX,
    C.STAGE_CY,
    undefined,
    undefined,
    p.facing === "left",
  );
  const shade = ctx.createRadialGradient(
    C.STAGE_CX,
    C.STAGE_CY,
    140,
    C.STAGE_CX,
    C.STAGE_CY,
    750,
  );
  shade.addColorStop(0, "#050d1300");
  shade.addColorStop(1, "#050d13ba");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  if (r.hurtFlash > 0) {
    ctx.fillStyle = `rgba(173,58,43,${(r.hurtFlash / C.HURT_FLASH) * 0.18})`;
    ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  }
}
function hud(ctx: Context, s: DeepReadonly<WickState>) {
  const r = s.run,
    d = stats(r);
  panel(ctx, 24, 22, 320, 78, "#0c1922ec");
  label(ctx, "THE LAMPLIGHTER", 42, 41);
  text(
    ctx,
    `${Math.ceil(r.player.hp)} / ${d.maxHp}`,
    325,
    42,
    15,
    PALETTE.cream,
    "right",
  );
  ctx.fillStyle = "#263439";
  ctx.fillRect(42, 61, 284, 9);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(
    42,
    61,
    284 * Math.max(0, Math.min(1, r.player.hp / d.maxHp)),
    9,
  );
  text(ctx, `${C.LEVEL_LABEL} ${r.level}`, 42, 85, 12, PALETTE.mint);
  ctx.fillStyle = "#263439";
  ctx.fillRect(120, 81, 206, 4);
  ctx.fillStyle = PALETTE.mint;
  ctx.fillRect(120, 81, 206 * Math.min(1, r.xp / xpNext(r.level)), 4);
  panel(ctx, 548, 18, 184, 84, "#0c1922ec");
  label(ctx, "UNTIL THE DAWN", 589, 37);
  text(ctx, clockText(r.tick), 640, 70, 33, PALETTE.cream, "center", true);
  panel(ctx, 1056, 22, 200, 78, "#0c1922ec");
  label(ctx, "THE NIGHT TAKEN", 1074, 41);
  text(ctx, String(r.kills).padStart(3, "0"), 1074, 73, 27, PALETTE.cream);
  text(ctx, "KILLS", 1238, 78, 12, PALETTE.muted, "right");
  const group = (kind: "weapons" | "passives", x: number) => {
    label(ctx, kind === "weapons" ? "TOOLS" : "TRINKETS", x, 618);
    for (let i = 0; i < C.WEAPON_SLOTS; i++) {
      const left = x + i * 52,
        item = r[kind][i];
      panel(ctx, left, 634, 44, 44, "#0c1922ed");
      if (!item) continue;
      sprite(ctx, C.ICON_PATHS[item.id], left + 22, 655, 28, 28);
      if ("cooldown" in item && item.cooldown > 0) {
        const v = figures(r, item.id as WeaponId),
          total = v.cooldown + (item.id === "lantern" ? v.duration : 0);
        ctx.fillStyle = "#08131b99";
        ctx.fillRect(
          left + 2,
          636,
          40,
          40 * Math.min(1, item.cooldown / total),
        );
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(
          left + 2,
          675,
          40 * (1 - Math.min(1, item.cooldown / total)),
          2,
        );
      }
      for (let j = 0; j < item.level; j++) {
        ctx.fillStyle = kind === "weapons" ? PALETTE.gold : PALETTE.mint;
        ctx.fillRect(left + j * 5, 684, 3, 3);
      }
    }
  };
  group("weapons", 32);
  group("passives", 940);
  text(ctx, "WASD / ARROWS  MOVE", 640, 657, 11, PALETTE.muted, "center");
  text(ctx, "P  PAUSE    M  SOUND", 640, 679, 11, PALETTE.muted, "center");
  if (r.tick < C.TICK_HZ * 6) {
    text(
      ctx,
      "Keep moving. Your light will do the rest.",
      640,
      558,
      18,
      PALETTE.cream,
      "center",
      true,
    );
  }
}
function title(ctx: Context, s: DeepReadonly<WickState>) {
  ground(ctx, s);
  ctx.fillStyle = "#0b151dde";
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  line(ctx, 64, 56, 1216, 56);
  label(ctx, "A LAMPLIGHTER’S VIGIL", 82, 38);
  text(
    ctx,
    "Nº 01  /  TEN MINUTES TO DAWN",
    1200,
    38,
    12,
    PALETTE.muted,
    "right",
  );
  // An illuminated plate assembled from the shipped pixel art, framed like a field guide.
  const cx = 920,
    cy = 341;
  glow(ctx, cx, cy, 320, 0.28);
  circle(ctx, cx, cy, 222);
  circle(ctx, cx, cy, 211, "#33403e");
  circle(ctx, cx, cy, 151, "#4a4b3b");
  for (let i = 0; i < 60; i++) {
    const a = (i * Math.PI) / 30,
      inner = i % 5 ? 218 : 208;
    line(
      ctx,
      cx + Math.cos(a) * inner,
      cy + Math.sin(a) * inner,
      cx + Math.cos(a) * 224,
      cy + Math.sin(a) * 224,
      i % 5 ? "#34413e" : "#8c7952",
    );
  }
  line(ctx, cx, 84, cx, 121);
  line(ctx, cx, 565, cx, 599);
  line(ctx, 660, cy, 698, cy);
  line(ctx, 1142, cy, 1180, cy);
  sprite(ctx, C.ICON_PATHS.lantern, cx, cy, 240, 240);
  sprite(ctx, `${C.ENEMY_SHEET_DIR}/moth/0.png`, 747, 203, 52, 52, true);
  sprite(ctx, `${C.ENEMY_SHEET_DIR}/moth/2.png`, 1092, 222, 42, 42);
  sprite(ctx, `${C.ENEMY_SHEET_DIR}/mothwing/0.png`, 1055, 502, 66, 66, true);
  sprite(ctx, `${C.ENEMY_SHEET_DIR}/moth/1.png`, 762, 486, 36, 36);
  label(ctx, "ONE SMALL LIGHT. AN ENDLESS DARK.", 746, 614);
  label(ctx, "SURVIVE THE NIGHT", 149, 152);
  text(ctx, C.TITLE_TEXT, 136, 237, 126, PALETTE.cream, "left", true);
  text(ctx, C.TAGLINE_TEXT.split("").join(" "), 149, 318, 18, PALETTE.gold);
  menuRects(s).forEach((rect, i) =>
    button(ctx, rect, C.TITLE_ITEMS[i]!, s.menuIndex === i, i),
  );
  text(
    ctx,
    "Walk softly. Burn brightly.",
    148,
    604,
    20,
    PALETTE.muted,
    "left",
    true,
  );
  footer(ctx, s);
}
function heading(ctx: Context, title: string, kicker: string) {
  label(ctx, kicker, 72, 44);
  text(ctx, title, 72, 81, 38, PALETTE.cream, "left", true);
}
function almanac(ctx: Context, s: DeepReadonly<WickState>) {
  heading(ctx, C.ALMANAC_TEXT, "FIELD NOTES  /  THE THINGS DRAWN TO LIGHT");
  tabRects(s).forEach((rect, i) =>
    button(ctx, rect, C.ALMANAC_TABS[i]!, i === s.almanacTab),
  );
  const list = entries(s.almanacTab),
    id = list[s.menuIndex]!;
  menuRects(s).forEach((rect, i) =>
    button(
      ctx,
      rect,
      nameOf(list[s.almanacScroll + i]!),
      s.menuIndex === s.almanacScroll + i,
    ),
  );
  label(
    ctx,
    `${String(s.menuIndex + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`,
    84,
    646,
  );
  line(ctx, 408, 194, 408, 627);
  label(ctx, C.ALMANAC_TABS[s.almanacTab]!, 456, 216);
  text(ctx, nameOf(id), 456, 256, 42, PALETTE.cream, "left", true);
  const cx = 823,
    cy = 383;
  circle(ctx, cx, cy, 84, "#26383e");
  circle(ctx, cx, cy, 92, "#233238");
  glow(ctx, cx, cy, 140, 0.13);
  let facts: string[] = [];
  if (isWeapon(id)) {
    sprite(ctx, C.ICON_PATHS[id], 492, 325, 48, 48);
    const e = C.EFFECT_SPRITES[id],
      scale = Math.min(140 / e.width, 140 / e.height, 4);
    effect(
      ctx,
      id,
      cx,
      cy,
      e.width * scale,
      e.height * scale,
      Math.floor(s.simTime / C.WALK_FRAME_TIME) % e.frames,
    );
    const v = row(id);
    facts = [
      `DAMAGE  ${v.damage}`,
      ...(id === "chandelier" ? [] : [`COOLDOWN  ${v.cooldown}s`]),
    ];
  } else if (isPassive(id)) {
    sprite(ctx, C.ICON_PATHS[id], cx, cy, 96, 96);
    facts = [`MAX LEVEL  ${C.PASSIVES[id].maxLevel}`];
  } else if (s.almanacTab === 2) {
    const e = C.ENEMIES[id as C.EnemyId],
      frame = Math.floor(s.simTime / C.WALK_FRAME_TIME) % C.ENEMY_FRAMES;
    sprite(
      ctx,
      `${C.ENEMY_SHEET_DIR}/${id}/${frame}.png`,
      cx,
      cy,
      e.radius * 5,
      e.radius * 5,
    );
    facts = [`HEALTH  ${e.hp}`, `SPEED  ${e.speed}`, `DAMAGE  ${e.damage}`];
  } else if (id in C.GEM_PATHS) {
    sprite(ctx, C.GEM_PATHS[id as C.GemTier], cx, cy, 64, 64);
    facts = [`EXPERIENCE  ${C.GEM_VALUES[id as C.GemTier]}`];
  } else {
    sprite(ctx, C.PICKUP_PATHS[id as C.PickupKind], cx, cy, 96, 96);
    if (id === "bread") facts = [`HEALS  ${C.BREAD_HEAL}`];
  }
  facts.forEach((f, i) => {
    panel(ctx, 456 + i * 234, 508, 216, 48);
    text(ctx, f, 474 + i * 234, 532, 15, PALETTE.gold);
  });
  text(ctx, description(id), 456, 595, 14, PALETTE.muted);
  footer(ctx, s, "↑ ↓  BROWSE    ← →  TABS    ESC  RETURN");
}
function howto(ctx: Context, s: DeepReadonly<WickState>) {
  heading(ctx, "A SMALL GUIDE TO THE NIGHT", "BEFORE YOU STRIKE A MATCH");
  const sections = [
    [
      "01",
      "ONLY WALK",
      "Your tools fire themselves, each on its own rhythm.",
      "Use WASD or the arrows. Keep the dark from touching you.",
    ],
    [
      "02",
      "GATHER WHAT GLOWS",
      "Fallen enemies leave gems. Each level offers one of three gifts.",
      "Carry six tools and six trinkets. Make every choice count.",
    ],
    [
      "03",
      "LET THE LAMP CHANGE",
      "Elites leave chests. A tool at level eight can transform",
      "when you carry its matching trinket. Browse the Almanac.",
    ],
    [
      "04",
      "LAST UNTIL DAWN",
      "The night thickens, and the Dark itself will come.",
      "Reach 10:00 to win. Protect the light until then.",
    ],
  ];
  sections.forEach(([num, title, a, b], i) => {
    const y = 164 + i * 95;
    label(ctx, num!, 83, y);
    text(ctx, title!, 133, y, 18, PALETTE.gold);
    text(ctx, a!, 133, y + 29, 17, PALETTE.cream);
    text(ctx, b!, 133, y + 53, 15, PALETTE.muted);
  });
  button(ctx, menuRects(s)[0]!, "RETURN TO THE NIGHT", true);
  footer(
    ctx,
    s,
    "ENTER / SPACE  CONFIRM    ESC / P  PAUSE    MOUSE & TOUCH  MENUS",
  );
}
function overlay(ctx: Context, s: DeepReadonly<WickState>) {
  ctx.fillStyle = "#070f17cd";
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  const title =
    s.screen === "levelup"
      ? C.LEVEL_UP_TEXT
      : s.screen === "chest"
        ? C.CHEST_TEXT
        : s.screen === "paused"
          ? C.PAUSED_TEXT
          : s.screen === "dawn"
            ? C.DAWN_TEXT
            : C.FALLEN_TEXT;
  const width = s.screen === "levelup" ? 780 : 680;
  panel(ctx, 640 - width / 2, 133, width, 522, "#0e1c24f5");
  label(
    ctx,
    s.screen === "levelup"
      ? "CHOOSE ONE GIFT"
      : s.screen === "chest"
        ? "A GIFT FROM THE DARK"
        : s.screen === "paused"
          ? "THE NIGHT CAN WAIT"
          : s.screen === "dawn"
            ? "YOU KEPT THE LIGHT"
            : "EVERY FLAME HAS ITS NIGHT",
    640 - width / 2 + 32,
    169,
  );
  text(
    ctx,
    title,
    640,
    220,
    s.screen === "levelup" ? 30 : 40,
    PALETTE.cream,
    "center",
    true,
  );
  line(ctx, 640 - width / 2 + 32, 246, 640 + width / 2 - 32, 246);
  if (s.screen === "levelup") {
    menuRects(s).forEach((rect, i) => {
      const id = s.run.offers[i]!;
      button(ctx, rect, "", i === s.menuIndex);
      sprite(
        ctx,
        C.ICON_PATHS[id],
        rect.x + 40,
        rect.y + rect.height / 2,
        36,
        36,
      );
      text(
        ctx,
        nameOf(id),
        rect.x + 78,
        rect.y + rect.height / 2,
        23,
        PALETTE.cream,
        "left",
        true,
      );
      const held = [...s.run.weapons, ...s.run.passives].find(
        (w) => w.id === id,
      );
      text(
        ctx,
        held ? `${C.LEVEL_LABEL} ${held.level + 1}` : C.OFFER_NEW_TEXT,
        rect.x + rect.width - 26,
        rect.y + rect.height / 2,
        13,
        PALETTE.gold,
        "right",
      );
    });
    if (s.run.offers.length)
      text(
        ctx,
        description(s.run.offers[s.menuIndex]!),
        640,
        563,
        14,
        PALETTE.muted,
        "center",
      );
    text(
      ctx,
      "↑ ↓  CHOOSE     ENTER  ACCEPT",
      640,
      605,
      12,
      PALETTE.gold,
      "center",
    );
  } else if (s.screen === "chest") {
    const result = s.run.chestResult,
      id: OfferId =
        result?.kind === "evolve"
          ? result.weapon
          : result?.kind === "level"
            ? result.item
            : C.LAMP_OIL_ID;
    glow(ctx, 640, 352, 100, 0.28);
    sprite(ctx, C.ICON_PATHS[id], 640, 352, 96, 96);
    text(ctx, nameOf(id), 640, 440, 32, PALETTE.cream, "center", true);
    text(
      ctx,
      result?.kind === "evolve"
        ? "TRANSFORMED"
        : result?.kind === "level"
          ? `${C.LEVEL_LABEL} ${result.level}`
          : `RESTORED ${C.CHEST_HEAL} HEALTH`,
      640,
      481,
      15,
      PALETTE.gold,
      "center",
    );
    button(ctx, menuRects(s)[0]!, "CONTINUE", true);
  } else {
    if (s.screen === "paused") {
      text(
        ctx,
        "The city holds its breath.",
        640,
        325,
        24,
        PALETTE.muted,
        "center",
        true,
      );
    } else {
      const r = s.run;
      text(
        ctx,
        `${clockText(r.tick)}     ${C.LEVEL_LABEL} ${r.level}     ${r.kills} KILLS`,
        640,
        328,
        20,
        PALETTE.gold,
        "center",
      );
      text(
        ctx,
        s.screen === "dawn" ? "The morning is yours." : "Strike another match.",
        640,
        370,
        23,
        PALETTE.muted,
        "center",
        true,
      );
    }
    menuRects(s).forEach((rect, i) =>
      button(
        ctx,
        rect,
        (s.screen === "paused" ? C.PAUSE_ITEMS : C.END_ITEMS)[i]!,
        s.menuIndex === i,
      ),
    );
  }
}
export function render(s: DeepReadonly<WickState>, api: RenderApi) {
  const ctx = api.ctx;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  if (s.screen === "title") {
    title(ctx, s);
    return;
  }
  if (s.screen === "almanac") {
    almanac(ctx, s);
    return;
  }
  if (s.screen === "howto") {
    howto(ctx, s);
    return;
  }
  world(ctx, s);
  hud(ctx, s);
  if (s.screen !== "playing") overlay(ctx, s);
}
