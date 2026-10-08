import type {GridTile} from '../types';

export const HAZARD_NAMES:Record<string,string>={ice:'ICE',corrupted:'VIRUS',lock:'CIPHER LOCK',turret:'EMP TURRET',plasma_shield:'PLASMA SHIELD',void:'VOID TRAP'};
export function hazardName(tile:GridTile){return tile.vault?'VAULT':tile.bossLock?'SECURITY LOCK':HAZARD_NAMES[tile.obstacleType||'ice']||'ICE';}
export function activeHazards(tiles:GridTile[]) {
  const counts=new Map<string,number>();
  for(const tile of tiles)if(tile.locked&&!tile.vault){const name=hazardName(tile);counts.set(name,(counts.get(name)||0)+1);}
  return [...counts].map(([name,count])=>`${name} (${count})`);
}
