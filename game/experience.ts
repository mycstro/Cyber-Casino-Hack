import {getDistrictForLevel} from './campaign';

export interface ExperienceReward {base:number; bonus:number; total:number; multiplier:number; movesTaken:number; moveBudget:number; difficulty:number; boosterFree:boolean}
/** XP is separate from match score. Only an accepted inventory booster removes the clean-clear multiplier. */
export function completionExperience(level:number,movesTaken:number,boostersUsed:number):ExperienceReward {
  const district=getDistrictForLevel(level),boss=level%10===0;
  const moves=Math.max(0,Math.floor(Number.isFinite(movesTaken)?movesTaken:district.moves));
  const efficiency=Math.max(0,Math.min(1,1-moves/district.moves));
  const base=100+25*(district.tier-1)+(boss?50:0);
  const boosterFree=boostersUsed===0;
  const multiplier=boosterFree?Math.round((1.25+.1*(district.tier-1)+(boss?.25:0)+.75*efficiency)*100)/100:1;
  const total=Math.round(base*multiplier);
  return {base,bonus:total-base,total,multiplier,movesTaken:moves,moveBudget:district.moves,difficulty:district.tier,boosterFree};
}
export const experienceRank=(xp:number)=>1+Math.floor(Math.max(0,xp)/1000);
