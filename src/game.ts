import type { Game } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { WickState } from "./types";
import type { WickDebugApi } from "./debug-types";
import { initial, copy, stats, xpNext, windowIndex } from "./model";
import { debug } from "./debug";
import { loadAssets } from "./assets";
import { menus } from "./menus";
import { tick } from "./simulation";
import { render } from "./render";
export * from "./types";
export * from "./debug-types";
export { BACKGROUND } from "./render";
export const game: Game<WickState, WickDebugApi> = {
  async initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    await loadAssets(api);
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("time", (s) => s.run.tick / C.TICK_HZ);
    api.diagnostics.register(
      "level",
      (s) =>
        `${s.run.level} | ${s.run.xp.toFixed(1)} / ${xpNext(s.run.level)} XP`,
    );
    api.diagnostics.register(
      "health",
      (s) => `${s.run.player.hp.toFixed(1)} / ${stats(s.run).maxHp}`,
    );
    api.diagnostics.register("kills", (s) => s.run.kills);
    api.diagnostics.register(
      "position",
      (s) =>
        `${s.run.player.x.toFixed(1)}, ${s.run.player.y.toFixed(1)} ${s.run.player.facing}`,
    );
    api.diagnostics.register(
      "enemies",
      (s) => `${s.run.enemies.length} | window ${windowIndex(s.run.tick)}`,
    );
    api.diagnostics.register(
      "effects",
      (s) => `${s.run.projectiles.length} bolts | ${s.run.zones.length} zones`,
    );
    api.diagnostics.register("gems", (s) => s.run.gems.length);
    api.diagnostics.register("tools", (s) =>
      s.run.weapons
        .map((w) => `${w.id} ${w.level} (${w.cooldown.toFixed(2)})`)
        .join(", "),
    );
    api.diagnostics.register("trinkets", (s) =>
      s.run.passives.map((p) => `${p.id} ${p.level}`).join(", "),
    );
    api.diagnostics.register("pendingLevelUps", (s) => s.run.pendingLevelUps);
    for (const key of [
      "spawning",
      "events",
      "despawning",
      "enemyMotion",
      "enemyContact",
      "weaponFire",
      "effectMotion",
      "drops",
      "progression",
    ] as const)
      api.diagnostics.register(key, (s) => s[key]);
    return [initial(), debug];
  },
  update(state, api, dt) {
    const s = copy(state);
    s.simTime += dt;
    const play = (cue: C.CueName) => api.audio.play(cue);
    menus(s, api, play);
    if (s.screen === "playing") {
      s.accumulator += dt;
      const dx = api.input.value("right") - api.input.value("left"),
        dy = api.input.value("down") - api.input.value("up");
      while (
        s.screen === "playing" &&
        s.accumulator >= C.TICK_DT - C.TICK_EPSILON
      ) {
        s.accumulator -= C.TICK_DT;
        if (Math.abs(s.accumulator) < C.TICK_EPSILON) s.accumulator = 0;
        tick(s, dx, dy, play);
      }
    } else s.accumulator = 0;
    for (const cue of C.LOOPING_CUES) {
      const wanted =
        cue === C.CUES.music
          ? ["playing", "levelup", "chest", "paused"].includes(s.screen)
          : s.screen === "playing" &&
            s.run.weapons.some((w) => w.id === "halo" || w.id === "corona");
      if (wanted && !api.audio.looping(cue)) api.audio.loop(cue);
      if (!wanted && api.audio.looping(cue)) api.audio.stop(cue);
    }
    s.muted = api.audio.muted();
    return s;
  },
  render,
};
