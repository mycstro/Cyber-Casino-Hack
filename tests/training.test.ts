import {describe,it,expect} from 'vitest';
import {HeistEngine,validSnapshot} from '../game/engine';
import {findBoardMatches} from '../game/board';
import {LESSONS,TRAINING_LESSON_COUNT,trainingAction,trainingCells} from '../game/training';

describe('complete hacker academy curriculum',()=>{
  it('covers twenty-two uniquely named, explicit practical or overview lessons',()=>{
    expect(TRAINING_LESSON_COUNT).toBe(22);expect(new Set(LESSONS.map(x=>x.title)).size).toBe(22);
    for(const l of LESSONS){expect(l.goal.length).toBeGreaterThan(20);expect(l.result.length).toBeGreaterThan(40);expect(!!l.action).toBe(l.kind==='practice');}
  });
  it.each(LESSONS.map((_,i)=>i+1))('lesson %i starts settled, rejects mistakes without spending anything and permits a validated snapshot',n=>{
    const e=new HeistEngine(1,100+n,8,8,undefined,n);expect(findBoardMatches(e.state.tiles,8,8).matchedIds).toEqual([]);expect(e.complete()).toBe(false);
    const before=e.snapshot();for(let attempt=0;attempt<10;attempt++)expect(e.action({kind:'swap',from:[7,7],to:[7,6]})).toEqual({accepted:false,spendsMove:false,frames:[]});expect(e.snapshot()).toEqual(before);
    expect(validSnapshot(before,before.tiles)).toBe(true);const a=LESSONS[n-1].action;expect(trainingCells(n).length).toBe(a?.kind==='swap'?2:a?.at?1:0);
  });
  it.each(LESSONS.flatMap((l,i)=>l.action?[i+1]:[]))('practice lesson %i is attainable using its demonstrated action',n=>{
    for(const seed of [100+n,456,789]){
      const e=new HeistEngine(1,seed,8,8,undefined,n),a=LESSONS[n-1].action!;expect(trainingAction(n,a)).toBe(true);
      const result=e.action(a);expect(result.accepted).toBe(true);expect(e.complete()).toBe(true);
      if(n===8||n===12)expect(result.bonusMoves).toBe(5);
      if(n===11)expect(e.state.tiles.filter(t=>t.locked||t.bossLock||t.vault)).toEqual([]);
      if(n===10){const fired=result.frames.flatMap(f=>f.specials||[]).map(t=>t.special);expect(fired).toContain('lineCross');expect(fired).toContain('bomb');}
      if(n===5||n===6)expect(result.frames.flatMap(f=>f.created||[])).toEqual([]);
    }
  });
  it('keeps conceptual lessons separate from fake gameplay completion',()=>{
    for(const [i,l] of LESSONS.entries())if(l.kind==='overview'){expect(l.action).toBeUndefined();expect(new HeistEngine(1,1,8,8,undefined,i+1).complete()).toBe(false);}
  });
});
