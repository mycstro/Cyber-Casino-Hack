import type {BoosterType,BoosterInventory} from '../types';
import {parseBoosters} from './persistence';
export const BONUS_KEY='cyber_casino_bonus_v1';
export const INVENTORY_KEY='cyber_casino_boosters_v5';
export const SLOT_PRIZES=[
  {booster:'overclock_moves',name:'+5 Move Injections',power:1,amount:5,icon:'⏱',color:'#4ade80'},
  {booster:'emp_bomb',name:'EMP Blasts',power:2,amount:4,icon:'✹',color:'#fbbf24'},
  {booster:'line_laser',name:'Cross Lasers',power:3,amount:3,icon:'ϟ',color:'#22d3ee'},
  {booster:'glitch_wipe',name:'Hazard Purges',power:4,amount:2,icon:'◇',color:'#c084fc'},
  {booster:'overload_core',name:'Overload Cores',power:5,amount:1,icon:'◎',color:'#e879f9'},
] as const;
export const slotPrize=(booster:BoosterType)=>SLOT_PRIZES.find(p=>p.booster===booster)!;
export interface BonusRound {id:string;level:number;booster:BoosterType;claimed:boolean;applied:boolean;inventoryAfter?:BoosterInventory}
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const zero:BoosterInventory={emp_bomb:0,line_laser:0,overload_core:0,overclock_moves:0,glitch_wipe:0};
export function readBonus(raw:string|null):BonusRound|null {
  try {
    const b=JSON.parse(raw||'null');
    if(!b||typeof b.id!=='string'||!b.id||!Number.isSafeInteger(b.level)||b.level<10||b.level%10||!SLOT_PRIZES.some(p=>p.booster===b.booster)||typeof b.claimed!=='boolean'||typeof b.applied!=='boolean'||(b.applied&&!b.claimed))return null;
    if(b.claimed&&(!b.inventoryAfter||Object.keys(zero).some(k=>!Number.isSafeInteger(b.inventoryAfter[k])||b.inventoryAfter[k]<0)))return null;
    return {id:b.id,level:b.level,booster:b.booster,claimed:b.claimed,applied:b.applied,...(b.claimed?{inventoryAfter:parseBoosters(JSON.stringify(b.inventoryAfter),zero)}:{})};
  }catch{return null;}
}
export function createBonus(level:number,random=Math.random):BonusRound {
  if(!Number.isSafeInteger(level)||level<10||level%10)throw new Error('Bonus rounds require a tenth campaign level.');
  const index=Math.min(4,Math.max(0,Math.floor(random()*5)));
  return {id:crypto.randomUUID(),level,booster:SLOT_PRIZES[index].booster,claimed:false,applied:false};
}
/** Write the receipt first; replaying an interrupted inventory write uses its exact balance, never another addition. */
export function recoverBonus(store:Store):BonusRound|null {
  const b=readBonus(store.getItem(BONUS_KEY));
  if(b?.claimed&&!b.applied){store.setItem(INVENTORY_KEY,JSON.stringify(b.inventoryAfter));const paid={...b,applied:true};store.setItem(BONUS_KEY,JSON.stringify(paid));return paid;}
  return b;
}
export function claimBonus(store:Store,round:BonusRound,inventory:BoosterInventory):BonusRound {
  const saved=recoverBonus(store);
  if(!saved||saved.id!==round.id)throw new Error('Bonus round no longer available.');
  if(saved.claimed)return saved;
  const prize=slotPrize(saved.booster),after={...inventory,[saved.booster]:inventory[saved.booster]+prize.amount};
  const receipt={...saved,claimed:true,applied:false,inventoryAfter:after};
  store.setItem(BONUS_KEY,JSON.stringify(receipt));
  store.setItem(INVENTORY_KEY,JSON.stringify(after));
  const paid={...receipt,applied:true};store.setItem(BONUS_KEY,JSON.stringify(paid));return paid;
}
