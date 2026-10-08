import {describe,it,expect} from 'vitest';
import {HeistEngine} from '../game/engine';
import {findBoardMatches,crossLines} from '../game/board';
import {board,paint,comboBoard} from './fixtures';
describe('match-earned Cross Lasers and move injections',()=>{
  it('creates one Cross Laser from two simultaneous matched lines after a valid swap',()=>{
    const e=new HeistEngine(3,123);e.state.tiles=comboBoard();expect(findBoardMatches(e.state.tiles,8,8).lineCount).toBe(0);
    const result=e.action({kind:'swap',from:[3,3],to:[3,4]});expect(result.frames[1].created?.map(t=>t.special)).toEqual(['lineCross']);expect(e.state.progress.boosters).toBe(0);expect(e.state.tiles.some(t=>t.special==='lineCross')).toBe(true);
  });
  it('adds exactly five moves once when three or more lines clear through one swap',()=>{
    const e=new HeistEngine(3,123);e.state.tiles=comboBoard(3);expect(findBoardMatches(e.state.tiles,8,8).matchedIds).toEqual([]);
    const result=e.action({kind:'swap',from:[3,3],to:[3,4]});expect(result.bonusMoves).toBe(5);expect(result.frames.filter(f=>f.message?.includes('+5 MOVES'))).toHaveLength(1);expect(e.state.progress.boosters).toBe(0);expect(e.state.turn).toBe(1);
  });
  it.each([[0,0],[0,7],[7,0],[7,7],[3,3]])('a Cross Laser at %j always clears two distinct rows and columns',(...position)=>{
    const [row,col]=position as number[];const e=new HeistEngine(3,12);e.state.tiles=board();const tile=e.at([row,col])!;tile.special='lineCross';
    const lines=crossLines(row,col,8,8);expect(new Set(lines.rows).size).toBe(2);expect(new Set(lines.cols).size).toBe(2);expect(e.area(tile)).toHaveLength(28);
    const result=e.action({kind:'special',at:[row,col]});expect(result.frames[0].cleared).toHaveLength(28);expect(result.bonusMoves).toBe(0);
  });
  it('rewarded Cross Lasers use the same double-cross area without a move or match bonus',()=>{
    const e=new HeistEngine(3,12);e.state.tiles=board();const r=e.action({kind:'booster',booster:'line_laser',at:[7,7]});expect(r.frames[0].cleared).toHaveLength(28);expect(r.spendsMove).toBe(false);expect(r.bonusMoves).toBe(0);expect(e.state.progress.boosters).toBe(1);
  });
  it('single long lines never create Overload, EMP or Purge',()=>{
    for(let length=3;length<=8;length++){const tiles=paint(board(),Array.from({length},(_,c)=>[0,c]),4);const result=findBoardMatches(tiles,8,8);expect(result.specialCreations).toEqual([]);expect(result.lineCount).toBe(1);}
  });
});
