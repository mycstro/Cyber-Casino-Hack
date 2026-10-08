import {describe,it,expect} from 'vitest';
import {HeistEngine,validSnapshot} from '../game/engine';
import {dailyChallenge,getDistrictForLevel,getMission} from '../game/campaign';
import {freshCareer,readCareer,recordCompletion,totalStars} from '../game/progression';
import {readPreferences} from '../game/preferences';
import {board} from './fixtures';

describe('deterministic heist engine',()=>{
  it('uses the same board and refill stream regardless of visual randomness',()=>{
    const a=new HeistEngine(2,54321),b=new HeistEngine(2,54321);
    expect(a.snapshot()).toEqual(b.snapshot());
    for(let i=0;i<8;i++){Math.random();const move=a.hint()!;a.action(move);b.action(move);expect(a.snapshot()).toEqual(b.snapshot());}
  });
  it('resumes the exact next cascade from a saved RNG state',()=>{
    const a=new HeistEngine(5,123);a.action(a.hint()!);
    const b=new HeistEngine(5,999,8,8,a.snapshot());const move=a.hint()!;
    expect(a.action(move)).toEqual(b.action(move));expect(a.snapshot()).toEqual(b.snapshot());
  });
  it('keeps every seeded board settled, playable, and complete after many moves',()=>{
    for(let seed=1;seed<=30;seed++){const e=new HeistEngine(seed%60+1,seed);for(let i=0;i<12;i++){
      expect(e.hint()).toBeDefined();e.action(e.hint()!);expect(e.state.tiles).toHaveLength(64);expect(new Set(e.state.tiles.map(t=>`${t.row},${t.col}`)).size).toBe(64);
    }}
  },20000);
  it('combines laser and bomb into three rows and three columns',()=>{
    const e=new HeistEngine(1,1);e.state.tiles=board();const a=e.at([3,3])!,b=e.at([3,4])!;a.special='lineH';b.special='bomb';
    const targets=e.fusion(a,b);expect(targets).toHaveLength(39);expect(targets.some(t=>t.row===2&&t.col===0)).toBe(true);expect(targets.some(t=>t.row===0&&t.col===5)).toBe(true);
    expect(e.action({kind:'swap',from:[3,3],to:[3,4]}).frames[0].cleared.length).toBeGreaterThanOrEqual(39);
  });
  it('converts every matching color to lasers when combined with an overload',()=>{
    const e=new HeistEngine(1,1);e.state.tiles=board();const a=e.at([2,2])!,b=e.at([2,3])!;a.special='overload';b.special='lineV';
    e.fusion(a,b);expect(e.state.tiles.filter(t=>t.type===b.type).every(t=>t.special==='lineV')).toBe(true);
  });
  it('chains existing specials and credits mission and score together',()=>{
    const e=new HeistEngine(1,10);e.state.tiles=board();e.at([0,0])!.special='lineH';e.at([0,4])!.special='lineV';
    const result=e.action({kind:'special',at:[0,0]});expect(result.frames[0].cleared.length).toBeGreaterThanOrEqual(15);
    expect(e.state.score).toBe(result.frames.reduce((s,f)=>s+f.points,0));
  });
  it.each(['tap','swap','chain'] as const)('overload fires every active board special once via %s, regardless of color or distance',trigger=>{
    const e=new HeistEngine(1,42);e.state.tiles=board();const core=e.at([0,0])!;core.special='overload';
    const specials=[[7,7,'bomb'],[6,5,'lineH'],[5,6,'lineV'],[4,4,'overload']] as const;
    for(const [r,c,special] of specials)e.at([r,c])!.special=special;
    const active=specials.map(([r,c])=>e.at([r,c])!.id);
    const shield=e.at([2,2])!;shield.special='bomb';shield.locked=true;shield.lockHealth=2;
    if(trigger==='chain')e.at([0,7])!.special='lineH';
    const result=e.action(trigger==='tap'?{kind:'special',at:[0,0]}:trigger==='swap'?{kind:'swap',from:[0,0],to:[0,1]}:{kind:'special',at:[0,7]});
    const fired=result.frames[0].specials!.map(t=>t.id);for(const id of active){expect(fired.filter(x=>x===id)).toHaveLength(1);expect(result.frames[0].cleared).toContain(id);}
    expect(fired).not.toContain(shield.id);expect(new Set(fired).size).toBe(fired.length);expect(e.state.progress.boosters).toBe(0);expect(e.state.turn).toBe(1);
    expect(e.state.tiles).toHaveLength(64);expect(e.hint()).toBeDefined();
  });
  it('preserves existing bomb effects when overload fuses with a laser of their color',()=>{
    const e=new HeistEngine(1,42);e.state.tiles=board();const a=e.at([0,0])!,b=e.at([0,1])!,bomb=e.at([7,7])!;a.special='overload';b.special='lineH';bomb.type=b.type;bomb.special='bomb';
    const result=e.action({kind:'swap',from:[0,0],to:[0,1]});expect(result.frames[0].specials!.find(t=>t.id===bomb.id)?.special).toBe('bomb');
  });
  it('uses the swapped color rather than also clearing the most common color',()=>{
    const e=new HeistEngine(1,1);e.state.tiles=board();const a=e.at([0,0])!,b=e.at([0,1])!;a.special='overload';
    const color=b.type;const targets=e.fusion(a,b);const frame=e.clear(targets,[],1);
    expect(frame.cleared.every(id=>id===a.id||board().find(t=>t.id===id)?.type===color)).toBe(true);
  });
  it('rejects nonadjacent and locked swaps without using a move or RNG',()=>{
    const e=new HeistEngine(1,7);e.state.tiles=board();e.at([0,1])!.locked=true;const before=e.snapshot();
    expect(e.action({kind:'swap',from:[0,0],to:[0,1]}).accepted).toBe(false);
    expect(e.action({kind:'swap',from:[0,0],to:[4,4]}).accepted).toBe(false);expect(e.snapshot()).toEqual(before);
  });
  it('anchors barriers and collects packets only at the bottom',()=>{
    const e=new HeistEngine(4,1);const b=board();const barrier=b.find(t=>t.row===3&&t.col===1)!;barrier.locked=true;barrier.lockHealth=1;
    const packet=b.find(t=>t.row===5&&t.col===1)!;packet.packet=true;
    const next=e.gravity(b.filter(t=>!(t.col===1&&t.row>=6)));expect(next.find(t=>t.id===barrier.id)?.row).toBe(3);
    expect(next.some(t=>t.id===packet.id)).toBe(false);expect(e.state.progress.packets).toBe(1);expect(next).toHaveLength(64);
  });
  it('counts adjacent hazard damage and vault hits',()=>{
    const e=new HeistEngine(5,1);e.state.tiles=board();const v=e.at([3,3])!;v.locked=true;v.vault=true;v.lockHealth=2;
    e.clear([e.at([3,2])!],[],1);expect(e.state.progress.vault).toBe(1);expect(e.state.tiles.find(t=>t.id===v.id)?.locked).toBe(true);
  });
  it('purges all hazard types, shield layers and boss locks in one accepted booster without spending a move',()=>{
    const e=new HeistEngine(10,22);e.state.tiles=board();
    const kinds=['ice','corrupted','lock','turret','plasma_shield','void'] as const;
    kinds.forEach((obstacleType,i)=>Object.assign(e.at([i,1])!,{locked:true,lockHealth:i>3?2:1,obstacleType,bossLock:i===2}));
    Object.assign(e.at([7,7])!,{locked:true,lockHealth:2,obstacleType:'plasma_shield',vault:true});const packet=e.at([0,4])!;packet.packet=true;
    const result=e.action({kind:'booster',booster:'glitch_wipe'});expect(result.accepted).toBe(true);expect(result.spendsMove).toBe(false);
    expect(result.frames[0].hazards).toHaveLength(7);expect(e.state.tiles.some(t=>t.locked||t.vault||t.bossLock||t.lockHealth>0||(t.obstacleType&&t.obstacleType!=='none'))).toBe(false);
    expect(e.state.progress.hazards).toBe(7);expect(e.state.progress.vault).toBe(e.state.mission.target);expect(e.state.progress.boosters).toBe(1);expect(e.state.turn).toBe(0);expect(e.state.tiles.find(t=>t.id===packet.id)?.packet).toBe(true);expect(e.state.tiles).toHaveLength(64);
  });
  it('rejects an empty-board purge without spending inventory, moves or RNG',()=>{
    const e=new HeistEngine(1,22);e.state.tiles=board();const before=e.snapshot();expect(e.action({kind:'booster',booster:'glitch_wipe'}).accepted).toBe(false);expect(e.snapshot()).toEqual(before);
  });
  it.each(['hazard','packet'] as const)('rejects an Overload injection on a %s without deleting an objective or consuming inventory',kind=>{
    const e=new HeistEngine(5,12);e.state.tiles=board();Object.assign(e.at([3,3])!,kind==='hazard'?{locked:true,vault:true,lockHealth:2,obstacleType:'plasma_shield'}:{packet:true});const before=e.snapshot();
    expect(e.action({kind:'booster',booster:'overload_core',at:[3,3]}).accepted).toBe(false);expect(e.snapshot()).toEqual(before);
  });
  it('telegraphs and executes a boss lockdown on the fourth move',()=>{
    const e=new HeistEngine(10,5);expect(e.bossWarning()).toContain('4 moves');const row=(1+5)%8;
    for(let i=0;i<4;i++)e.action(e.hint()!);
    expect(e.state.turn).toBe(4);expect(e.state.tiles.some(t=>t.row===row&&t.bossLock&&t.locked)).toBe(true);
    expect(e.bossWarning()).toContain('4 moves');
  });
  it.each([1,2,3])('makes training lesson %i completable with the demonstrated gesture',lesson=>{
    const e=new HeistEngine(1,100+lesson,8,8,undefined,lesson);expect(e.complete()).toBe(false);
    e.action({kind:'swap',from:[1,1],to:[0,1]});expect(e.complete()).toBe(true);
  });
  it('validates saved counters and RNG bounds',()=>{
    const e=new HeistEngine(1,1),s=e.snapshot();expect(validSnapshot(s,s.tiles)).toBe(true);
    expect(validSnapshot({...s,rng:Infinity},s.tiles)).toBe(false);expect(validSnapshot({...s,progress:{...s.progress,tokens:-1}},s.tiles)).toBe(false);
  });
});
describe('campaign, daily and preferences',()=>{
  it('rotates all five objectives and bounds endless targets',()=>{
    expect(new Set([1,2,3,4,5].map(n=>getMission(n).kind)).size).toBe(5);
    expect(getDistrictForLevel(10000).targetScore).toBeLessThan(8000);expect(getDistrictForLevel(10000).moves).toBeLessThanOrEqual(32);
  });
  it('uses UTC dates and changes the daily seed each day',()=>{
    expect(dailyChallenge(new Date('2026-10-08T23:59:59Z')).seed).toBe(dailyChallenge(new Date('2026-10-08T00:00:00Z')).seed);
    expect(dailyChallenge(new Date('2026-10-09T00:00:00Z')).seed).not.toBe(dailyChallenge(new Date('2026-10-08T00:00:00Z')).seed);
  });
  it('tracks personal best stars and first-completion rewards without replay farming',()=>{
    const a=recordCompletion(freshCareer(),1,4000,7,0);expect(a.first).toBe(true);expect(a.stars).toBe(3);
    const b=recordCompletion(a.career,1,1000,0,2);expect(b.first).toBe(false);expect(totalStars(b.career)).toBe(3);expect(b.career.best[1]).toBe(4000);
    expect(b.career.unlocked).toBe(2);
  });
  it('rejects corrupt career fields and locked cosmetic selections',()=>{
    expect(readCareer('{')).toEqual(freshCareer());expect(readCareer(JSON.stringify({...freshCareer(),cosmetic:'gold'})).cosmetic).toBe('neon');
  });
  it('uses safe preference defaults for malformed input',()=>{
    expect(readPreferences('{').quality).toBe('medium');expect(readPreferences('{"quality":"ultra","symbols":true}')).not.toHaveProperty('symbols');
  });
});
