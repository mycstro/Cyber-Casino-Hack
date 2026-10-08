import type {CyberDistrict} from '../types';

export const DISTRICT_NAMES = ['Neon District', 'Quantum Vaults', 'Black Lotus', 'AI Central', 'Singularity', 'Matrix Horizons'];
const COLORS = ['#00f7ff', '#ff0077', '#ffe600', '#a855f7', '#00ff88', '#ff4400'];
export type MissionKind = 'score' | 'tokens' | 'hazards' | 'packets' | 'vault';
export interface Mission {kind: MissionKind; target: number; color: number; label: string; boss: boolean}
export function getDistrictForLevel(input: number): CyberDistrict {
  const level = Math.max(1, Math.floor(input));
  const district = Math.min(5, Math.floor((level - 1) / 10));
  const difficulty = Math.min(5, Math.floor((level - 1) / 10));
  const sector = (level - 1) % 10 + 1;
  const boss = sector === 10;
  return {id: level, tier: district + 1, tierName: DISTRICT_NAMES[district],
    name: `${DISTRICT_NAMES[district]} · Node ${sector}`, subtitle: boss ? 'SECURITY CORE' : 'SUBNET HEIST',
    targetScore: 3500 + difficulty * 350 + (sector - 1) * 100 + (boss ? 700 : 0),
    moves: 22 + difficulty + (boss ? 5 : 0) + (level % 5 === 4 ? 4 : 0), description: 'Choose your route. Breach the mission objective and earn mastery stars.',
    accentColor: COLORS[district], obstaclePlan: {ice: 1 + Math.min(3, Math.floor(sector / 3)),
      corrupted: difficulty > 0 ? 2 : 0, lock: difficulty > 1 ? 2 : 0,
      turret: boss ? 1 : 0, plasma_shield: difficulty > 2 ? 2 : 0, void: difficulty > 3 ? 1 : 0}};
}
export function getMission(level: number): Mission {
  const d = getDistrictForLevel(level);
  const kind: MissionKind = level === 1 ? 'score' : (['score','tokens','hazards','packets','vault'] as const)[(level - 1) % 5];
  const color = (level - 1) % 5;
  const target = kind === 'score' ? d.targetScore : kind === 'tokens' ? 24 + d.tier * 2 :
    kind === 'hazards' ? Object.values(d.obstaclePlan).reduce((a,b) => a+b,0) : kind === 'packets' ? 2 : 8 + d.tier;
  const names = ['diamond','chip','coin','circuit','core'];
  return {kind,target,color,boss:level % 10 === 0,label: kind === 'score' ? `Score ${target.toLocaleString()} points` :
    kind === 'tokens' ? `Collect ${target} ${names[color]} tokens` : kind === 'hazards' ? `Clear ${target} hazards` :
    kind === 'packets' ? 'Deliver 2 data packets to the bottom' : `Break the vault: ${target} adjacent hits`};
}
export function dailyChallenge(date = new Date()) {
  const day = date.toISOString().slice(0,10);
  let seed = 2166136261;
  for (const ch of `cyber-v1-${day}`) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  return {day,seed,level: 2 + seed % 8,boosters:{emp_bomb:1,line_laser:1,overload_core:0,overclock_moves:0,glitch_wipe:0}};
}
