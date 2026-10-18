import type { DeepReadonly } from "ts-essentials";
import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { WickState, Screen } from "./types";
import type { WickRect } from "./debug-types";
import { type Draft, idleRun, accept } from "./model";
import type { CueSink } from "./simulation";
export const entries = (tab: number): readonly string[] =>
  [
    [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS],
    C.PASSIVE_IDS,
    C.ENEMY_IDS,
    [...C.GEM_TIERS, ...C.PICKUP_KINDS],
  ][tab]!;
export function menuRects(s: DeepReadonly<WickState>): WickRect[] {
  let count = 0,
    x = 448,
    y = 390,
    width = 384,
    height = 54,
    gap = 12;
  switch (s.screen) {
    case "title":
      count = C.TITLE_ITEMS.length;
      x = 146;
      y = 374;
      width = 390;
      break;
    case "paused":
    case "fallen":
    case "dawn":
      count = 2;
      y = 420;
      break;
    case "levelup":
      count = s.run.offers.length;
      x = 340;
      y = 267;
      width = 600;
      height = 74;
      gap = 14;
      break;
    case "almanac":
      count = Math.min(
        C.ALMANAC_ROWS,
        entries(s.almanacTab).length - s.almanacScroll,
      );
      x = 72;
      y = 194;
      width = 300;
      height = 39;
      gap = 5;
      break;
    case "howto":
    case "chest":
      count = 1;
      y = 592;
      break;
  }
  return Array.from({ length: count }, (_, i) => ({
    x,
    y: y + i * (height + gap),
    width,
    height,
  }));
}
export function tabRects(s: DeepReadonly<WickState>): WickRect[] {
  return s.screen === "almanac"
    ? C.ALMANAC_TABS.map((_, i) => ({
        x: 72 + i * 286,
        y: 115,
        width: 268,
        height: 48,
      }))
    : [];
}
function screen(s: Draft, name: Screen) {
  s.screen = name;
  s.menuIndex = 0;
  s.almanacTab = 0;
  s.almanacScroll = 0;
  s.visuals.armed = null;
  if (name !== "playing") s.accumulator = 0;
}
function title(s: Draft, index = 0) {
  screen(s, "title");
  s.menuIndex = index;
  s.run = idleRun();
  s.visuals = {
    moved: false,
    moveTicks: 0,
    puffs: [],
    shapes: {},
    armed: null,
  };
}
function start(s: Draft) {
  s.run = idleRun();
  s.run.weapons = [{ id: "taper", level: 1, cooldown: 0 }];
  s.visuals = {
    moved: false,
    moveTicks: 0,
    puffs: [],
    shapes: {},
    armed: null,
  };
  screen(s, "playing");
}
function confirm(s: Draft, play: CueSink) {
  switch (s.screen) {
    case "title":
      play(C.CUES.menuConfirm);
      if (s.menuIndex === 0) start(s);
      else screen(s, s.menuIndex === 1 ? "almanac" : "howto");
      break;
    case "paused":
      play(C.CUES.menuConfirm);
      if (s.menuIndex === 0) screen(s, "playing");
      else title(s);
      break;
    case "fallen":
    case "dawn":
      play(C.CUES.menuConfirm);
      if (s.menuIndex === 0) start(s);
      else title(s);
      break;
    case "levelup":
      if (s.run.offers.length) {
        accept(s, s.menuIndex);
        play(C.CUES.choose);
        if (s.screen === "levelup") play(C.CUES.levelUp);
      }
      break;
    case "chest":
      s.run.chestResult = null;
      screen(s, "playing");
      break;
  }
}
function followHighlight(s: Draft) {
  const count = entries(s.almanacTab).length;
  s.almanacScroll = Math.max(
    0,
    Math.min(
      count - C.ALMANAC_ROWS,
      Math.max(
        Math.min(s.almanacScroll, s.menuIndex),
        s.menuIndex - C.ALMANAC_ROWS + 1,
      ),
    ),
  );
}
const inside = (r: WickRect, x: number, y: number) =>
  x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
/** Edges act only on the screen on which the frame began. */
export function menus(s: Draft, api: UpdateApi, play: CueSink) {
  const original = s.screen,
    edge = Object.fromEntries(C.ACTIONS.map((a) => [a, api.input.pressed(a)]));
  if (edge.mute) api.audio.setMuted(!api.audio.muted());
  const count =
    original === "almanac"
      ? entries(s.almanacTab).length
      : ["title", "paused", "fallen", "dawn", "levelup"].includes(original)
        ? menuRects(s).length
        : 0;
  if (count && (edge.up || edge.down)) {
    s.menuIndex = (s.menuIndex + (edge.down ? 1 : -1) + count) % count;
    if (original === "almanac") followHighlight(s);
    play(C.CUES.menuMove);
  }
  if (original === "almanac") {
    if (edge.left || edge.right) {
      s.almanacTab =
        (s.almanacTab + (edge.right ? 1 : -1) + C.ALMANAC_TABS.length) %
        C.ALMANAC_TABS.length;
      s.almanacScroll = 0;
      s.menuIndex = 0;
      play(C.CUES.menuMove);
    }
    s.almanacScroll = Math.max(
      0,
      Math.min(
        Math.max(0, entries(s.almanacTab).length - C.ALMANAC_ROWS),
        s.almanacScroll + Math.trunc(api.input.wheel().y / C.WHEEL_ROW),
      ),
    );
    if (edge.back) title(s, 1);
  } else if (original === "howto" && edge.back) title(s, 2);
  else if (original === "playing" && (edge.pause || edge.back))
    screen(s, "paused");
  else if (original === "paused" && (edge.pause || edge.back))
    screen(s, "playing");
  else if ((original === "fallen" || original === "dawn") && edge.back)
    title(s);
  else if (edge.confirm) confirm(s, play);
  // Samples preserve down/up order even when a tap completes inside one frame.
  const samples = api.input.pointerSamples();
  api.input.pointerPressed();
  api.input.pointerReleased();
  if (s.screen !== original) return;
  for (const sample of samples) {
    if (!sample.primary) continue;
    const rects = menuRects(s),
      tabs = tabRects(s),
      i = rects.findIndex((r) => inside(r, sample.x, sample.y)),
      tab = tabs.findIndex((r) => inside(r, sample.x, sample.y));
    const select = () => {
      if (i < 0) return;
      const index = i + (s.screen === "almanac" ? s.almanacScroll : 0);
      if (index !== s.menuIndex) {
        s.menuIndex = index;
        play(C.CUES.menuMove);
      }
    };
    if (sample.type === "move" && !sample.buttons.includes("primary")) select();
    if (sample.type === "down" && sample.button === "primary") {
      select();
      s.visuals.armed =
        i >= 0 || tab >= 0
          ? { screen: s.screen, index: tab >= 0 ? tab : i, tab: tab >= 0 }
          : null;
    }
    if (sample.type === "up" && sample.button === "primary") {
      const armed = s.visuals.armed;
      s.visuals.armed = null;
      if (!armed || armed.screen !== s.screen) continue;
      if (armed.tab && tab === armed.index) {
        if (tab !== s.almanacTab) {
          s.almanacTab = tab;
          s.menuIndex = 0;
          s.almanacScroll = 0;
          play(C.CUES.menuMove);
        }
      } else if (!armed.tab && i === armed.index) {
        if (s.screen === "howto") title(s, 2);
        else confirm(s, play);
      }
    }
    if (s.screen !== original) break;
  }
}
