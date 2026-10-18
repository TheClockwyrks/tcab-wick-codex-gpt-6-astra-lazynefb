/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import type { Engine } from "@clockwyrks/simple-2d";
import { game, type WickState, type WickDebugApi, BACKGROUND } from "./game";
import * as C from "./constants";
import { images, imagePaths } from "./assets";
import { figures, pool, row, stats } from "./model";

let engine: Engine<WickState, WickDebugApi>;
let target: EventTarget;
let cues: string[];
const pose = (f: (s: WickState, d: WickDebugApi) => WickState) =>
  engine.apply((s) => f(s, engine.debug));
const step = async (ticks = 1) => {
  engine.setClock(new ConstantClock((ticks * 1000) / C.TICK_HZ));
  await engine.advance(1);
};
const key = (code: string, type = "keydown") =>
  target.dispatchEvent(Object.assign(new Event(type), { code, repeat: false }));
async function press(code: string) {
  key(code);
  await step();
  key(code, "keyup");
  await step();
}
const pointer = (type: string, x: number, y: number, buttons: number) =>
  target.dispatchEvent(
    Object.assign(new Event(type), {
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons,
    }),
  );
function isolated() {
  pose((s, d) => d.setScreen(s, "playing"));
  for (const flag of [
    "setSpawning",
    "setEvents",
    "setEnemyMotion",
    "setEnemyContact",
    "setDrops",
  ] as const)
    pose((s, d) => d[flag](s, false));
}
beforeEach(async () => {
  vi.stubGlobal(
    "fetch",
    async (path: string) => new Response(await readFile(path)),
  );
  vi.stubGlobal("createImageBitmap", async (blob: Blob) =>
    loadImage(Buffer.from(await blob.arrayBuffer())),
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      async decodeAudioData(bytes: ArrayBuffer) {
        expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
        return { duration: 1 };
      }
      async resume() {}
    },
  );
  target = new EventTarget();
  cues = [];
  const canvas = createCanvas(C.STAGE_W, C.STAGE_H);
  engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    background: BACKGROUND,
    game,
    clock: new ConstantClock(1000 / C.TICK_HZ),
    surface: {
      cssWidth: () => C.STAGE_W,
      cssHeight: () => C.STAGE_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  engine.events.on("cue:played", (e) => cues.push(e.cue));
  await engine.initialize();
});
afterEach(() => {
  engine.destroy();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("engine, screens, and immutable state", () => {
  it("loads every committed image and reports the idle state", async () => {
    await step();
    expect(images.size).toBe(imagePaths().length);
    expect(engine.debug.snapshot(engine.state).run).toMatchObject({
      tick: 0,
      level: 1,
      maxHp: 100,
      weapons: [],
      pool: [],
    });
    expect(engine.diagnostics().length).toBeGreaterThanOrEqual(20);
  });
  it("starts from the keyboard and consumes the entering frame", async () => {
    key("Enter");
    await step();
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.run.tick).toBe(1);
    expect(engine.state.run.weapons[0]?.id).toBe("taper");
    expect(engine.state.run.enemies).toHaveLength(1);
    expect(cues).toContain(C.CUES.menuConfirm);
  });
  it("normalizes diagonal movement and does not mutate the previous value", async () => {
    isolated();
    const old = engine.state;
    key("KeyW");
    key("KeyD");
    await step(60);
    expect(
      Math.hypot(engine.state.run.player.x, engine.state.run.player.y),
    ).toBeCloseTo(C.MOVE_SPEED);
    expect(old.run.player.x).toBe(0);
    expect(old.run.tick).toBe(0);
  });
  it("retains facing on vertical motion and cancels opposites", async () => {
    isolated();
    key("KeyA");
    await step();
    key("KeyD");
    key("KeyW");
    await step();
    expect(engine.state.run.player).toMatchObject({
      x: -3,
      y: -3,
      facing: "left",
    });
  });
  it("accumulates fractional frames, then discards remainder when paused", async () => {
    isolated();
    engine.setClock(new ConstantClock(5));
    await engine.advance(3);
    expect(engine.state.run.tick).toBe(0);
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(1);
    expect(engine.state.accumulator).toBeCloseTo(0.02 - C.TICK_DT);
    key("KeyP");
    await engine.advance(1);
    expect(engine.state.accumulator).toBe(0);
    expect(engine.state.screen).toBe("paused");
  });
  it("holds simulation in menus but advances presentation time", async () => {
    await step(30);
    expect(engine.state.simTime).toBeCloseTo(0.5);
    expect(engine.state.run.tick).toBe(0);
    await press("ArrowDown");
    await press("Enter");
    expect(engine.state.screen).toBe("almanac");
    await press("ArrowRight");
    expect(engine.state.almanacTab).toBe(1);
    await press("Escape");
    expect(engine.state.menuIndex).toBe(1);
  });
  it("requires pointer release inside the armed item", async () => {
    const rect = engine.debug.menuRects(engine.state)[0]!;
    pointer("pointerdown", rect.x + 20, rect.y + 20, 1);
    await step();
    pointer("pointerup", 10, 10, 0);
    await step();
    expect(engine.state.screen).toBe("title");
    pointer("pointerdown", rect.x + 20, rect.y + 20, 1);
    pointer("pointerup", rect.x + 20, rect.y + 20, 0);
    await step();
    expect(engine.state.screen).toBe("playing");
  });
  it("resets all driver switches and history while preserving mute", async () => {
    isolated();
    await press("KeyM");
    pose((s, d) => d.reset(s));
    expect(engine.state).toMatchObject({
      screen: "title",
      simTime: 0,
      spawning: true,
      events: true,
      muted: true,
      visuals: { moveTicks: 0, puffs: [], shapes: {} },
    });
  });
  it("rejects invalid poses without changing state", () => {
    const before = engine.state;
    expect(() => engine.apply((s) => engine.debug.setTick(s, 36000))).toThrow();
    expect(() =>
      engine.apply((s) => engine.debug.setWeapon(s, 2, "taper", 1)),
    ).toThrow();
    expect(() =>
      engine.apply((s) => engine.debug.setNextStrikeTarget(s, 99)),
    ).toThrow();
    expect(() =>
      engine.apply((s) => engine.debug.setNextChestItem(s, "pyre")),
    ).toThrow();
    expect(engine.state).toBe(before);
  });
});

describe("combat and fixed tick ordering", () => {
  it("a slash hits on birth alone, and its rectangle uses strict overlap", async () => {
    isolated();
    pose((s, d) => d.setWeapon(s, 0, "taper", 1));
    pose((s, d) => d.spawnEnemy(s, "hound", 40, 0));
    pose((s, d) => d.spawnEnemy(s, "moth", 130, 0));
    await step();
    expect(engine.state.run.enemies.map((e) => e.hp)).toEqual([110, 5]);
    await step(5);
    expect(engine.state.run.enemies[0]?.hp).toBe(110);
    expect(cues.filter((c) => c === C.CUES.hit)).toHaveLength(1);
  });
  it("counts a finite pierce projectile by ascending enemy id", async () => {
    isolated();
    for (let i = 0; i < 3; i++) pose((s, d) => d.spawnEnemy(s, "hound", 0, 0));
    pose((s, d) => d.spawnProjectile(s, "pin", 0, 0, 0, 0, 1));
    await step();
    expect(engine.state.run.enemies.map((e) => e.hp)).toEqual([114, 114, 120]);
    expect(engine.state.run.projectiles).toHaveLength(0);
  });
  it("removes expired effects before resolving their hit", async () => {
    isolated();
    pose((s, d) => d.spawnProjectile(s, "ember", 0, 0, 0, 0, 0));
    await step(119);
    pose((s, d) => d.spawnEnemy(s, "hound", 0, 0));
    await step();
    expect(engine.state.run.enemies[0]?.hp).toBe(120);
  });
  it("keeps shape damage fixed when a passive is posed later", async () => {
    isolated();
    pose((s, d) => d.spawnProjectile(s, "ember", 0, 0, 0, 0, 0));
    pose((s, d) => d.setPassive(s, 0, "wick", 5));
    pose((s, d) => d.spawnEnemy(s, "hound", 0, 0));
    await step();
    expect(engine.state.run.enemies[0]?.hp).toBe(110);
  });
  it("pulses a posed puddle immediately then at its interval", async () => {
    isolated();
    pose((s, d) => d.spawnEnemy(s, "hound", 0, 0));
    pose((s, d) => d.spawnPuddle(s, "oil-splash", 0, 0));
    await step();
    expect(engine.state.run.enemies[0]?.hp).toBe(116);
    await step(17);
    expect(engine.state.run.enemies[0]?.hp).toBe(116);
    await step();
    expect(engine.state.run.enemies[0]?.hp).toBe(112);
  });
  it("maintains aura placement with firing and effect motion disabled", async () => {
    isolated();
    pose((s, d) => d.setWeapon(s, 0, "halo", 1));
    pose((s, d) => d.setWeaponFire(s, false));
    pose((s, d) => d.setEffectMotion(s, false));
    pose((s, d) => d.setPlayerPosition(s, 90, -30));
    pose((s, d) => d.setPassive(s, 0, "glass", 5));
    await step();
    expect(engine.state.run.zones[0]).toMatchObject({
      kind: "aura",
      x: 90,
      y: -30,
      radius: 120,
      ttl: null,
    });
    pose((s, d) => d.removeWeapon(s, 0));
    await step();
    expect(engine.state.run.zones).toHaveLength(0);
  });
  it("places a Chandelier set permanently, replacing it when amount changes", async () => {
    isolated();
    pose((s, d) => d.setWeapon(s, 0, "chandelier", 1));
    await step();
    expect(engine.state.run.zones).toHaveLength(4);
    const ids = engine.state.run.zones.map((z) => z.id);
    pose((s, d) => d.setPassive(s, 0, "mirror", 2));
    await step();
    expect(engine.state.run.zones).toHaveLength(6);
    expect(
      engine.state.run.zones.every(
        (z) => !ids.includes(z.id) && z.ttl === null,
      ),
    ).toBe(true);
  });
  it("bounces shards against the moving view and integrates sconces position first", async () => {
    isolated();
    pose((s, d) => d.spawnProjectile(s, "shard", 639, 359, 120, 120, -1));
    pose((s, d) => d.spawnProjectile(s, "sconce", 0, 0, 600, 0, -1));
    await step();
    expect(engine.state.run.projectiles[0]).toMatchObject({
      x: 640,
      y: 360,
      vx: -120,
      vy: -120,
    });
    expect(engine.state.run.projectiles[1]).toMatchObject({
      x: 10,
      y: 0,
      vx: 590,
      ax: -600,
    });
  });
  it("uses per-enemy contact cooldowns, even while motion is disabled", async () => {
    isolated();
    pose((s, d) => d.setEnemyContact(s, true));
    pose((s, d) => d.spawnEnemy(s, "moth", 0, 0));
    pose((s, d) => d.spawnEnemy(s, "bat", 0, 0));
    await step();
    expect(engine.state.run.player.hp).toBe(90);
    await step(29);
    expect(engine.state.run.player.hp).toBe(90);
    await step();
    expect(engine.state.run.player.hp).toBe(80);
  });
  it("leaves the Dark immune to Flare while damaging commons", async () => {
    isolated();
    pose((s, d) => d.setWeapon(s, 0, "flare", 8));
    pose((s, d) => d.spawnEnemy(s, "dark", 100, 0));
    pose((s, d) => d.spawnEnemy(s, "hound", 110, 0));
    await step();
    expect(engine.state.run.kills).toBe(1);
    expect(engine.state.run.enemies[0]?.hp).toBe(10000);
  });
  it("heals once per Pyre hit and only on a Corona killing blow", async () => {
    isolated();
    pose((s, d) => d.setHp(s, 20));
    pose((s, d) => d.setWeapon(s, 0, "pyre", 1));
    pose((s, d) => d.spawnEnemy(s, "hound", 50, 0));
    await step();
    expect(engine.state.run.player.hp).toBe(21);
    pose((s, d) => d.setWeapon(s, 0, "corona", 1));
    pose((s, d) => d.spawnEnemy(s, "moth", 70, 0));
    await step();
    expect(engine.state.run.player.hp).toBe(22);
  });
  it.each(C.BASE_WEAPON_IDS)(
    "fires %s with its own shape and level table",
    async (id) => {
      isolated();
      pose((s, d) => d.setWeapon(s, 0, id, 8));
      pose((s, d) => d.spawnEnemy(s, "dark", 100, 0));
      if (id === "oil-splash") pose((s, d) => d.setNextPuddleOffset(s, 100, 0));
      await step();
      expect(
        engine.state.run.projectiles.length + engine.state.run.zones.length,
      ).toBeGreaterThan(0);
      expect(engine.state.run.weapons[0]?.cooldown).toBeCloseTo(
        row(id, 8).cooldown + (id === "lantern" ? row(id, 8).duration : 0),
      );
    },
  );
});

describe("progression, spawns, and endings", () => {
  it("collects newly dropped gems at rest and opens levelup after the full tick", async () => {
    isolated();
    pose((s, d) => d.setDrops(s, true));
    pose((s, d) => d.setNextDrop(s, "none"));
    pose((s, d) => d.setXp(s, 4));
    pose((s, d) => d.setWeapon(s, 0, "taper", 1));
    pose((s, d) => d.spawnEnemy(s, "moth", 2, 0));
    await step(30);
    expect(engine.state.screen).toBe("levelup");
    expect(engine.state.run.tick).toBe(1);
    expect(engine.state.accumulator).toBe(0);
    expect(engine.state.run).toMatchObject({
      level: 2,
      xp: 0,
      kills: 1,
      pendingLevelUps: 1,
    });
  });
  it("resolves queued offers and excludes an evolved weapon’s base", async () => {
    isolated();
    pose((s, d) => d.setWeapon(s, 0, "pyre", 1));
    pose((s, d) => d.setNextOffers(s, ["tallow", "wick", "ember"]));
    pose((s, d) => d.setPendingLevelUps(s, 2));
    await step();
    expect(engine.state.run.offers).toEqual(["tallow", "wick", "ember"]);
    expect(pool(engine.state.run)).not.toContain("taper");
    pose((s, d) => d.choose(s, 0));
    expect(engine.state.run.player.hp).toBe(115);
    expect(engine.state.screen).toBe("levelup");
    pose((s, d) => d.choose(s, 0));
    expect(engine.state.screen).toBe("playing");
  });
  it.each(C.EVOLUTION_IDS)(
    "a chest evolves %s by recipe and keeps slot order",
    async (id) => {
      isolated();
      const recipe = C.EVOLUTIONS[id];
      pose((s, d) => d.setWeapon(s, 0, recipe.from, 8));
      pose((s, d) => d.setPassive(s, 0, recipe.passive, 1));
      pose((s, d) => d.setNextChestItem(s, "wick"));
      pose((s, d) => d.spawnPickup(s, "chest", 0, 0));
      await step();
      expect(engine.state.run.weapons[0]).toEqual({
        id,
        level: 1,
        cooldown: 0,
      });
      expect(engine.state.run.chestResult).toEqual({
        kind: "evolve",
        weapon: id,
      });
      expect(engine.state.run.nextChestItem).toBeNull();
      expect(cues).toContain(C.CUES.evolve);
    },
  );
  it("gives a chest precedence over queued level-ups, but dawn precedence over both", async () => {
    isolated();
    pose((s, d) => d.spawnPickup(s, "chest", 0, 0));
    pose((s, d) => d.setPendingLevelUps(s, 1));
    await step();
    expect(engine.state.screen).toBe("chest");
    await press("Enter");
    expect(engine.state.screen).toBe("levelup");
    pose((s, d) => d.choose(s, 0));
    pose((s, d) => d.setTick(s, C.DAWN_TIME * C.TICK_HZ - 1));
    pose((s, d) => d.setHp(s, 0));
    await step();
    expect(engine.state.screen).toBe("dawn");
    expect(cues).toContain(C.CUES.dawn);
  });
  it("keeps XP unspent with progression off but still collects bread and draft", async () => {
    isolated();
    pose((s, d) => d.setProgression(s, false));
    pose((s, d) => d.setHp(s, 50));
    pose((s, d) => d.spawnPickup(s, "bread", 0, 0));
    pose((s, d) => d.spawnPickup(s, "draft", 0, 0));
    pose((s, d) => d.spawnGem(s, "large", 80, 0));
    await step(8);
    expect(engine.state.run).toMatchObject({ xp: 10, level: 1 });
    expect(engine.state.run.player.hp).toBe(80);
  });
  it("starts the next spawn window on its exact tick and scales commons only", async () => {
    isolated();
    pose((s, d) => d.setSpawning(s, true));
    pose((s, d) => d.setTick(s, 3599));
    pose((s, d) => d.setSpawnTimer(s, 20));
    pose((s, d) => d.setNextSpawnType(s, "rat"));
    pose((s, d) => d.setNextSpawnAngle(s, 0));
    await step();
    expect(engine.state.run.enemies[0]).toMatchObject({
      type: "rat",
      x: C.SPAWN_DISTANCE,
      y: 0,
      maxHp: 17.25,
      age: 0,
    });
  });
  it("spawns all swarm members in a perpendicular line with a shared heading", async () => {
    isolated();
    pose((s, d) => d.setEvents(s, true));
    pose((s, d) => d.setTick(s, 3599));
    pose((s, d) => d.setNextSwarmAngle(s, 0));
    await step();
    expect(engine.state.run.enemies).toHaveLength(C.SWARM_SIZE);
    expect(engine.state.run.enemies[0]).toMatchObject({
      x: 760,
      y: -360,
      heading: { x: -1, y: -0 },
    });
    expect(engine.state.run.firedEvents).toEqual([60]);
  });
  it("despawns commons and removes their re-hit entries, but retains elites", async () => {
    isolated();
    pose((s, d) => d.spawnEnemy(s, "moth", 1300, 0));
    pose((s, d) => d.spawnEnemy(s, "owl", 1500, 0));
    await step();
    expect(engine.state.run.enemies.map((e) => e.type)).toEqual(["owl"]);
  });
  it("derives passives immediately without changing the posed health", () => {
    pose((s, d) => d.setPassive(s, 0, "tallow", 5));
    pose((s, d) => d.setPassive(s, 1, "bellows", 3));
    pose((s, d) => d.setPassive(s, 2, "glass", 2));
    pose((s, d) => d.setPassive(s, 3, "oil", 5));
    expect(stats(engine.state.run)).toMatchObject({
      maxHp: 175,
      moveSpeed: 234,
      areaMul: 1.2,
      cooldownMul: 0.6,
    });
    expect(engine.state.run.player.hp).toBe(100);
    expect(figures(engine.state.run, "beacon").cooldown).toBe(C.MIN_COOLDOWN);
  });
  it("rollDrop ignores a posed outcome and does not consume it", () => {
    pose((s, d) => d.setNextDrop(s, "bread"));
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(engine.debug.rollDrop(engine.state)).toBe("none");
    expect(engine.state.run.nextDrop).toBe("bread");
  });
});

describe("boundary scenarios", () => {
  it("gives identical simulation results across different frame partitions", async () => {
    isolated();
    pose((s, d) => d.setWeapon(s, 0, "pin", 4));
    pose((s, d) => d.spawnEnemy(s, "hound", 250, 0));
    const start = engine.state;
    await step(60);
    const run = engine.debug.snapshot(engine.state).run;
    engine.apply(() => start);
    engine.setClock(new ConstantClock(1000 / C.TICK_HZ));
    await engine.advance(60);
    expect(engine.debug.snapshot(engine.state).run).toEqual(run);
  });
  it("weaves around a moving anchor and leaves a drifter heading fixed", async () => {
    isolated();
    pose((s, d) => d.setEnemyMotion(s, true));
    pose((s, d) => d.spawnEnemy(s, "wisp", 300, 0));
    pose((s, d) => d.spawnEnemy(s, "gnat", 300, 0));
    await step();
    expect(engine.state.run.enemies[0]?.x).toBeCloseTo(298.5);
    expect(engine.state.run.enemies[0]?.y).toBeCloseTo(
      -40 * Math.sin((2 * Math.PI) / 60),
    );
    pose((s, d) => d.setPlayerPosition(s, 300, 300));
    await step();
    expect(engine.state.run.enemies[1]?.heading).toEqual({ x: -1, y: 0 });
  });
  it("aims Ember at distinct nearest enemies with id ties and Spark at eligible targets only", async () => {
    isolated();
    pose((s, d) => d.setWeapon(s, 0, "ember", 2));
    pose((s, d) => d.spawnEnemy(s, "hound", 100, 0));
    pose((s, d) => d.spawnEnemy(s, "hound", -100, 0));
    await step();
    expect(engine.state.run.projectiles.map((p) => p.vx)).toEqual([400, -400]);
    pose((s, d) => d.setWeapon(s, 0, "spark", 2));
    pose((s, d) => d.spawnEnemy(s, "hound", 601, 0));
    pose((s, d) => d.setNextStrikeTarget(s, s.run.enemies[1]!.id));
    await step();
    const strikes = engine.state.run.zones.filter((z) => z.kind === "strike");
    expect(strikes.map((z) => z.x)).toEqual([-100, 100]);
    expect(engine.state.run.enemies[2]?.hp).toBe(120);
    expect(engine.state.run.nextStrikeTarget).toBeNull();
  });
  it("keeps a base lantern set fixed until it expires even when Mirror changes", async () => {
    isolated();
    pose((s, d) => d.setWeapon(s, 0, "lantern", 1));
    await step();
    const lantern = engine.state.run.zones[0]!;
    expect(lantern).toMatchObject({ x: 90, y: 0, ttl: 3 });
    pose((s, d) => d.setPassive(s, 0, "mirror", 2));
    await step(179);
    expect(engine.state.run.zones).toHaveLength(1);
    await step();
    expect(engine.state.run.zones).toHaveLength(0);
    await step(180);
    expect(engine.state.run.zones).toHaveLength(3);
  });
  it("reconciles loops on the next frame, preserving music through pause", async () => {
    const looped: string[] = [],
      stopped: string[] = [];
    engine.events.on("cue:looped", (e) => looped.push(e.cue));
    engine.events.on("cue:stopped", (e) => stopped.push(e.cue));
    isolated();
    pose((s, d) => d.setWeapon(s, 0, "halo", 1));
    await step();
    expect(looped).toEqual([C.CUES.music, C.CUES.hum]);
    pose((s, d) => d.setScreen(s, "paused"));
    await step();
    expect(stopped).toEqual([C.CUES.hum]);
    pose((s, d) => d.reset(s));
    await step();
    expect(stopped).toEqual([C.CUES.hum, C.CUES.music]);
  });
  it.each(C.EVENTS.filter((e) => e.kind === "spawn"))(
    "fires scheduled $type at $time seconds exactly once",
    async (event) => {
      isolated();
      pose((s, d) => d.setEvents(s, true));
      pose((s, d) => d.setNextSpawnAngle(s, 90));
      pose((s, d) => d.setTick(s, event.time * C.TICK_HZ - 1));
      await step();
      expect(engine.state.run.enemies[0]).toMatchObject({
        type: event.type,
        maxHp: C.ENEMIES[event.type].hp,
        y: 760,
      });
      pose((s, d) => d.setTick(s, event.time * C.TICK_HZ - 1));
      await step();
      expect(engine.state.run.enemies).toHaveLength(1);
    },
  );
  it("renders every almanac entry and wraps tabs and highlights", async () => {
    pose((s, d) => d.setScreen(s, "almanac"));
    for (let tab = 0; tab < 4; tab++) {
      const count = [16, 10, 13, 6][tab]!;
      for (let i = 0; i < count; i++) await press("ArrowDown");
      expect(engine.state.menuIndex).toBe(0);
      await press("ArrowRight");
    }
    expect(engine.state.almanacTab).toBe(0);
  });
});

it("posing the run clock preserves live-effect ages and pulse phase", async () => {
  isolated();
  pose((s, d) => d.spawnEnemy(s, "hound", 0, 0));
  pose((s, d) => d.spawnPuddle(s, "oil-splash", 0, 0));
  await step();
  expect(engine.state.run.enemies[0]?.hp).toBe(116);
  pose((s, d) => d.setTick(s, 500));
  await step(17);
  expect(engine.state.run.enemies[0]?.hp).toBe(116);
  await step();
  expect(engine.state.run.enemies[0]?.hp).toBe(112);
});
