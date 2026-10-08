import {describe,it,expect} from 'vitest';
import {completionExperience,experienceRank} from '../game/experience';
import {freshCareer,readCareer,recordCompletion} from '../game/progression';
describe('booster-free experience',()=>{
  it('awards more XP for fewer moves, higher difficulty and security cores',()=>{
    expect(completionExperience(1,3,0).total).toBeGreaterThan(completionExperience(1,18,0).total);
    expect(completionExperience(51,3,0).multiplier).toBeGreaterThan(completionExperience(1,3,0).multiplier);
    expect(completionExperience(10,5,0).multiplier).toBeGreaterThan(completionExperience(9,5,0).multiplier);
  });
  it('removes the multiplier for every consumed booster, including move injections',()=>{
    for(let boosters=1;boosters<=5;boosters++){const xp=completionExperience(60,1,boosters);expect(xp.multiplier).toBe(1);expect(xp.bonus).toBe(0);expect(xp.total).toBe(xp.base);}
  });
  it('bounds efficiency and difficulty and grants a clean bonus even with no moves left',()=>{
    expect(completionExperience(1,22,0).multiplier).toBe(1.25);expect(completionExperience(1,1000,0).multiplier).toBe(1.25);
    expect(completionExperience(100,0,0).multiplier).toBe(2.75);expect(completionExperience(1,NaN,0).movesTaken).toBe(22);
  });
  it('adds separate persistent XP each run without altering scores or mastery stars',()=>{
    const first=recordCompletion(freshCareer(),1,4000,10,0,12),second=recordCompletion(first.career,1,5000,10,0,12);
    expect(first.career.best[1]).toBe(4000);expect(second.career.xp).toBe(first.experience.total*2);expect(second.career.stars[1]).toBe(3);
    expect(readCareer(JSON.stringify(second.career)).xp).toBe(second.career.xp);expect(readCareer('{"unlocked":3}').xp).toBe(0);
    expect(readCareer(JSON.stringify({...second.career,xp:-1})).xp).toBe(0);expect(experienceRank(1000)).toBe(2);
  });
});
