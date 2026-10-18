import * as C from "./constants";
import type { WeaponId } from "./types";
import {
  type Draft,
  type RunDraft,
  stats,
  figures,
  countdown,
  distance,
  unit,
  randomItem,
  xpNext,
  windowIndex,
  commons,
  heal,
  openLevel,
  chest,
  addEnemy,
  addProjectile,
  addZone,
  cleanHits,
  dropRoll,
} from "./model";
export type CueSink = (cue: C.CueName) => void;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

function fireWeapons(s: Draft): Set<WeaponId> {
  const r = s.run,
    p = r.player,
    pulses = new Set<WeaponId>();
  const nearest = [...r.enemies].sort(
    (a, b) => distance(a, p) - distance(b, p) || a.id - b.id,
  );
  for (const w of r.weapons) {
    if (w.id === "chandelier") {
      w.cooldown = 0;
      continue;
    }
    if (!s.weaponFire) continue;
    w.cooldown = countdown(w.cooldown);
    if (w.cooldown) continue;
    const v = figures(r, w.id),
      facing = p.facing === "right" ? 1 : -1;
    w.cooldown = v.cooldown + (w.id === "lantern" ? v.duration : 0);
    if (w.id === "halo" || w.id === "corona") {
      pulses.add(w.id);
      continue;
    }
    if (w.id === "taper" || w.id === "pyre") {
      for (let i = 0; i < Math.min(C.TAPER_MAX_AMOUNT, v.amount); i++)
        addZone(
          s,
          w.id,
          "slash",
          p.x + (v.width / 2) * facing * (i ? -1 : 1),
          p.y,
          C.SLASH_FLASH,
        );
    } else if (w.id === "oil-splash" || w.id === "blaze") {
      for (let i = 0; i < v.amount; i++) {
        const a = Math.random() * Math.PI * 2,
          d = C.OIL_SCATTER * Math.sqrt(Math.random()),
          offset = r.nextPuddleOffset ?? {
            x: Math.cos(a) * d,
            y: Math.sin(a) * d,
          };
        r.nextPuddleOffset = null;
        addZone(s, w.id, "puddle", p.x + offset.x, p.y + offset.y, v.duration);
      }
    } else if (w.id === "lantern") {
      for (let i = 0; i < v.amount; i++) {
        const z = addZone(s, w.id, "lantern", p.x, p.y, v.duration);
        s.visuals.shapes[z.id]!.angle = (i * Math.PI * 2) / v.amount;
      }
    } else if (w.id === "flare") {
      addZone(s, w.id, "burst", p.x, p.y, C.FLARE_FLASH);
    } else if (w.id === "spark") {
      const targets = nearest.filter((e) => distance(e, p) <= C.SPARK_RANGE);
      for (let i = 0; i < v.amount && targets.length; i++) {
        const e =
          targets.find((e) => e.id === r.nextStrikeTarget) ??
          randomItem(targets);
        r.nextStrikeTarget = null;
        targets.splice(targets.indexOf(e), 1);
        addZone(s, w.id, "strike", e.x, e.y, C.SPARK_FLASH);
      }
    } else {
      if (["ember", "beacon", "sconce"].includes(w.id) && !nearest.length)
        continue;
      const count = ["ember", "beacon"].includes(w.id)
        ? Math.min(v.amount, nearest.length)
        : v.amount;
      for (let i = 0; i < count; i++) {
        const target = nearest[["ember", "beacon"].includes(w.id) ? i : 0];
        let dir = target
          ? unit(target.x - p.x, target.y - p.y, facing)
          : { x: facing, y: 0 };
        let y = p.y;
        if (w.id === "pin" || w.id === "hail") {
          dir = { x: facing, y: 0 };
          y += (i - (count - 1) / 2) * C.PIN_SPREAD;
        }
        const angle =
          Math.atan2(dir.y, dir.x) +
          radians(
            (i - (count - 1) / 2) *
              (w.id === "shard"
                ? C.SHARD_SPREAD
                : w.id === "sconce"
                  ? C.SCONCE_SPREAD
                  : 0),
          );
        addProjectile(
          s,
          w.id,
          p.x,
          y,
          Math.cos(angle) * v.speed,
          Math.sin(angle) * v.speed,
          v.pierce,
        );
      }
    }
  }
  return pulses;
}
function place(s: Draft, firstId: number) {
  const r = s.run,
    p = r.player,
    held = new Set(r.weapons.map((w) => w.id));
  r.zones = r.zones.filter(
    (z) => !(z.kind === "aura" || z.kind === "lantern") || held.has(z.weapon),
  );
  for (const w of r.weapons) {
    const v = figures(r, w.id);
    if (
      (w.id === "halo" || w.id === "corona") &&
      !r.zones.some((z) => z.weapon === w.id && z.kind === "aura")
    )
      addZone(s, w.id, "aura", p.x, p.y, null);
    if (w.id === "chandelier") {
      const lanterns = r.zones.filter((z) => z.weapon === w.id);
      if (lanterns.length !== v.amount) {
        const angle = lanterns[0] ? s.visuals.shapes[lanterns[0].id]!.angle : 0;
        r.zones = r.zones.filter(
          (z) => z.weapon !== w.id && z.weapon !== "lantern",
        );
        for (let i = 0; i < v.amount; i++) {
          const z = addZone(s, w.id, "lantern", p.x, p.y, null);
          s.visuals.shapes[z.id]!.angle = angle + (i * Math.PI * 2) / v.amount;
        }
      }
    }
  }
  for (const z of r.zones) {
    const meta = s.visuals.shapes[z.id];
    if (!meta) continue;
    if (z.kind === "aura") {
      const v = figures(r, z.weapon);
      z.x = p.x;
      z.y = p.y;
      z.radius = v.radius;
      z.damage = v.damage;
    }
    if (z.kind === "lantern") {
      if (z.weapon === "chandelier") {
        const v = figures(r, z.weapon);
        meta.orbit = v.orbit;
        z.radius = v.radius;
        z.damage = v.damage;
      }
      if (s.effectMotion && z.id < firstId)
        meta.angle += radians(C.LANTERN_ANGULAR_SPEED) * C.TICK_DT;
      z.x = p.x + Math.cos(meta.angle) * meta.orbit;
      z.y = p.y + Math.sin(meta.angle) * meta.orbit;
    }
  }
}
function moveEnemies(s: Draft) {
  const r = s.run;
  for (const e of r.enemies) {
    const def = C.ENEMIES[e.type],
      oldAge = e.age;
    e.age += C.TICK_DT;
    if (!s.enemyMotion) continue;
    if (def.behavior === "drift") {
      e.x += e.heading.x * def.speed * C.TICK_DT;
      e.y += e.heading.y * def.speed * C.TICK_DT;
      continue;
    }
    const oldOffset =
      def.behavior === "weave"
        ? C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * oldAge) / C.WISP_PERIOD)
        : 0;
    const anchor = {
      x: e.x + e.heading.y * oldOffset,
      y: e.y - e.heading.x * oldOffset,
    };
    if (distance(anchor, r.player) === 0) continue;
    e.heading = unit(r.player.x - anchor.x, r.player.y - anchor.y);
    const offset =
      def.behavior === "weave"
        ? C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * e.age) / C.WISP_PERIOD)
        : 0;
    e.x = anchor.x + e.heading.x * def.speed * C.TICK_DT - e.heading.y * offset;
    e.y = anchor.y + e.heading.y * def.speed * C.TICK_DT + e.heading.x * offset;
  }
}
function effects(
  s: Draft,
  firstId: number,
  pulses: Set<WeaponId>,
  cues: Set<C.CueName>,
) {
  const r = s.run;
  for (const shape of [...r.projectiles, ...r.zones]) {
    if (shape.id < firstId && shape.ttl !== null)
      shape.ttl = countdown(shape.ttl);
    shape.hits = shape.hits
      .map((h) => ({ ...h, cooldown: countdown(h.cooldown) }))
      .filter((h) => h.cooldown > 0);
  }
  r.projectiles = r.projectiles.filter((p) => p.ttl > 0);
  r.zones = r.zones.filter((z) => z.ttl !== 0);
  for (const p of r.projectiles) {
    if (p.id < firstId && s.effectMotion) {
      p.x += p.vx * C.TICK_DT;
      p.y += p.vy * C.TICK_DT;
      p.vx += p.ax * C.TICK_DT;
      p.vy += p.ay * C.TICK_DT;
      if (p.weapon === "shard") {
        for (const axis of ["x", "y"] as const) {
          const half = axis === "x" ? C.STAGE_CX : C.STAGE_CY,
            velocity = axis === "x" ? "vx" : "vy",
            lo = r.player[axis] - half,
            hi = r.player[axis] + half;
          if (p[axis] < lo) {
            p[axis] = lo;
            if (p[velocity] < 0) p[velocity] *= -1;
          }
          if (p[axis] > hi) {
            p[axis] = hi;
            if (p[velocity] > 0) p[velocity] *= -1;
          }
        }
      }
    }
    for (const e of r.enemies) {
      if (
        p.hits.some((h) => h.enemy === e.id) ||
        distance(p, e) >= p.radius + C.ENEMIES[e.type].radius
      )
        continue;
      e.hp -= p.damage;
      cues.add(C.CUES.hit);
      p.hits.push({
        enemy: e.id,
        cooldown:
          p.pierce === C.INFINITE_PIERCE
            ? p.weapon === "sconce"
              ? C.SCONCE_REHIT
              : C.SHARD_REHIT
            : p.ttl,
      });
      if (p.pierce === 0) {
        p.ttl = 0;
        break;
      }
      if (p.pierce > 0) p.pierce--;
    }
  }
  r.projectiles = r.projectiles.filter((p) => p.ttl > 0);
  for (const z of r.zones) {
    const meta = s.visuals.shapes[z.id]!;
    if (z.kind === "aura" && !pulses.has(z.weapon)) continue;
    if (z.kind === "puddle") {
      const interval = Math.round(
        (z.weapon === "blaze" ? C.BLAZE_PULSE : C.OIL_PULSE) * C.TICK_HZ,
      );
      if (r.tick < meta.pulse || (r.tick - meta.pulse) % interval !== 0)
        continue;
    }
    if (["slash", "strike", "burst"].includes(z.kind) && z.id < firstId)
      continue;
    for (const e of r.enemies) {
      const er = C.ENEMIES[e.type].radius;
      let hits = distance(z, e) < z.radius + er;
      if (z.kind === "slash")
        hits =
          Math.hypot(
            Math.max(0, Math.abs(e.x - z.x) - z.width! / 2),
            Math.max(0, Math.abs(e.y - z.y) - z.height! / 2),
          ) < er;
      if (z.kind === "strike" || z.kind === "burst")
        hits = distance(z, e) <= z.radius;
      if (z.kind === "burst" && C.FLARE_IMMUNE.includes(e.type)) hits = false;
      if (!hits || z.hits.some((h) => h.enemy === e.id)) continue;
      const before = e.hp;
      e.hp -= z.damage;
      cues.add(C.CUES.hit);
      if (z.kind === "lantern")
        z.hits.push({ enemy: e.id, cooldown: C.LANTERN_REHIT });
      if (z.weapon === "pyre") heal(r, C.PYRE_HEAL);
      if (z.weapon === "corona" && before > 0 && e.hp <= 0)
        heal(r, C.CORONA_HEAL);
    }
  }
  for (const e of r.enemies.filter((e) => e.hp <= 0)) {
    r.kills++;
    cues.add(C.CUES.kill);
    s.visuals.puffs.push({ x: e.x, y: e.y, tick: r.tick });
    if (!s.drops) continue;
    const def = C.ENEMIES[e.type];
    if (def.rank === "common") {
      r.gems.push({
        id: r.nextId++,
        tier: def.drop as C.GemTier,
        x: e.x,
        y: e.y,
        attracted: false,
      });
      const drop = dropRoll(r);
      r.nextDrop = null;
      if (drop !== "none")
        r.pickups.push({ id: r.nextId++, kind: drop, x: e.x, y: e.y });
    } else if (def.rank === "elite")
      r.pickups.push({ id: r.nextId++, kind: "chest", x: e.x, y: e.y });
  }
  r.enemies = r.enemies.filter((e) => e.hp > 0);
  cleanHits(r);
}
function director(s: Draft) {
  const r = s.run,
    p = r.player;
  if (s.despawning) {
    r.enemies = r.enemies.filter(
      (e) =>
        C.ENEMIES[e.type].rank !== "common" ||
        distance(e, p) <= C.DESPAWN_DISTANCE,
    );
    cleanHits(r);
  }
  const ring = (type: C.EnemyId) => {
    const a = radians(r.nextSpawnAngle ?? Math.random() * 360);
    r.nextSpawnAngle = null;
    addEnemy(
      r,
      type,
      p.x + Math.cos(a) * C.SPAWN_DISTANCE,
      p.y + Math.sin(a) * C.SPAWN_DISTANCE,
    );
  };
  if (s.events)
    for (const event of C.EVENTS) {
      if (
        r.tick !== event.time * C.TICK_HZ ||
        r.firedEvents.includes(event.time)
      )
        continue;
      r.firedEvents.push(event.time);
      r.firedEvents.sort((a, b) => a - b);
      if (event.kind === "spawn") ring(event.type);
      else {
        const a = radians(r.nextSwarmAngle ?? Math.random() * 360),
          dx = Math.cos(a),
          dy = Math.sin(a);
        r.nextSwarmAngle = null;
        for (let i = 0; i < C.SWARM_SIZE; i++) {
          const offset =
            ((i - (C.SWARM_SIZE - 1) / 2) * C.SWARM_LINE) / (C.SWARM_SIZE - 1);
          addEnemy(
            r,
            event.type,
            p.x + dx * C.SPAWN_DISTANCE - dy * offset,
            p.y + dy * C.SPAWN_DISTANCE + dx * offset,
          );
          r.enemies[r.enemies.length - 1]!.heading = { x: -dx, y: -dy };
        }
      }
    }
  if (s.spawning) {
    const wi = windowIndex(r.tick),
      w = C.SPAWN_WINDOWS[wi]!;
    if (wi !== windowIndex(r.tick - 1)) r.spawnTimer = 0;
    r.spawnTimer = countdown(r.spawnTimer);
    if (!r.spawnTimer && commons(r) < w.cap) {
      const type =
        r.nextSpawnType && w.types.includes(r.nextSpawnType)
          ? r.nextSpawnType
          : randomItem(w.types);
      r.nextSpawnType = null;
      ring(type);
      r.spawnTimer = w.interval;
    }
  }
}
function collect(s: Draft, firstId: number, cues: Set<C.CueName>): boolean {
  const r = s.run,
    d = stats(r);
  let gotChest = false;
  r.pickups = r.pickups.filter((p) => {
    if (distance(p, r.player) >= C.PICKUP_ITEM_RADIUS + C.PLAYER_RADIUS)
      return true;
    if (p.kind === "chest") {
      if (gotChest) return true;
      gotChest = true;
      if (chest(r)) cues.add(C.CUES.evolve);
    } else {
      cues.add(C.CUES.pickup);
      if (p.kind === "bread") heal(r, C.BREAD_HEAL);
      else for (const g of r.gems) g.attracted = true;
    }
    return false;
  });
  r.gems = r.gems.filter((g) => {
    let dist = distance(g, r.player);
    if (dist <= d.pickupRadius) g.attracted = true;
    if (g.attracted && g.id < firstId && dist > 0) {
      const step = Math.min(dist, C.GEM_SPEED * C.TICK_DT);
      g.x += ((r.player.x - g.x) / dist) * step;
      g.y += ((r.player.y - g.y) / dist) * step;
    }
    dist = distance(g, r.player);
    if (dist > C.COLLECT_RADIUS) return true;
    r.xp += C.GEM_VALUES[g.tier] * d.xpMul;
    cues.add(C.CUES.gem);
    if (s.progression)
      while (r.xp >= xpNext(r.level)) {
        r.xp -= xpNext(r.level);
        r.level++;
        r.pendingLevelUps++;
      }
    return false;
  });
  return gotChest;
}
/** One ordered, render-free tick. All writes are confined to the frame's private draft. */
export function tick(s: Draft, dx: number, dy: number, play: CueSink) {
  const r = rOf(s),
    firstId = r.nextId,
    cues = new Set<C.CueName>();
  r.tick++;
  const d = stats(r),
    length = Math.hypot(dx, dy);
  s.visuals.moved = length > 0;
  if (length) {
    r.player.x += (dx / length) * d.moveSpeed * C.TICK_DT;
    r.player.y += (dy / length) * d.moveSpeed * C.TICK_DT;
    s.visuals.moveTicks++;
    if (dx) r.player.facing = dx < 0 ? "left" : "right";
  }
  heal(r, d.recovery * C.TICK_DT);
  moveEnemies(s);
  const pulses = fireWeapons(s);
  place(s, firstId);
  // New shapes start at this tick. Poses use the following tick as their birth.
  for (const shape of [...r.projectiles, ...r.zones])
    if (shape.id >= firstId) {
      const m = s.visuals.shapes[shape.id]!;
      m.born = r.tick;
      m.pulse = r.tick;
    }
  effects(s, firstId, pulses, cues);
  r.hurtFlash = countdown(r.hurtFlash);
  for (const e of r.enemies) {
    e.contactCooldown = countdown(e.contactCooldown);
    if (
      s.enemyContact &&
      !e.contactCooldown &&
      distance(e, r.player) < C.ENEMIES[e.type].radius + C.PLAYER_RADIUS
    ) {
      r.player.hp -= Math.max(
        C.MIN_DAMAGE_TAKEN,
        C.ENEMIES[e.type].damage - d.armor,
      );
      e.contactCooldown = C.CONTACT_COOLDOWN;
      r.hurtFlash = C.HURT_FLASH;
      cues.add(C.CUES.hurt);
    }
  }
  const gotChest = collect(s, firstId, cues);
  director(s);
  if (r.tick >= C.DAWN_TIME * C.TICK_HZ) {
    s.screen = "dawn";
    cues.add(C.CUES.dawn);
  } else if (r.player.hp <= 0) {
    s.screen = "fallen";
    cues.add(C.CUES.fallen);
  } else if (gotChest) {
    s.screen = "chest";
    cues.add(C.CUES.chest);
  } else if (r.pendingLevelUps) {
    openLevel(s);
    cues.add(C.CUES.levelUp);
  }
  if (s.screen !== "playing") {
    s.accumulator = 0;
    s.menuIndex = 0;
  }
  s.visuals.puffs = s.visuals.puffs.filter(
    (p) => (r.tick - p.tick) * C.TICK_DT < C.PUFF_TIME,
  );
  const live = new Set([...r.projectiles, ...r.zones].map((z) => z.id));
  for (const id of Object.keys(s.visuals.shapes))
    if (!live.has(+id)) delete s.visuals.shapes[+id];
  for (const cue of cues) play(cue);
}
const rOf = (s: Draft): RunDraft => s.run;
