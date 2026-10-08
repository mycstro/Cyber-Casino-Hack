import {expect,it} from 'vitest';
import {validateDailyReplay} from '../game/replay';
import {dailyChallenge,getDistrictForLevel} from '../game/campaign';
import {HeistEngine,type Action} from '../game/engine';

it('recomputes daily receipts and rejects score tampering',()=>{
  const day='2026-10-08',d=dailyChallenge(new Date(day+'T00:00:00Z')),e=new HeistEngine(d.level,d.seed),actions:Action[]=[];
  let moves=getDistrictForLevel(d.level).moves;
  for(let i=0;i<5&&!e.complete();i++){const a=e.hint()!;actions.push(a);const result=e.action(a);moves=moves-1+(result.bonusMoves||0);}
  const score=e.state.score+(e.complete()?moves*200:0);
  expect(validateDailyReplay(day,actions,score).valid).toBe(true);
  expect(validateDailyReplay(day,actions,score+1).valid).toBe(false);
});
it('rejects excess boosters, malformed actions and invalid dates',()=>{
  expect(validateDailyReplay('2026-10-08',[{kind:'booster',booster:'overclock_moves',at:[0,0]}],0).valid).toBe(false);
  expect(validateDailyReplay('2026-10-08',[{kind:'swap',from:[-1,0],to:[0,0]}],0).valid).toBe(false);
  expect(validateDailyReplay('2026-02-31',[],0).valid).toBe(false);
  expect(validateDailyReplay('2026-10-08',null,0).valid).toBe(false);
});
