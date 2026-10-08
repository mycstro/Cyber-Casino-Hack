import type {BoosterInventory, CyberDistrict, GridTile} from '../types';
import {validSnapshot, type Snapshot} from './engine';
import {getMission} from './campaign';

export interface SavedGameData {
  level: number;
  score: number;
  levelScore: number;
  moves: number;
  tiles: GridTile[] | null;
  timestamp: number;
  snapshot?: Snapshot;
}

const nonNegative = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const integer = (x: unknown): x is number => nonNegative(x) && Number.isSafeInteger(x);

export function parseSavedGame(raw: string | null, rows: number, cols: number,
  district: (level: number) => CyberDistrict): SavedGameData | null {
  try {
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !integer(data.level) || data.level < 1 || !nonNegative(data.score)
      || !nonNegative(data.levelScore) || data.levelScore > data.score || !integer(data.moves) || data.moves < 1) return null;
    // Legacy winning snapshots must never replay a completed level or its rewards.
    if (!data.snapshot && data.levelScore >= district(data.level).targetScore) {
      const level = data.level + 1;
      return {level, score: data.score, levelScore: 0, moves: district(level).moves, tiles: null, timestamp: Date.now()};
    }
    if (data.tiles === null && data.levelScore === 0) return data;
    if (!Array.isArray(data.tiles) || data.tiles.length !== rows * cols) return null;
    const positions = new Set<string>();
    const ids = new Set<string>();
    for (const t of data.tiles) {
      if (!t || typeof t.id !== 'string' || !t.id || ids.has(t.id) || !integer(t.row) || t.row >= rows
        || !integer(t.col) || t.col >= cols || !integer(t.type) || t.type > 4
        || !['none', 'lineH', 'lineV', 'lineCross', 'bomb', 'overload'].includes(t.special)
        || typeof t.locked !== 'boolean' || !integer(t.lockHealth) || t.lockHealth > 2 || t.matched !== false
        || ['packet','vault','bossLock'].some(k=>t[k]!==undefined&&typeof t[k]!=='boolean')
        || (t.obstacleType!==undefined&&!['none','ice','corrupted','lock','turret','plasma_shield','void'].includes(t.obstacleType))
        || ![t.x, t.y, t.targetX, t.targetY, t.scale, t.rotationY].every(x => typeof x === 'number' && Number.isFinite(x))) return null;
      const position = `${t.row},${t.col}`;
      if (positions.has(position)) return null;
      positions.add(position);
      ids.add(t.id);
    }
    if(data.snapshot) {
      if(!validSnapshot(data.snapshot,data.tiles) || data.snapshot.score !== data.levelScore || data.snapshot.tutorial !== 0) return null;
      const mission=getMission(data.level);
      data.snapshot={...data.snapshot,tiles:data.tiles,mission:data.snapshot.legacyScore===true?{...mission,kind:'score',target:district(data.level).targetScore,label:`Score ${district(data.level).targetScore} points`}:mission};
    }
    return {...data, timestamp: nonNegative(data.timestamp) ? data.timestamp : Date.now()};
  } catch {return null;}
}

export function parseBoosters(raw: string | null, defaults: BoosterInventory): BoosterInventory {
  try {
    const data = JSON.parse(raw || '{}');
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key,
      integer(data?.[key]) ? data[key] : fallback])) as unknown as BoosterInventory;
  } catch {return {...defaults};}
}
