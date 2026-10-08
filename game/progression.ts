import {completionExperience} from './experience';
import {getDistrictForLevel} from './campaign';
export interface Career {unlocked: number; stars: Record<string, number>; best: Record<string, number>; achievements: string[]; cosmetic: string; pieceStyle:string; xp:number}
export const PIECE_STYLES = [
  {id:'classic',name:'Casino Originals',need:0,description:'Diamonds, chips, coins, circuits and dice'},
  {id:'gems',name:'Prismatic Gems',need:5,description:'Five faceted crystal cuts'},
  {id:'arcade',name:'Arcade Blocks',need:10,description:'Five bold retro shapes'},
  {id:'relics',name:'Orbital Relics',need:20,description:'Five miniature cosmic artifacts'},
] as const;
export const completedNodes=(career:Career)=>Object.keys(career.stars).length;
export const canEquipPieces=(career:Career,id:string)=>PIECE_STYLES.some(p=>p.id===id&&p.need<=completedNodes(career));
export const COSMETICS = [
  {id:'neon',name:'Neon Runner',need:0,color:'#00f7ff',description:'Original cyan matrix'},
  {id:'lotus',name:'Lotus Agent',need:6,color:'#ff0077',description:'Magenta board and hacker aura'},
  {id:'gold',name:'Golden Ghost',need:15,color:'#ffb700',description:'Gold board and hacker aura'},
  {id:'jade',name:'Jade Cipher',need:30,color:'#00ff88',description:'Emerald board and hacker aura'},
];
export const freshCareer = (): Career => ({unlocked:1,stars:{},best:{},achievements:[],cosmetic:'neon',pieceStyle:'classic',xp:0});
export const totalStars = (career: Career) => Object.values(career.stars).reduce((a,b) => a+b,0);
export function readCareer(raw: string | null): Career {
  try {
    const x = JSON.parse(raw || 'null');
    if (!x || !Number.isSafeInteger(x.unlocked) || x.unlocked < 1) return freshCareer();
    const stars = Object.fromEntries(Object.entries(x.stars || {}).filter(([k,v]) => /^\d+$/.test(k) && Number.isInteger(v) && Number(v)>=1 && Number(v)<=3)) as Record<string,number>;
    const best = Object.fromEntries(Object.entries(x.best || {}).filter(([k,v]) => /^\d+$/.test(k) && Number.isFinite(v) && Number(v)>=0)) as Record<string,number>;
    const career:Career = {unlocked:Math.min(10000,x.unlocked),stars,best,achievements:Array.isArray(x.achievements)?x.achievements.filter((v:unknown)=>typeof v==='string'):[],cosmetic:'neon',pieceStyle:'classic',xp:Number.isSafeInteger(x.xp)&&x.xp>=0?x.xp:0};
    if (COSMETICS.some(c=>c.id===x.cosmetic && c.need<=totalStars(career))) career.cosmetic=x.cosmetic;
    if(canEquipPieces(career,x.pieceStyle))career.pieceStyle=x.pieceStyle;
    return career;
  } catch {return freshCareer();}
}
export function recordCompletion(career: Career, level:number, score:number, moves:number, boostersUsed:number, movesTaken=Math.max(0,getDistrictForLevel(level).moves-moves)) {
  const stars = 1 + Number(moves >= 5) + Number(boostersUsed === 0);
  const first = !career.stars[level];
  const experience=completionExperience(level,movesTaken,boostersUsed);
  const next:Career = {...career,xp:Math.min(Number.MAX_SAFE_INTEGER,(career.xp||0)+experience.total),unlocked:Math.max(career.unlocked,level+1),
    stars:{...career.stars,[level]:Math.max(career.stars[level] || 0,stars)},best:{...career.best,[level]:Math.max(career.best[level] || 0,score)},
    achievements:[...new Set([...career.achievements,'First Breach',...(stars===3?['Clean Getaway']:[]),...(level%10===0?['Core Breaker']:[])])]};
  const piecesWon=PIECE_STYLES.filter(p=>p.need>completedNodes(career)&&p.need<=completedNodes(next)).map(p=>p.id);
  return {career:next,stars,first,piecesWon,experience};
}
