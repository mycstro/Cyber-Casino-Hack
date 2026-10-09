import {RESOLUTIONS,type GameResolution} from './display';
export interface Preferences {quality:'low'|'medium'|'high'; reducedMotion:boolean; keyboard:boolean; hints:boolean; resolution?:GameResolution}
export function readPreferences(raw:string|null):Preferences {
  let x:any={}; try{x=JSON.parse(raw || '{}') || {}}catch{}
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return {quality:['low','medium','high'].includes(x.quality)?x.quality:'medium',reducedMotion:typeof x.reducedMotion==='boolean'?x.reducedMotion:!!reduced,
    keyboard:x.keyboard!==false,hints:x.hints!==false,resolution:Object.hasOwn(RESOLUTIONS,x.resolution)?x.resolution:'1080p'};
}
