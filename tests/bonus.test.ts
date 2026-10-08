import {describe,it,expect} from 'vitest';
import {BONUS_KEY,INVENTORY_KEY,SLOT_PRIZES,createBonus,claimBonus,readBonus,recoverBonus} from '../game/bonus';
import type {BoosterInventory} from '../types';
const inventory:BoosterInventory={emp_bomb:3,line_laser:2,overload_core:1,overclock_moves:8,glitch_wipe:4};
function storage(){const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};}
describe('milestone slot rewards and crash recovery',()=>{
  it.each(SLOT_PRIZES)('grants $amount of $booster for a matching power-$power prize, once',prize=>{
    const store=storage(),round=createBonus(10,()=>((prize.power-1)+.1)/5);store.setItem(BONUS_KEY,JSON.stringify(round));
    const paid=claimBonus(store,round,inventory);expect(paid.inventoryAfter).toEqual({...inventory,[prize.booster]:inventory[prize.booster]+6-prize.power});
    expect(paid.applied).toBe(true);expect(claimBonus(store,round,paid.inventoryAfter!)).toEqual(paid);
    expect(recoverBonus(store)).toEqual(paid);expect(JSON.parse(store.getItem(INVENTORY_KEY)!)).toEqual(paid.inventoryAfter);
  });
  it.each([2,3])('recovers a crash on write %i without adding twice or overwriting later inventory',failAt=>{
    const store=storage(),round=createBonus(20,()=>.9);store.setItem(BONUS_KEY,JSON.stringify(round));let writes=0;
    expect(()=>claimBonus({...store,setItem:(k,v)=>{if(++writes===failAt)throw Error('interrupted');store.setItem(k,v);}},round,inventory)).toThrow();
    const recovered=recoverBonus(store)!;expect(recovered.inventoryAfter?.overload_core).toBe(2);expect(recovered.applied).toBe(true);
    store.setItem(INVENTORY_KEY,JSON.stringify({...inventory,overload_core:7}));recoverBonus(store);expect(JSON.parse(store.getItem(INVENTORY_KEY)!).overload_core).toBe(7);
  });
  it('does not reroll a saved spin or grant a missing/different receipt',()=>{
    const store=storage(),round=createBonus(60,()=>0);store.setItem(BONUS_KEY,JSON.stringify(round));expect(recoverBonus(store)).toEqual(round);
    expect(()=>claimBonus(store,{...round,id:'different'},inventory)).toThrow();store.removeItem(BONUS_KEY);expect(()=>claimBonus(store,round,inventory)).toThrow();
  });
  it('validates milestones, prize types, payment flags and balances',()=>{
    expect(()=>createBonus(11)).toThrow();const b=createBonus(10,()=>0);
    for(const change of [{level:11},{booster:'unknown'},{claimed:false,applied:true},{claimed:true},{claimed:true,inventoryAfter:{...inventory,emp_bomb:-1}}])expect(readBonus(JSON.stringify({...b,...change}))).toBeNull();
    expect(readBonus('broken')).toBeNull();
  });
});
