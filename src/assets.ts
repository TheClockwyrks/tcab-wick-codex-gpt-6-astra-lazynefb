import type { InitApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { WickState } from "./types";
/** Decoded media is the only module-held data. No simulation lives here. */
export const images = new Map<string, ImageBitmap>();
export function imagePaths(): string[] {
  return [
    C.LAMPLIGHTER_IDLE_PATH,
    ...Array.from(
      { length: C.LAMPLIGHTER_WALK_SHEET.frames },
      (_, i) => `${C.LAMPLIGHTER_WALK_SHEET.dir}/${i}.png`,
    ),
    ...C.ENEMY_IDS.flatMap((id) =>
      Array.from(
        { length: C.ENEMY_FRAMES },
        (_, i) => `${C.ENEMY_SHEET_DIR}/${id}/${i}.png`,
      ),
    ),
    ...Array.from(
      { length: C.PUFF_SHEET.frames },
      (_, i) => `${C.PUFF_SHEET.dir}/${i}.png`,
    ),
    ...Object.values(C.GEM_PATHS),
    ...Object.values(C.PICKUP_PATHS),
    C.GROUND_TILE_PATH,
    ...Object.values(C.ICON_PATHS),
    ...Object.values(C.EFFECT_SPRITES).flatMap((e) =>
      e.frames === 1
        ? [e.path]
        : Array.from({ length: e.frames }, (_, i) => `${e.path}/${i}.png`),
    ),
  ];
}
export async function loadAssets(api: InitApi<WickState>) {
  await Promise.all([
    ...imagePaths().map(async (path) => {
      images.set(path, await api.assets.loadImage(path));
    }),
    ...Object.values(C.CUES).map((cue) =>
      api.audio.load(cue, C.CUE_PATHS[cue]),
    ),
  ]);
}
