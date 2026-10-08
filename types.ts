// tslint:disable
/* eslint-disable */
/** 3D Vector. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 3D Position as a tuple. */
export type Position3D = [number, number, number];

/** Represents an object in the 3D scene. */
export interface Entity3D {
  id: string | number;
  type?: string;
  position: Vec3 | Position3D;
  rotation?: Vec3 | Position3D;
  scale?: Vec3 | Position3D;
  velocity?: Vec3;
  active?: boolean;
  [key: string]: any;
}

/** Represents a particle in a particle system. */
export interface Particle {
  id: string | number;
  position: Vec3 | Position3D;
  velocity?: Vec3 | Position3D;
  life: number;
  maxLife: number;
  color?: string;
  size?: number;
  [key: string]: any;
}

export type TileSpecial = 'none' | 'lineH' | 'lineV' | 'lineCross' | 'bomb' | 'overload';

export type ObstacleType =
  | 'none'
  | 'ice'
  | 'corrupted'
  | 'lock'
  | 'turret'
  | 'plasma_shield'
  | 'void';

export interface GridTile {
  packet?: boolean;
  vault?: boolean;
  bossLock?: boolean;
  id: string;
  row: number;
  col: number;
  type: number; // 0..4
  special: TileSpecial;
  locked: boolean;
  obstacleType?: ObstacleType;
  lockHealth: number; // 0 = normal, 1 = 1-hit barrier, 2 = 2-hit barrier
  matched: boolean;
  x: number; // current visual world pos
  y: number;
  targetX: number; // target world pos
  targetY: number;
  scale: number;
  rotationY: number;
  dragOffsetX?: number;
  dragOffsetY?: number;
}

export interface ShockwaveRing {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
  z: number;
  scale?: number;
  life: number;
  maxLife: number;
}

export interface LaserBeam {
  id: string;
  type: 'row' | 'col' | 'lightning' | 'emp';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  life: number;
  maxLife: number;
}

export type BoosterType =
  | 'emp_bomb'
  | 'line_laser'
  | 'overload_core'
  | 'overclock_moves'
  | 'glitch_wipe';

export interface BoosterInventory {
  emp_bomb: number;
  line_laser: number;
  overload_core: number;
  overclock_moves: number;
  glitch_wipe: number;
}

export interface CyberDistrict {
  id: number;
  tier: number;
  tierName: string;
  name: string;
  subtitle: string;
  targetScore: number; // Target score required IN THIS LEVEL
  moves: number;
  description: string;
  accentColor: string;
  obstaclePlan: {
    ice: number;
    corrupted: number;
    lock: number;
    turret: number;
    plasma_shield: number;
    void: number;
  };
}
