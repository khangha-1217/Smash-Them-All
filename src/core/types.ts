export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Pose {
  position: Vec3;
  // Euler rotation in radians. For the player, x is pitch and y is yaw.
  rotation: Vec3;
}

export type MapId = 'kitchen' | 'livingroom' | 'bedroom';
export type GameMode = 'normal' | 'hell';
export type WeaponId = 'slipper' | 'flyswatter' | 'cardboard';
export type Rank = 'S' | 'A' | 'B' | 'C';
export type Language = 'vi' | 'en';
export type GameState = 'MENU' | 'LOADING' | 'READY' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export interface RoundConfig {
  mapId: MapId;
  mode: GameMode;
  weaponId: WeaponId;
}

export interface Round extends RoundConfig {
  // Seconds remaining, based on real elapsed time in the 90-second round.
  timeRemaining: number;
  // The score and counters are integers.
  score: number;
  kills: number;
  flyingKills: number;
  swings: number;
  hits: number;
  nearMisses: number;
  maxCombo: number;
  rank: Rank | null;
}

export interface NextRankHint {
  rank: Exclude<Rank, 'C'>;
  pointsNeeded: number;
}

export interface RoundResult extends Round {
  rank: Rank;
  nextRank: NextRankHint | null;
  // Hits divided by swings, or 0 when no swings were made.
  accuracy: number;
  // Swings minus hits.
  misses: number;
}

export const COMBO_WINDOW_MS = 2000;

export interface Combo {
  // Integer multiplier of at least 1.
  multiplier: number;
  // Milliseconds on the active round clock.
  lastHitTime: number;
  windowMs: typeof COMBO_WINDOW_MS;
}

export type CockroachState = 'idle' | 'crawling' | 'preflight' | 'flying';

export interface BezierCurve {
  start: Vec3;
  control: Vec3;
  end: Vec3;
}

export interface Cockroach {
  id: number;
  alive: boolean;
  state: CockroachState;
  position: Vec3;
  surfaceType: string;
  surfaceNormal: Vec3;
  targetWaypoint: Vec3 | null;
  // Meters per second, 0.5–1.2 while crawling.
  speed: number;
  // 0.06 m while crawling and 0.078 m while flying (1.3 times larger).
  hitboxRadius: number;
  flightCurve: BezierCurve | null;
  // Progress along the curve, from 0 to 1.
  flightProgress: number;
}

export const SWING_DURATION_MS = 300;

export interface Weapon {
  id: WeaponId;
  // While swinging, reject another swing until the duration has elapsed.
  isSwinging: boolean;
  swingStartTime: number | null;
  swingDurationMs: typeof SWING_DURATION_MS;
}

export interface Achievement {
  // Unique across all achievements. Unlocking an already unlocked ID is a no-op.
  id: string;
  nameVi: string;
  nameEn: string;
  flavorVi: string;
  flavorEn: string;
  condition: (round: RoundResult) => boolean;
  // An unlock persists until the stored profile is cleared.
  unlocked: boolean;
}

export interface PlayerProfile {
  achievements: Record<string, boolean>;
  // Each key combines its map and mode as `${mapId}_${mode}`.
  personalBests: Record<string, number>;
  totalRounds: number;
  weaponsUsed: string[];
  mapsPlayed: string[];
  language: Language;
  soundEnabled: boolean;
}

export interface NearMiss {
  cockroachId: number;
  position: Vec3;
  // Clearance from the aim ray in meters.
  distance: number;
}

export interface HitResult {
  type: 'hit' | 'near_miss' | 'miss';
  // Null on a miss or near-miss.
  target: Cockroach | null;
  // Nearest qualifying cockroach on a near-miss, otherwise null.
  nearMiss: NearMiss | null;
  // Distance used to select the nearest hit target.
  distance: number;
  // Awarded points, or 0 when the swing does not hit.
  points: number;
}

export interface SurfacePoint {
  position: Vec3;
  surfaceType: string;
  surfaceNormal: Vec3;
}

export interface Aabb {
  min: Vec3;
  max: Vec3;
}

export interface MapData {
  id: string;
  spawnPoints: SurfacePoint[];
  waypoints: SurfacePoint[];
  playerStart: Pose;
  colliders: Aabb[];
  roomBounds: Aabb;
}
