import {expect,it} from 'vitest';
import {activeHazards,hazardName} from '../game/hazards';
import {board} from './fixtures';

it('reports live remaining hazards rather than the initial mission plan',()=>{
  const tiles=board();Object.assign(tiles[0],{locked:true,lockHealth:1,obstacleType:'lock'});
  Object.assign(tiles[1],{locked:true,lockHealth:2,obstacleType:'ice'});
  Object.assign(tiles[2],{locked:true,lockHealth:2,obstacleType:'plasma_shield',vault:true});
  expect(activeHazards(tiles)).toEqual(['CIPHER LOCK (1)','ICE (1)']);
  tiles[0].locked=false;expect(activeHazards(tiles)).toEqual(['ICE (1)']);
  tiles[1].locked=false;expect(activeHazards(tiles)).toEqual([]);
});
it('distinguishes cipher locks, boss locks and vault weak points',()=>{
  const t=board()[0];t.obstacleType='lock';expect(hazardName(t)).toBe('CIPHER LOCK');
  t.bossLock=true;expect(hazardName(t)).toBe('SECURITY LOCK');
  t.vault=true;expect(hazardName(t)).toBe('VAULT');
});
