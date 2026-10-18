import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import type { WickState, Screen, WeaponId } from "./types";
import type { WickDebugApi, WickSnapshot } from "./debug-types";
import {
  copy,
  initial,
  stats,
  xpNext,
  pool,
  windowIndex,
  commons,
  isBase,
  isWeapon,
  isPassive,
  accept,
  addEnemy,
  addProjectile,
  addZone,
  cleanHits,
  unit,
  dropRoll,
  type Draft,
} from "./model";
import { menuRects, tabRects } from "./menus";
const requireValue = (ok: boolean): void => {
  if (!ok) throw new Error("Wick: invalid debug argument");
};
function number(n: number, min = -Infinity, max = Infinity, integer = false) {
  requireValue(
    Number.isFinite(n) &&
      n >= min &&
      n <= max &&
      (!integer || Number.isInteger(n)),
  );
}
function member<T extends string>(id: T, ids: readonly string[]) {
  requireValue(ids.includes(id));
}
function pose(
  s: DeepReadonly<WickState>,
  change: (draft: Draft) => void,
): WickState {
  const d = copy(s);
  change(d);
  return d;
}
function enemy(s: Draft, id: number) {
  const e = s.run.enemies.find((e) => e.id === id);
  requireValue(!!e);
  return e!;
}
function held<T>(items: T[], index: number) {
  number(index, 0, items.length - 1, true);
  return items[index]!;
}
const weapons = [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS];
const screens: Screen[] = [
  "title",
  "howto",
  "almanac",
  "playing",
  "levelup",
  "chest",
  "paused",
  "fallen",
  "dawn",
];
function snapshot(s: DeepReadonly<WickState>): WickSnapshot {
  const d = copy(s),
    { visuals: _visuals, ...base } = d;
  void _visuals;
  const r = d.run,
    v = stats(r);
  return {
    ...base,
    version: C.WICK_DEBUG_VERSION,
    run: {
      ...r,
      time: r.tick / C.TICK_HZ,
      xpToNext: xpNext(r.level),
      maxHp: v.maxHp,
      armor: v.armor,
      moveSpeed: v.moveSpeed,
      pickupRadius: v.pickupRadius,
      spawnWindow: windowIndex(r.tick),
      aliveCommons: commons(r),
      pool: s.screen === "levelup" ? pool(r) : [],
    },
  };
}
const switchPose =
  (
    key:
      | "spawning"
      | "events"
      | "despawning"
      | "enemyMotion"
      | "enemyContact"
      | "weaponFire"
      | "effectMotion"
      | "drops"
      | "progression",
  ) =>
  (s: DeepReadonly<WickState>, on: boolean) => {
    requireValue(typeof on === "boolean");
    return pose(s, (d) => {
      d[key] = on;
    });
  };
export const debug: WickDebugApi = {
  version: C.WICK_DEBUG_VERSION,
  reset: (s) => ({ ...initial(), muted: s.muted }),
  snapshot,
  reconcile: copy,
  menuRects,
  tabRects,
  setScreen: (s, name) => {
    member(name, screens);
    return pose(s, (d) => {
      d.screen = name;
      d.menuIndex = d.almanacTab = d.almanacScroll = 0;
      d.visuals.armed = null;
      if (name !== "playing") d.accumulator = 0;
    });
  },
  choose: (s, index) => {
    number(index, 0, s.run.offers.length - 1, true);
    return pose(s, (d) => accept(d, index));
  },
  setSpawning: switchPose("spawning"),
  setEvents: switchPose("events"),
  setDespawning: switchPose("despawning"),
  setEnemyMotion: switchPose("enemyMotion"),
  setEnemyContact: switchPose("enemyContact"),
  setWeaponFire: switchPose("weaponFire"),
  setEffectMotion: switchPose("effectMotion"),
  setDrops: switchPose("drops"),
  setProgression: switchPose("progression"),
  setTick: (s, tick) => {
    number(tick, 0, C.DAWN_TIME * C.TICK_HZ - 1, true);
    return pose(s, (d) => {
      // Posing the run clock is not elapsed time for any live shape.
      const shift = tick - d.run.tick;
      for (const shape of Object.values(d.visuals.shapes)) {
        shape.born += shift;
        shape.pulse += shift;
      }
      for (const puff of d.visuals.puffs) puff.tick += shift;
      d.run.tick = tick;
    });
  },
  setSpawnTimer: (s, seconds) => {
    number(seconds, 0);
    return pose(s, (d) => {
      d.run.spawnTimer = seconds;
    });
  },
  setNextSpawnAngle: (s, degrees) => {
    number(degrees, 0, 360);
    requireValue(degrees < 360);
    return pose(s, (d) => {
      d.run.nextSpawnAngle = degrees;
    });
  },
  setNextSwarmAngle: (s, degrees) => {
    number(degrees, 0, 360);
    requireValue(degrees < 360);
    return pose(s, (d) => {
      d.run.nextSwarmAngle = degrees;
    });
  },
  setNextSpawnType: (s, id) => {
    member(id, C.ENEMY_IDS);
    return pose(s, (d) => {
      d.run.nextSpawnType = id;
    });
  },
  setNextPuddleOffset: (s, x, y) => {
    number(x);
    number(y);
    requireValue(Math.hypot(x, y) <= C.OIL_SCATTER);
    return pose(s, (d) => {
      d.run.nextPuddleOffset = { x, y };
    });
  },
  setNextStrikeTarget: (s, id) => {
    number(id, 0, Infinity, true);
    requireValue(s.run.enemies.some((e) => e.id === id));
    return pose(s, (d) => {
      d.run.nextStrikeTarget = id;
    });
  },
  setNextChestItem: (s, id) => {
    member(id, [...C.BASE_WEAPON_IDS, ...C.PASSIVE_IDS]);
    return pose(s, (d) => {
      d.run.nextChestItem = id;
    });
  },
  setNextDrop: (s, kind) => {
    member(kind, ["bread", "draft", "none"]);
    return pose(s, (d) => {
      d.run.nextDrop = kind;
    });
  },
  rollDrop: (s) => dropRoll({ ...s.run, nextDrop: null }),
  setPlayerPosition: (s, x, y) => {
    number(x);
    number(y);
    return pose(s, (d) => {
      d.run.player.x = x;
      d.run.player.y = y;
    });
  },
  setFacing: (s, facing) => {
    member(facing, ["left", "right"]);
    return pose(s, (d) => {
      d.run.player.facing = facing;
    });
  },
  setHp: (s, hp) => {
    number(hp);
    return pose(s, (d) => {
      d.run.player.hp = hp;
    });
  },
  setLevel: (s, level) => {
    number(level, 1, Infinity, true);
    return pose(s, (d) => {
      d.run.level = level;
    });
  },
  setXp: (s, xp) => {
    number(xp, 0);
    return pose(s, (d) => {
      d.run.xp = xp;
    });
  },
  setKills: (s, kills) => {
    number(kills, 0, Infinity, true);
    return pose(s, (d) => {
      d.run.kills = kills;
    });
  },
  setPendingLevelUps: (s, count) => {
    number(count, 0, Infinity, true);
    return pose(s, (d) => {
      d.run.pendingLevelUps = count;
    });
  },
  setNextOffers: (s, ids) => {
    requireValue(
      ids.length > 0 &&
        ids.length <= C.OFFER_COUNT &&
        new Set(ids).size === ids.length,
    );
    for (const id of ids)
      member(id, [...weapons, ...C.PASSIVE_IDS, C.LAMP_OIL_ID]);
    return pose(s, (d) => {
      d.run.nextOffers = [...ids];
    });
  },
  setWeapon: (s, slot, id, level) => {
    member(id, weapons);
    number(slot, 0, Math.min(C.WEAPON_SLOTS - 1, s.run.weapons.length), true);
    number(level, 1, isBase(id) ? C.MAX_WEAPON_LEVEL : 1, true);
    const family = (id: WeaponId) => (isBase(id) ? id : C.EVOLUTIONS[id].from);
    requireValue(
      !s.run.weapons.some((w, i) => i !== slot && family(w.id) === family(id)),
    );
    return pose(s, (d) => {
      const prior = d.run.weapons[slot];
      d.run.weapons[slot] = {
        id,
        level,
        cooldown: prior?.id === id ? prior.cooldown : 0,
      };
    });
  },
  setWeaponCooldown: (s, slot, seconds) => {
    number(seconds, 0);
    return pose(s, (d) => {
      held(d.run.weapons, slot).cooldown = seconds;
    });
  },
  removeWeapon: (s, slot) =>
    pose(s, (d) => {
      held(d.run.weapons, slot);
      d.run.weapons.splice(slot, 1);
    }),
  setPassive: (s, slot, id, level) => {
    requireValue(isPassive(id));
    number(slot, 0, Math.min(C.PASSIVE_SLOTS - 1, s.run.passives.length), true);
    number(level, 1, C.PASSIVES[id].maxLevel, true);
    requireValue(!s.run.passives.some((p, i) => p.id === id && i !== slot));
    return pose(s, (d) => {
      d.run.passives[slot] = { id, level };
    });
  },
  removePassive: (s, slot) =>
    pose(s, (d) => {
      held(d.run.passives, slot);
      d.run.passives.splice(slot, 1);
    }),
  spawnEnemy: (s, type, x, y) => {
    member(type, C.ENEMY_IDS);
    number(x);
    number(y);
    return pose(s, (d) => addEnemy(d.run, type, x, y));
  },
  setEnemyPosition: (s, id, x, y) => {
    number(x);
    number(y);
    return pose(s, (d) => {
      const e = enemy(d, id);
      e.x = x;
      e.y = y;
    });
  },
  setEnemyHp: (s, id, hp) => {
    number(hp);
    requireValue(hp > 0);
    return pose(s, (d) => {
      enemy(d, id).hp = hp;
    });
  },
  setEnemyHeading: (s, id, x, y) => {
    number(x);
    number(y);
    requireValue(Math.hypot(x, y) > 0);
    return pose(s, (d) => {
      enemy(d, id).heading = unit(x, y);
    });
  },
  setEnemyAge: (s, id, seconds) => {
    number(seconds, 0);
    return pose(s, (d) => {
      enemy(d, id).age = seconds;
    });
  },
  setEnemyContactCooldown: (s, id, seconds) => {
    number(seconds, 0);
    return pose(s, (d) => {
      enemy(d, id).contactCooldown = seconds;
    });
  },
  removeEnemy: (s, id) =>
    pose(s, (d) => {
      enemy(d, id);
      d.run.enemies = d.run.enemies.filter((e) => e.id !== id);
      cleanHits(d.run);
    }),
  clearEnemies: (s) =>
    pose(s, (d) => {
      d.run.enemies = [];
      cleanHits(d.run);
    }),
  spawnProjectile: (s, weapon, x, y, vx, vy, pierce) => {
    member(weapon, ["ember", "pin", "shard", "sconce", "beacon", "hail"]);
    for (const n of [x, y, vx, vy]) number(n);
    number(pierce, C.INFINITE_PIERCE, Infinity, true);
    if (weapon === "sconce") requireValue(Math.hypot(vx, vy) > 0);
    return pose(s, (d) => addProjectile(d, weapon, x, y, vx, vy, pierce));
  },
  clearProjectiles: (s) =>
    pose(s, (d) => {
      d.run.projectiles = [];
    }),
  spawnPuddle: (s, weapon, x, y) => {
    member(weapon, ["oil-splash", "blaze"]);
    number(x);
    number(y);
    return pose(s, (d) => {
      addZone(d, weapon, "puddle", x, y, figuresFor(d, weapon));
    });
  },
  clearZones: (s) =>
    pose(s, (d) => {
      d.run.zones = [];
    }),
  spawnGem: (s, tier, x, y) => {
    member(tier, C.GEM_TIERS);
    number(x);
    number(y);
    return pose(s, (d) => {
      d.run.gems.push({ id: d.run.nextId++, tier, x, y, attracted: false });
    });
  },
  setGemAttracted: (s, id, attracted) => {
    requireValue(typeof attracted === "boolean");
    return pose(s, (d) => {
      const gem = d.run.gems.find((g) => g.id === id);
      requireValue(!!gem);
      gem!.attracted = attracted;
    });
  },
  clearGems: (s) =>
    pose(s, (d) => {
      d.run.gems = [];
    }),
  spawnPickup: (s, kind, x, y) => {
    member(kind, C.PICKUP_KINDS);
    number(x);
    number(y);
    return pose(s, (d) => {
      d.run.pickups.push({ id: d.run.nextId++, kind, x, y });
    });
  },
  clearPickups: (s) =>
    pose(s, (d) => {
      d.run.pickups = [];
    }),
};
import { figures } from "./model";
const figuresFor = (s: Draft, w: WeaponId) => {
  requireValue(isWeapon(w));
  return figures(s.run, w).duration;
};
