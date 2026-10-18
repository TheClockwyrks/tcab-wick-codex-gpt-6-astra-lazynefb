/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import * as C from "./constants";
import { imagePaths } from "./assets";
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
async function picture(path: string, w: number, h: number) {
  const image = await loadImage(await readFile(`assets/${path}`));
  expect([image.width, image.height]).toEqual([w, h]);
  const canvas = createCanvas(w, h),
    ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  expect(rgba.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
  if (path !== C.GROUND_TILE_PATH)
    expect(rgba.some((v, i) => i % 4 === 3 && v === 0)).toBe(true);
  return hash(Buffer.from(rgba));
}
describe("shipped media contracts", () => {
  it("ships all pictures at their declared dimensions with visible, transparent art", async () => {
    await picture(
      C.LAMPLIGHTER_IDLE_PATH,
      C.LAMPLIGHTER_SPRITE_WIDTH,
      C.LAMPLIGHTER_SPRITE_HEIGHT,
    );
    await picture(C.GROUND_TILE_PATH, C.GROUND_TILE_SIZE, C.GROUND_TILE_SIZE);
    for (const tier of C.GEM_TIERS)
      await picture(
        C.GEM_PATHS[tier],
        C.GEM_SPRITE_SIZES[tier],
        C.GEM_SPRITE_SIZES[tier],
      );
    for (const kind of C.PICKUP_KINDS)
      await picture(
        C.PICKUP_PATHS[kind],
        C.PICKUP_SPRITE_SIZE,
        C.PICKUP_SPRITE_SIZE,
      );
    expect(new Set(imagePaths()).size).toBe(imagePaths().length);
  });
  it("gives every frame of every animation a distinct picture", async () => {
    const sheets = [
      {
        ...C.LAMPLIGHTER_WALK_SHEET,
        width: C.LAMPLIGHTER_SPRITE_WIDTH,
        height: C.LAMPLIGHTER_SPRITE_HEIGHT,
      },
      {
        ...C.PUFF_SHEET,
        width: C.PUFF_SPRITE_SIZE,
        height: C.PUFF_SPRITE_SIZE,
      },
      ...C.ENEMY_IDS.map((id) => ({
        dir: `${C.ENEMY_SHEET_DIR}/${id}`,
        frames: C.ENEMY_FRAMES,
        width: C.ENEMIES[id].radius * 2,
        height: C.ENEMIES[id].radius * 2,
      })),
    ];
    for (const sheet of sheets) {
      const hashes = [];
      for (let i = 0; i < sheet.frames; i++)
        hashes.push(
          await picture(`${sheet.dir}/${i}.png`, sheet.width, sheet.height),
        );
      expect(new Set(hashes).size, sheet.dir).toBe(sheet.frames);
    }
  });
  it("gives each icon and each weapon effect its own image", async () => {
    const icons = [];
    for (const path of Object.values(C.ICON_PATHS))
      icons.push(await picture(path, C.ICON_SIZE, C.ICON_SIZE));
    expect(new Set(icons).size).toBe(icons.length);
    const effects = [];
    for (const effect of Object.values(C.EFFECT_SPRITES)) {
      const frames = [];
      for (let i = 0; i < effect.frames; i++) {
        const path =
          effect.frames === 1 ? effect.path : `${effect.path}/${i}.png`;
        frames.push(await picture(path, effect.width, effect.height));
      }
      expect(new Set(frames).size).toBe(effect.frames);
      effects.push(frames[0]);
    }
    expect(new Set(effects).size).toBe(effects.length);
  });
  it("ships audible, distinct PCM cues, long seamless loops, and the portable score", async () => {
    const hashes = [];
    for (const [cue, path] of Object.entries(C.CUE_PATHS)) {
      const wav = await readFile(`assets/${path}`);
      hashes.push(hash(wav));
      expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
      expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
      let channels = 0,
        sampleRate = 0,
        bits = 0,
        data: Buffer = Buffer.alloc(0);
      for (let pos = 12; pos + 8 < wav.length;) {
        const name = wav.toString("ascii", pos, pos + 4),
          size = wav.readUInt32LE(pos + 4);
        if (name === "fmt ") {
          channels = wav.readUInt16LE(pos + 10);
          sampleRate = wav.readUInt32LE(pos + 12);
          bits = wav.readUInt16LE(pos + 22);
        }
        if (name === "data") data = wav.subarray(pos + 8, pos + 8 + size);
        pos += 8 + size + (size % 2);
      }
      expect(bits).toBe(16);
      let peak = 0;
      for (let i = 0; i < data.length; i += 2)
        peak = Math.max(peak, Math.abs(data.readInt16LE(i)) / 32768);
      expect(peak).toBeGreaterThan(0.01);
      if (cue === "music" || cue === "hum") {
        expect(data.length / 2 / channels / sampleRate).toBeGreaterThanOrEqual(
          cue === "music" ? C.MUSIC_MIN_SECONDS : C.HUM_MIN_SECONDS,
        );
        for (let i = 0; i < channels; i++)
          expect(
            Math.abs(
              data.readInt16LE(i * 2) -
                data.readInt16LE(data.length - channels * 2 + i * 2),
            ) / 32768,
          ).toBeLessThanOrEqual(C.LOOP_SEAM_TOLERANCE);
      }
    }
    expect(new Set(hashes).size).toBe(Object.keys(C.CUE_PATHS).length);
    expect(
      (await readFile(`assets/${C.MUSIC_SCORE_PATH}`)).toString("ascii", 0, 4),
    ).toBe("MThd");
  });
});
