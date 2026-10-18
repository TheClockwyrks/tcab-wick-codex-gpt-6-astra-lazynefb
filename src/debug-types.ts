import type { DeepReadonly } from "ts-essentials";
import type {
  WickState,
  Screen,
  Facing,
  WeaponId,
  PassiveId,
  EnemyId,
  GemTier,
  PickupKind,
  OfferId,
  RunState,
} from "./types";

export interface WickRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type NextDrop = "bread" | "draft" | "none";

export interface WickDebugApi {
  readonly version: number;
  reset(state: DeepReadonly<WickState>): WickState;
  snapshot(state: DeepReadonly<WickState>): WickSnapshot;
  reconcile(state: DeepReadonly<WickState>): WickState;
  menuRects(state: DeepReadonly<WickState>): readonly WickRect[];
  tabRects(state: DeepReadonly<WickState>): readonly WickRect[];
  setScreen(state: DeepReadonly<WickState>, name: Screen): WickState;
  choose(state: DeepReadonly<WickState>, index: number): WickState;
  setSpawning(state: DeepReadonly<WickState>, on: boolean): WickState;
  setEvents(state: DeepReadonly<WickState>, on: boolean): WickState;
  setDespawning(state: DeepReadonly<WickState>, on: boolean): WickState;
  setEnemyMotion(state: DeepReadonly<WickState>, on: boolean): WickState;
  setEnemyContact(state: DeepReadonly<WickState>, on: boolean): WickState;
  setWeaponFire(state: DeepReadonly<WickState>, on: boolean): WickState;
  setEffectMotion(state: DeepReadonly<WickState>, on: boolean): WickState;
  setDrops(state: DeepReadonly<WickState>, on: boolean): WickState;
  setProgression(state: DeepReadonly<WickState>, on: boolean): WickState;
  setTick(state: DeepReadonly<WickState>, tick: number): WickState;
  setSpawnTimer(state: DeepReadonly<WickState>, seconds: number): WickState;
  setNextSpawnAngle(state: DeepReadonly<WickState>, degrees: number): WickState;
  setNextSwarmAngle(state: DeepReadonly<WickState>, degrees: number): WickState;
  setNextSpawnType(state: DeepReadonly<WickState>, id: EnemyId): WickState;
  setNextPuddleOffset(
    state: DeepReadonly<WickState>,
    dx: number,
    dy: number,
  ): WickState;
  setNextStrikeTarget(state: DeepReadonly<WickState>, id: number): WickState;
  setNextChestItem(
    state: DeepReadonly<WickState>,
    id: WeaponId | PassiveId,
  ): WickState;
  setNextDrop(state: DeepReadonly<WickState>, kind: NextDrop): WickState;
  rollDrop(state: DeepReadonly<WickState>): NextDrop;
  setPlayerPosition(
    state: DeepReadonly<WickState>,
    x: number,
    y: number,
  ): WickState;
  setFacing(state: DeepReadonly<WickState>, facing: Facing): WickState;
  setHp(state: DeepReadonly<WickState>, hp: number): WickState;
  setLevel(state: DeepReadonly<WickState>, level: number): WickState;
  setXp(state: DeepReadonly<WickState>, xp: number): WickState;
  setKills(state: DeepReadonly<WickState>, kills: number): WickState;
  setPendingLevelUps(state: DeepReadonly<WickState>, count: number): WickState;
  setNextOffers(
    state: DeepReadonly<WickState>,
    ids: readonly OfferId[],
  ): WickState;
  setWeapon(
    state: DeepReadonly<WickState>,
    slot: number,
    id: WeaponId,
    level: number,
  ): WickState;
  setWeaponCooldown(
    state: DeepReadonly<WickState>,
    slot: number,
    seconds: number,
  ): WickState;
  removeWeapon(state: DeepReadonly<WickState>, slot: number): WickState;
  setPassive(
    state: DeepReadonly<WickState>,
    slot: number,
    id: PassiveId,
    level: number,
  ): WickState;
  removePassive(state: DeepReadonly<WickState>, slot: number): WickState;
  spawnEnemy(
    state: DeepReadonly<WickState>,
    type: EnemyId,
    x: number,
    y: number,
  ): WickState;
  setEnemyPosition(
    state: DeepReadonly<WickState>,
    id: number,
    x: number,
    y: number,
  ): WickState;
  setEnemyHp(state: DeepReadonly<WickState>, id: number, hp: number): WickState;
  setEnemyHeading(
    state: DeepReadonly<WickState>,
    id: number,
    hx: number,
    hy: number,
  ): WickState;
  setEnemyAge(
    state: DeepReadonly<WickState>,
    id: number,
    seconds: number,
  ): WickState;
  setEnemyContactCooldown(
    state: DeepReadonly<WickState>,
    id: number,
    seconds: number,
  ): WickState;
  removeEnemy(state: DeepReadonly<WickState>, id: number): WickState;
  clearEnemies(state: DeepReadonly<WickState>): WickState;
  spawnProjectile(
    state: DeepReadonly<WickState>,
    weapon: "ember" | "pin" | "shard" | "sconce" | "beacon" | "hail",
    x: number,
    y: number,
    vx: number,
    vy: number,
    pierce: number,
  ): WickState;
  clearProjectiles(state: DeepReadonly<WickState>): WickState;
  spawnPuddle(
    state: DeepReadonly<WickState>,
    weapon: "oil-splash" | "blaze",
    x: number,
    y: number,
  ): WickState;
  clearZones(state: DeepReadonly<WickState>): WickState;
  spawnGem(
    state: DeepReadonly<WickState>,
    tier: GemTier,
    x: number,
    y: number,
  ): WickState;
  setGemAttracted(
    state: DeepReadonly<WickState>,
    id: number,
    attracted: boolean,
  ): WickState;
  clearGems(state: DeepReadonly<WickState>): WickState;
  spawnPickup(
    state: DeepReadonly<WickState>,
    kind: PickupKind,
    x: number,
    y: number,
  ): WickState;
  clearPickups(state: DeepReadonly<WickState>): WickState;
}

export interface WickSnapshot extends Omit<WickState, "run" | "visuals"> {
  readonly version: number;
  readonly run: RunState & {
    readonly time: number;
    readonly xpToNext: number;
    readonly maxHp: number;
    readonly armor: number;
    readonly moveSpeed: number;
    readonly pickupRadius: number;
    readonly spawnWindow: number;
    readonly aliveCommons: number;
    readonly pool: readonly OfferId[];
  };
}
