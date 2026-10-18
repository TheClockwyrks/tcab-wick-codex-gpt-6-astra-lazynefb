import type { DeepReadonly, DeepWritable } from "ts-essentials";
import * as C from "./constants";
import type {
  WickState,
  RunState,
  WeaponId,
  OfferId,
  PassiveId,
  EnemyId,
  ZoneKind,
} from "./types";
export type Draft = DeepWritable<WickState>;
export type RunDraft = Draft["run"];
export const copy = (s: DeepReadonly<WickState>): Draft =>
  structuredClone(s) as Draft;
export function idleRun(): RunDraft {
  return {
    tick: 0,
    level: 1,
    xp: 0,
    kills: 0,
    player: { x: 0, y: 0, facing: "right", hp: C.BASE_MAX_HP },
    hurtFlash: 0,
    weapons: [],
    passives: [],
    enemies: [],
    projectiles: [],
    zones: [],
    gems: [],
    pickups: [],
    offers: [],
    nextOffers: null,
    pendingLevelUps: 0,
    chestResult: null,
    spawnTimer: 0,
    firedEvents: [],
    nextId: 0,
    nextSpawnAngle: null,
    nextSwarmAngle: null,
    nextSpawnType: null,
    nextPuddleOffset: null,
    nextStrikeTarget: null,
    nextChestItem: null,
    nextDrop: null,
  };
}
export function initial(): Draft {
  return {
    screen: "title",
    menuIndex: 0,
    almanacTab: 0,
    almanacScroll: 0,
    run: idleRun(),
    accumulator: 0,
    simTime: 0,
    muted: false,
    spawning: true,
    events: true,
    despawning: true,
    enemyMotion: true,
    enemyContact: true,
    weaponFire: true,
    effectMotion: true,
    drops: true,
    progression: true,
    visuals: { moved: false, moveTicks: 0, puffs: [], shapes: {}, armed: null },
  };
}
export function stats(r: DeepReadonly<RunState>) {
  const lv = (id: PassiveId) => r.passives.find((p) => p.id === id)?.level ?? 0;
  return {
    damageMul: 1 + C.WICK_DAMAGE_PER_LEVEL * lv("wick"),
    cooldownMul: 1 - C.OIL_COOLDOWN_PER_LEVEL * lv("oil"),
    areaMul: 1 + C.GLASS_AREA_PER_LEVEL * lv("glass"),
    armor: C.BRASS_ARMOR_PER_LEVEL * lv("brass"),
    amountBonus: C.MIRROR_AMOUNT_PER_LEVEL * lv("mirror"),
    moveSpeed: C.MOVE_SPEED * (1 + C.BELLOWS_SPEED_PER_LEVEL * lv("bellows")),
    maxHp: C.BASE_MAX_HP + C.TALLOW_HP_PER_LEVEL * lv("tallow"),
    recovery: C.BASE_RECOVERY + C.TINDER_RECOVERY_PER_LEVEL * lv("tinder"),
    xpMul: 1 + C.SOOT_XP_PER_LEVEL * lv("soot"),
    pickupRadius: C.PICKUP_RADIUS * (1 + C.LURE_PICKUP_PER_LEVEL * lv("lure")),
  };
}
export const isBase = (id: string): id is C.BaseWeaponId =>
  (C.BASE_WEAPON_IDS as readonly string[]).includes(id);
export const isWeapon = (id: string): id is WeaponId => id in C.WEAPON_NAMES;
export const isPassive = (id: string): id is PassiveId => id in C.PASSIVES;
export function row(id: WeaponId, level = 1) {
  const evolved = {
    pyre: C.PYRE_STATS,
    beacon: C.BEACON_STATS,
    hail: C.HAIL_STATS,
    chandelier: C.CHANDELIER_STATS,
    corona: C.CORONA_STATS,
    blaze: C.BLAZE_STATS,
  };
  const raw = isBase(id) ? C.WEAPON_LEVELS[id][level - 1]! : evolved[id];
  return {
    cooldown: 0,
    amount: 1,
    radius: 0,
    width: 0,
    height: 0,
    orbit: 0,
    area: 0,
    duration: 0,
    speed: 0,
    pierce: C.INFINITE_PIERCE,
    ...raw,
  };
}
export function figures(r: DeepReadonly<RunState>, id: WeaponId) {
  const v = row(id, r.weapons.find((w) => w.id === id)?.level ?? 1),
    d = stats(r);
  return {
    ...v,
    damage: v.damage * d.damageMul,
    cooldown: Math.max(C.MIN_COOLDOWN, v.cooldown * d.cooldownMul),
    amount: v.amount + d.amountBonus,
    radius: v.radius * d.areaMul,
    width: v.width * d.areaMul,
    height: v.height * d.areaMul,
    orbit: v.orbit * d.areaMul,
    area: v.area * d.areaMul,
  };
}
export const xpNext = (level: number) => C.XP_BASE + C.XP_STEP * (level - 1);
export const windowIndex = (tick: number) =>
  Math.min(
    C.SPAWN_WINDOWS.length - 1,
    Math.floor(tick / C.TICK_HZ / C.SPAWN_WINDOW),
  );
export const commons = (r: DeepReadonly<RunState>) =>
  r.enemies.filter(
    (e) => C.ENEMIES[e.type].rank === "common" && e.type !== "gnat",
  ).length;
export const distance = (
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
) => Math.hypot(a.x - b.x, a.y - b.y);
export function unit(x: number, y: number, fallback = 1) {
  const d = Math.hypot(x, y);
  return d ? { x: x / d, y: y / d } : { x: fallback, y: 0 };
}
export const countdown = (n: number) =>
  n - C.TICK_DT < C.TICK_DT / 2 ? 0 : n - C.TICK_DT;
export const randomItem = <T>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)]!;
export function pool(r: DeepReadonly<RunState>): OfferId[] {
  return [
    ...C.BASE_WEAPON_IDS.filter((id) => {
      const held = r.weapons.find((w) => w.id === id);
      return held
        ? held.level < C.MAX_WEAPON_LEVEL
        : r.weapons.length < C.WEAPON_SLOTS &&
            !C.EVOLUTION_IDS.some(
              (e) =>
                C.EVOLUTIONS[e].from === id &&
                r.weapons.some((w) => w.id === e),
            );
    }),
    ...C.PASSIVE_IDS.filter((id) => {
      const held = r.passives.find((p) => p.id === id);
      return held
        ? held.level < C.PASSIVES[id].maxLevel
        : r.passives.length < C.PASSIVE_SLOTS;
    }),
  ];
}
export function heal(r: RunDraft, amount: number) {
  r.player.hp = Math.min(stats(r).maxHp, r.player.hp + amount);
}
export function gainItem(r: RunDraft, id: OfferId) {
  if (id === C.LAMP_OIL_ID) {
    heal(r, C.LAMP_OIL_HEAL);
    return;
  }
  if (isWeapon(id)) {
    const w = r.weapons.find((w) => w.id === id);
    if (w) w.level++;
    else r.weapons.push({ id, level: 1, cooldown: 0 });
  } else {
    const p = r.passives.find((p) => p.id === id);
    if (p) p.level++;
    else r.passives.push({ id, level: 1 });
    if (id === "tallow") heal(r, C.TALLOW_HP_PER_LEVEL);
  }
}
export function openLevel(s: Draft) {
  const r = s.run,
    candidates = pool(r),
    forced = r.nextOffers;
  r.nextOffers = null;
  r.offers = [];
  if (
    (forced && forced.every((id) => candidates.includes(id))) ||
    (forced?.length === 1 && forced[0] === C.LAMP_OIL_ID && !candidates.length)
  )
    r.offers = [...forced!];
  else {
    while (candidates.length && r.offers.length < C.OFFER_COUNT) {
      const id = randomItem(candidates);
      r.offers.push(id);
      candidates.splice(candidates.indexOf(id), 1);
    }
    if (!r.offers.length) r.offers = [C.LAMP_OIL_ID];
  }
  s.screen = "levelup";
  s.menuIndex = 0;
  s.accumulator = 0;
}
export function accept(s: Draft, index: number) {
  gainItem(s.run, s.run.offers[index]!);
  s.run.pendingLevelUps = Math.max(0, s.run.pendingLevelUps - 1);
  s.run.offers = [];
  s.menuIndex = 0;
  if (s.run.pendingLevelUps) openLevel(s);
  else s.screen = "playing";
}
export function chest(r: RunDraft): boolean {
  const forced = r.nextChestItem;
  r.nextChestItem = null;
  for (const w of r.weapons) {
    const evolution = C.EVOLUTION_IDS.find(
      (id) =>
        C.EVOLUTIONS[id].from === w.id &&
        w.level === C.MAX_WEAPON_LEVEL &&
        r.passives.some((p) => p.id === C.EVOLUTIONS[id].passive),
    );
    if (evolution) {
      w.id = evolution;
      w.level = 1;
      w.cooldown = 0;
      r.chestResult = { kind: "evolve", weapon: evolution };
      return true;
    }
  }
  const candidates = [
    ...r.weapons.filter((w) => isBase(w.id) && w.level < C.MAX_WEAPON_LEVEL),
    ...r.passives.filter((p) => p.level < C.PASSIVES[p.id].maxLevel),
  ].map((i) => i.id);
  if (candidates.length) {
    const id =
      forced && candidates.includes(forced) ? forced : randomItem(candidates);
    r.nextChestItem = null;
    gainItem(r, id);
    r.chestResult = {
      kind: "level",
      item: id,
      level: [...r.weapons, ...r.passives].find((w) => w.id === id)!.level,
    };
  } else {
    heal(r, C.CHEST_HEAL);
    r.chestResult = { kind: "heal" };
  }
  return false;
}
export function addEnemy(r: RunDraft, type: EnemyId, x: number, y: number) {
  const def = C.ENEMIES[type],
    hp =
      def.hp *
      (def.rank === "common"
        ? 1 + C.HP_SCALE_PER_MINUTE * Math.floor(r.tick / C.TICK_HZ / 60)
        : 1);
  r.enemies.push({
    id: r.nextId++,
    type,
    x,
    y,
    hp,
    maxHp: hp,
    heading: unit(
      r.player.x - x,
      r.player.y - y,
      r.player.facing === "right" ? 1 : -1,
    ),
    age: 0,
    contactCooldown: 0,
  });
}
export function addProjectile(
  s: Draft,
  weapon: WeaponId,
  x: number,
  y: number,
  vx: number,
  vy: number,
  pierce: number,
) {
  const r = s.run,
    v = figures(r, weapon),
    d = unit(vx, vy);
  const id = r.nextId++;
  r.projectiles.push({
    id,
    weapon,
    x,
    y,
    vx,
    vy,
    ax: weapon === "sconce" ? -C.SCONCE_DECEL * d.x : 0,
    ay: weapon === "sconce" ? -C.SCONCE_DECEL * d.y : 0,
    radius: v.radius,
    damage: v.damage,
    ttl: v.duration,
    pierce,
    hits: [],
  });
  s.visuals.shapes[id] = {
    born: r.tick + 1,
    angle: 0,
    orbit: 0,
    pulse: r.tick + 1,
  };
}
export function addZone(
  s: Draft,
  weapon: WeaponId,
  kind: ZoneKind,
  x: number,
  y: number,
  ttl: number | null,
) {
  const r = s.run,
    v = figures(r, weapon),
    id = r.nextId++;
  r.zones.push({
    id,
    weapon,
    kind,
    x,
    y,
    radius: kind === "slash" ? 0 : kind === "strike" ? v.area : v.radius,
    ...(kind === "slash" ? { width: v.width, height: v.height } : {}),
    damage: v.damage,
    ttl,
    hits: [],
  });
  s.visuals.shapes[id] = {
    born: r.tick + 1,
    angle: 0,
    orbit: v.orbit,
    pulse: r.tick + 1,
  };
  return r.zones[r.zones.length - 1]!;
}
export function cleanHits(r: RunDraft) {
  const ids = new Set(r.enemies.map((e) => e.id));
  for (const e of [...r.projectiles, ...r.zones])
    e.hits = e.hits.filter((h) => ids.has(h.enemy));
}
export function dropRoll(r: DeepReadonly<RunState>) {
  return (
    r.nextDrop ??
    (Math.random() < C.BREAD_CHANCE
      ? "bread"
      : Math.random() < C.DRAFT_CHANCE
        ? "draft"
        : "none")
  );
}
