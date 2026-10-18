# Wick — Keep the Light

A complete browser survival game about one lamplighter in a moth-choked city.
Move through the night while your tools fire automatically. Collect gems, choose
upgrades, combine mastered tools with trinkets to unlock chest evolutions, and
survive ten minutes to reach dawn.

Wick includes ten base tools, six evolutions, ten trinkets, thirteen enemies,
a browsable Almanac, original animated pixel art, fourteen sound effects, and a
32-second looping nocturne. It runs locally in your browser without a backend
or external services.

## Install and run

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. To produce the static site:

```sh
npm run build
npm run preview
```

Deploy the contents of `dist/`. All URLs are page-relative, so the site works
at a server's root or beneath a subdirectory. The committed `public/assets`
symlink exposes the committed `assets/` directory to Vite; the build copies
those files without generating media or requiring asset tools.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Walk; up/down select menu entries |
| Enter / Space | Confirm or accept a gift |
| Escape | Back; pause or resume during a run |
| P | Pause / resume |
| M | Toggle sound |
| Left / right | Change Almanac tabs |
| Mouse wheel | Scroll the Almanac |
| Mouse / touch | Select menus; release on the pressed item to accept |
| Touch direction pad | Walk |
| Backtick | Engine diagnostics |

Every weapon fires automatically. Face left or right by walking in that direction.
The big enemies leave chests; a level-eight tool evolves when its matching trinket
is held. The Almanac describes every tool, trinket, enemy, and pickup.

## Development and verification

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The simulation advances at 60 fixed ticks per second. Each frame makes a private
copy of the engine's read-only state, resolves the ordered phases, and returns
the next value. Rendering does not advance gameplay. `src/game.ts` exports the
state types, `game`, and the full `WickDebugApi`; callers reach the API through
`engine.debug`, without publishing anything on the game page.

Tests run the real engine over a native canvas and a controlled clock. They
exercise combat, progression, spawning, controls, immutable transitions, asset
dimensions, animation uniqueness, audible PCM files, and loop seams. Coverage
and test reports are written to `coverage/`.

`src/model.ts` contains shared rules and entity creation, `src/simulation.ts`
contains the ordered tick, `src/menus.ts` handles input transitions, and
`src/render.ts` draws the world and screens.

## Original media and showcase

All final media is committed under `assets/`. `scripts/produce-assets.py` is the
optional, one-time authoring recipe: it uses `draw`, `draw-sheet`, `sfx-synth`,
and `music` to render original authored pixel shapes and a sequenced score. It
is never invoked by installation, testing, or building. These development tools
are needed only to regenerate the art or sound.

`showcase/` contains screenshots, the player-facing description, and a three-second
recording of the engine's actual draw commands. With the development server
running, `python3 scripts/capture.py` reproduces the showcase using a transient
capture page and the project-local Playwright installation. Its posed late-night
scene is advanced through the same simulation as ordinary play.
