import {describe,it,expect} from 'vitest';
import {THEMES,themeForLevel,themedTone} from '../game/themes';
import {freshCareer,readCareer,recordCompletion,canEquipPieces} from '../game/progression';
import {LESSONS,trainingSwap} from '../game/training';
import {HeistEngine} from '../game/engine';

describe('chapter experiences and collectible pieces',()=>{
  it('changes scenery at each ten-level boundary, including the endless frontier',()=>{
    for(let chapter=0;chapter<18;chapter++){
      const first=chapter*10+1,last=first+9;
      expect(themeForLevel(first)).toEqual(THEMES[chapter%6]);
      expect(themeForLevel(last)).toEqual(themeForLevel(first));
      expect(themeForLevel(last+1).id).not.toBe(themeForLevel(last).id);
    }
    expect(new Set(THEMES.map(t=>t.motion)).size).toBe(6);
  });
  it('gives each chapter distinct pitches and preserves the original opening sound',()=>{
    expect(themedTone(themeForLevel(1),440,'sawtooth')).toEqual({frequency:440,wave:'sawtooth'});
    expect(new Set(THEMES.map(t=>JSON.stringify(themedTone(t,440,'square')))).size).toBe(6);
    expect(themeForLevel(0)).toEqual(THEMES[0]);expect(themeForLevel(NaN)).toEqual(THEMES[0]);
  });
  it('awards collections once at 5, 10 and 20 distinct breached nodes, never on replays',()=>{
    let career=freshCareer();
    for(let n=1;n<=21;n++){
      const result=recordCompletion(career,n,4000,5,0);
      expect(result.piecesWon).toEqual(n===5?['gems']:n===10?['arcade']:n===20?['relics']:[]);
      career=result.career;
      expect(recordCompletion(career,n,9000,9,0).piecesWon).toEqual([]);
    }
    expect(canEquipPieces(career,'relics')).toBe(true);
  });
  it('migrates old careers and rejects unknown or unearned equipped collections',()=>{
    expect(readCareer('{"unlocked":50,"stars":{}}').pieceStyle).toBe('classic');
    expect(readCareer(JSON.stringify({...freshCareer(),pieceStyle:'gems'})).pieceStyle).toBe('classic');
    const career={...freshCareer(),stars:{1:1,2:1,3:1,4:1,5:1},pieceStyle:'gems'};
    expect(readCareer(JSON.stringify(career)).pieceStyle).toBe('gems');
    expect(readCareer(JSON.stringify({...career,pieceStyle:'unknown'})).pieceStyle).toBe('classic');
  });
  it.each([1,2,3])('teaches lesson %i with a safe prescribed gesture and a specific explanation',n=>{
    expect(LESSONS[n-1].goal).toBeTruthy();expect(LESSONS[n-1].result).toBeTruthy();
    const action={kind:'swap' as const,from:[1,1] as [number,number],to:[0,1] as [number,number]};
    expect(trainingSwap(action)).toBe(true);
    expect(trainingSwap({...action,to:[1,2]})).toBe(false);
    expect(trainingSwap({kind:'special',at:[1,1]})).toBe(false);
    const e=new HeistEngine(1,101,8,8,undefined,n);e.action(action);expect(e.complete()).toBe(true);
  });
});
