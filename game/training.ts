import type {Action} from './engine';
export const LESSONS = [
  {title:'Match three',goal:'Line up three cyan diamonds to clear them and earn points.',result:'Three matching pieces clear together. Pieces above fall into the gaps. Look for another line of three before swapping.'},
  {title:'Create a Cross Laser',goal:'Swap the outlined diamond and chip to clear two lines in one move.',result:'Two matched lines create a Cross Laser. Select it twice in a heist to clear two rows and two columns. Three or more matched lines cleared by one swap, including cascades, add +5 moves once. Overload, EMP and Purge come from rewards.'},
  {title:'Break a shield',goal:'Make a match next to the ICE at row 2, column 1.',result:'Matches beside a hazard remove one shield health. A shield showing 2 needs two hits. You cannot swap a shielded piece; clear the shield first.'},
] as const;
export function lesson(number:number){return LESSONS[Math.max(0,Math.min(2,number-1))];}
export function trainingSwap(action:Action):boolean {
  if(action.kind!=='swap')return false;
  const cell=(p:number[],r:number)=>p[0]===r&&p[1]===1;
  return (cell(action.from,1)&&cell(action.to,0))||(cell(action.from,0)&&cell(action.to,1));
}
