import {dailyChallenge,getDistrictForLevel} from './campaign';
import {HeistEngine,type Action} from './engine';

/** Reusable authoritative rule check. Local verification alone is not online anti-cheat. */
export function validateDailyReplay(day:string,actions:unknown,claimedScore:number) {
  try {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Array.isArray(actions)||actions.length>100||!Number.isSafeInteger(claimedScore)||claimedScore<0)return {valid:false,reason:'Invalid receipt'};
    const date=new Date(day+'T00:00:00Z');if(date.toISOString().slice(0,10)!==day)return {valid:false,reason:'Invalid day'};
    const daily=dailyChallenge(date),e=new HeistEngine(daily.level,daily.seed);
    const inventory:Record<string,number>={...daily.boosters};let moves=getDistrictForLevel(daily.level).moves;
    const position=(p:unknown)=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isInteger(v)&&v>=0&&v<8);
    for(const raw of actions) {
      if(!raw||e.complete()||moves<=0)return {valid:false,reason:'Action after completion'};
      const a=raw as Action;
      if(a.kind==='swap'){if(!position(a.from)||!position(a.to))return {valid:false,reason:'Invalid swap'};}
      else if(a.kind==='special'){if(!position(a.at))return {valid:false,reason:'Invalid special'};}
      else if(a.kind==='booster') {
        if(!Object.hasOwn(inventory,a.booster)||inventory[a.booster]<=0||!position(a.at))return {valid:false,reason:'Invalid booster'};
        inventory[a.booster]--;
      }else return {valid:false,reason:'Unknown action'};
      const result=e.action(a);if(!result.accepted)return {valid:false,reason:'Rejected action'};
      if(result.spendsMove)moves--;
      moves+=result.bonusMoves||0;
    }
    const score=e.state.score+(e.complete()?moves*200:0);
    return {valid:score===claimedScore,score,moves,complete:e.complete(),reason:score===claimedScore?'Verified':'Score mismatch'};
  }catch{return {valid:false,reason:'Invalid receipt'};}
}
