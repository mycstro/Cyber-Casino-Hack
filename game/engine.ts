import type {BoosterType, GridTile} from '../types';
import {findBoardMatches, hasBoardMove, recoverBoard,crossLines} from './board.ts';
import {getDistrictForLevel, getMission, type Mission} from './campaign.ts';

export interface Progress {tokens:number; hazards:number; packets:number; vault:number; swaps:number; specials:number; boosters:number}
export interface Snapshot {version:1; seed:number; rng:number; serial:number; turn:number; progress:Progress; tiles:GridTile[]; score:number; mission:Mission; tutorial:number; legacyScore?:boolean}
export interface Frame {tiles:GridTile[]; cleared:string[]; points:number; combo:number; message?:string; settled?:GridTile[]; hazards?:GridTile[]; specials?:GridTile[]; created?:GridTile[]; effect?:'swap'|'invalid'|'match'|'laser'|'emp'|'overload'|'purge'|'inject'|'boss'}
export type Action = {kind:'swap'; from:[number,number]; to:[number,number]} | {kind:'special'; at:[number,number]} | {kind:'booster'; booster:BoosterType; at?:[number,number]};
export const emptyProgress = ():Progress => ({tokens:0,hazards:0,packets:0,vault:0,swaps:0,specials:0,boosters:0});
export const TOKEN_NAMES = ['Diamond','Chip','Coin','Circuit','Core'];
export const TOKEN_SYMBOLS = ['◆','▣','●','✚','⬟'];
export class HeistEngine {
  state:Snapshot;
  readonly level:number;
  readonly rows:number;
  readonly cols:number;
  constructor(level:number, seed:number, rows=8, cols=8, restored?:Snapshot, tutorial=0) {
    this.level=level;this.rows=rows;this.cols=cols;
    this.state = restored ? structuredClone(restored) : {version:1,seed:seed>>>0,rng:seed>>>0,serial:0,turn:0,progress:emptyProgress(),tiles:[],score:0,mission:getMission(level),tutorial};
    if (!restored) this.generate();
  }
  random = () => {
    // Mulberry32: gameplay draws never depend on rendering, audio, or wall-clock time.
    let t = this.state.rng = (this.state.rng + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  tile(row:number,col:number,type=Math.floor(this.random()*5)):GridTile {
    const x=(col-(this.cols-1)/2)*1.15,y=((this.rows-1)/2-row)*1.15;
    return {id:`g-${this.state.seed}-${++this.state.serial}`,row,col,type,special:'none',locked:false,obstacleType:'none',lockHealth:0,matched:false,x,y,targetX:x,targetY:y,scale:1,rotationY:0};
  }
  generate() {
    const board:GridTile[]=[];
    for(let r=0;r<this.rows;r++) for(let c=0;c<this.cols;c++) {
      const t=this.tile(r,c);
      while((c>1 && board.at(-1)?.type===t.type && board.at(-2)?.type===t.type) ||
        (r>1 && board[(r-1)*this.cols+c].type===t.type && board[(r-2)*this.cols+c].type===t.type)) t.type=Math.floor(this.random()*5);
      board.push(t);
    }
    const positions=board.filter(t=>t.row>0&&t.row<this.rows-1&&t.col>0&&t.col<this.cols-1);
    for(let i=positions.length-1;i>0;i--) {const j=Math.floor(this.random()*(i+1));[positions[i],positions[j]]=[positions[j],positions[i]];}
    if (!this.state.tutorial) {
      let i=0;
      for(const [kind,count] of Object.entries(getDistrictForLevel(this.level).obstaclePlan)) for(let n=0;n<count;n++) {
        const t=positions[i++];if(!t)break;t.locked=true;t.obstacleType=kind as GridTile['obstacleType'];t.lockHealth=['void','plasma_shield'].includes(kind)?2:1;
      }
      if(this.state.mission.kind==='packets') for(const c of [1,this.cols-2]) {
        const t=board.find(t=>t.row===0&&t.col===c)!;t.packet=true;t.locked=false;
      }
      if(this.state.mission.kind==='vault') {const t=board.find(t=>t.row===Math.floor(this.rows/2)&&t.col===Math.floor(this.cols/2))!;t.vault=true;t.locked=true;t.lockHealth=2;t.obstacleType='plasma_shield';}
      this.state.tiles=recoverBoard(board,this.rows,this.cols,this.random);
    } else {
      // Each lesson has one explicit gesture and no unrelated board hazards.
      for(const t of board)t.type=(t.row+t.col)%5;
      const paint=(r:number,c:number,type:number)=>{board.find(t=>t.row===r&&t.col===c)!.type=type;};
      paint(0,0,0);paint(0,1,1);paint(0,2,0);paint(1,1,0);
      if(this.state.tutorial===2){paint(1,0,1);paint(1,2,1);}
      if(this.state.tutorial===3){const t=board.find(t=>t.row===1&&t.col===0)!;t.locked=true;t.lockHealth=1;t.obstacleType='ice';}
      this.state.tiles=board;
      this.state.mission={kind:this.state.tutorial===3?'hazards':'score',target:this.state.tutorial===3?1:300,color:0,boss:false,label:['','Lesson 1: swap row 2, column 2 with row 1, column 2','Lesson 2: clear two lines to create a Cross Laser','Lesson 3: match beside ICE to break its shield'][this.state.tutorial]};
    }
  }
  at(pos:[number,number]) {return this.state.tiles.find(t=>t.row===pos[0]&&t.col===pos[1]);}
  progressValue() {const {mission:m,progress:p,score}=this.state;return m.kind==='score'?score:p[m.kind];}
  complete() {if(this.state.tutorial===2)return this.state.progress.specials>0;return this.progressValue()>=this.state.mission.target;}
  snapshot() {const s=structuredClone(this.state);for(const t of s.tiles){t.x=t.targetX;t.y=t.targetY;}return s;}
  normalize(board:GridTile[]) {for(const t of board){t.targetX=(t.col-(this.cols-1)/2)*1.15;t.targetY=((this.rows-1)/2-t.row)*1.15;t.scale=1;t.matched=false;}}
  gravity(board:GridTile[]):GridTile[] {
    // Barriers stay anchored; tokens fall independently within each column segment.
    const result=board.filter(t=>t.locked);
    for(let c=0;c<this.cols;c++) {
      let end=this.rows-1;
      while(end>=0) {
        if(board.some(t=>t.col===c&&t.row===end&&t.locked)){end--;continue;}
        let start=end;while(start>0&&!board.some(t=>t.col===c&&t.row===start-1&&t.locked))start--;
        const segment=board.filter(t=>t.col===c&&t.row>=start&&t.row<=end&&!t.locked).sort((a,b)=>b.row-a.row);
        let dest=end;for(const t of segment){t.row=dest--;result.push(t);}while(dest>=start){const t=this.tile(dest--,c);t.y=((this.rows-1)/2-start+2)*1.15;result.push(t);}
        end=start-1;
      }
    }
    // A packet is collected only at the bottom; then the resulting gap is refilled.
    const delivered=result.filter(t=>t.packet&&t.row===this.rows-1);
    this.state.progress.packets+=delivered.length;
    if(delivered.length)return this.gravity(result.filter(t=>!delivered.includes(t)));
    this.normalize(result);return result;
  }
  area(tile:GridTile) {
    const b=this.state.tiles;
    if(tile.special==='overload')return b.filter(t=>t.type===this.mostCommon()||t.id===tile.id||(t.special!=='none'&&!t.locked&&!t.packet));
    if(tile.special==='lineH')return b.filter(t=>t.row===tile.row);
    if(tile.special==='lineV')return b.filter(t=>t.col===tile.col);
    if(tile.special==='lineCross'){const lines=crossLines(tile.row,tile.col,this.rows,this.cols);return b.filter(t=>lines.rows.includes(t.row)||lines.cols.includes(t.col));}
    if(tile.special==='bomb')return b.filter(t=>Math.abs(t.row-tile.row)<=1&&Math.abs(t.col-tile.col)<=1);
    return [tile];
  }
  mostCommon(){const counts=[0,0,0,0,0];for(const t of this.state.tiles)if(!t.locked&&!t.packet)counts[t.type]++;return counts.indexOf(Math.max(...counts));}
  fusion(a:GridTile,b:GridTile) {
    const board=this.state.tiles;
    if(a.special==='overload'||b.special==='overload') {
      const core=a.special==='overload'?a:b,other=core===a?b:a;
      if(other.special==='overload')return board;
      const active=board.filter(t=>t.special!=='none'&&!t.locked&&!t.packet&&t!==core);
      const color=board.filter(t=>t.type===other.type&&!t.packet);
      if(other.special!=='none')for(const t of color)if(t.special==='none'&&!t.locked)t.special=other.special;
      core.special='none';
      return [...new Set([...color,core,...active])];
    }
    if((a.special==='bomb'&&b.special.startsWith('line'))||(b.special==='bomb'&&a.special.startsWith('line')))return board.filter(t=>Math.abs(t.row-b.row)<=1||Math.abs(t.col-b.col)<=1);
    if(a.special==='bomb'&&b.special==='bomb')return board.filter(t=>Math.abs(t.row-b.row)<=2&&Math.abs(t.col-b.col)<=2);
    if(a.special==='lineCross'||b.special==='lineCross')return [...new Set([...this.area(a),...this.area(b)])];
    return board.filter(t=>t.row===a.row||t.col===a.col||t.row===b.row||t.col===b.col);
  }
  clear(targets:GridTile[], creations:ReturnType<typeof findBoardMatches>['specialCreations'],combo:number,purgeAll=false):Frame {
    const board=this.state.tiles;
    for(const t of board){t.x=t.targetX;t.y=t.targetY;}
    const specials:GridTile[]=[],hazards:GridTile[]=[],created:GridTile[]=[];
    const ids=new Set(targets.filter(t=>!t.packet).map(t=>t.id));
    // Chain reactions visit each existing special once, including converted overload lasers.
    const visited=new Set<string>();
    for(let changed=true;changed;) {changed=false;for(const t of board)if(ids.has(t.id)&&t.special!=='none'&&!t.locked&&!t.packet&&!visited.has(t.id)) {
      visited.add(t.id);for(const hit of this.area(t))if(!hit.packet&&!ids.has(hit.id)){ids.add(hit.id);changed=true;}
      specials.push(structuredClone(t));
    }}
    const removed=board.filter(t=>ids.has(t.id)&&!t.locked&&!t.packet);
    let hazardPoints=0;
    for(const t of board.filter(t=>t.locked)) {
      const adjacent=removed.some(x=>Math.abs(x.row-t.row)+Math.abs(x.col-t.col)===1);
      if(!adjacent&&!ids.has(t.id))continue;
      hazards.push(structuredClone(t));
      if(t.vault) {
        this.state.progress.vault=purgeAll?this.state.mission.target:this.state.progress.vault+1;
        if(this.state.progress.vault<this.state.mission.target)continue;
      } else t.lockHealth--;
      if(t.vault||t.lockHealth<=0){t.locked=false;t.lockHealth=0;t.obstacleType='none';t.vault=false;t.bossLock=false;this.state.progress.hazards++;hazardPoints+=250;}
    }
    this.state.progress.tokens+=removed.filter(t=>t.type===this.state.mission.color).length;
    const points=Math.round(removed.length*100*Math.min(5,1+0.5*(combo-1)))+hazardPoints;
    this.state.score+=points;
    const frame:Frame={tiles:structuredClone(board.map(t=>({...t,scale:removed.includes(t)?0:1}))),cleared:removed.map(t=>t.id),points,combo,effect:'match',specials,hazards,created};
    const next=board.filter(t=>!removed.includes(t));
    for(const s of creations) {
      if(next.some(t=>t.row===s.row&&t.col===s.col))continue;
      const t=this.tile(s.row,s.col,s.type);t.special=s.special;next.push(t);this.state.progress.specials++;
      created.push(structuredClone(t));
    }
    this.state.tiles=this.gravity(next);
    frame.settled=structuredClone(this.state.tiles);
    return frame;
  }
  action(action:Action):{accepted:boolean; spendsMove:boolean; frames:Frame[];bonusMoves?:number} {
    for(const t of this.state.tiles){t.x=t.targetX;t.y=t.targetY;}
    const frames:Frame[]=[];let targets:GridTile[]=[];let spendsMove=action.kind!=='booster';
    const a=action.kind==='swap'?this.at(action.from):action.at?this.at(action.at):undefined;
    const partner=action.kind==='swap'?this.at(action.to):undefined;
    const specialNames=[a?.special,partner?.special];
    const naturalSwap=action.kind==='swap'&&a?.special==='none'&&partner?.special==='none';
    let matchedLines=0;
    const actionEffect:Frame['effect']=action.kind==='booster'?(action.booster==='emp_bomb'?'emp':action.booster==='line_laser'?'laser':action.booster==='glitch_wipe'?'purge':'inject'):
      specialNames.includes('overload')?'overload':specialNames.includes('bomb')?'emp':specialNames.some(s=>s?.startsWith('line'))?'laser':'match';
    if(action.kind==='swap') {
      const b=this.at(action.to);if(!a||!b||a.locked||b.locked||Math.abs(a.row-b.row)+Math.abs(a.col-b.col)!==1)return {accepted:false,spendsMove:false,frames};
      this.state.turn++;this.state.progress.swaps++;
      if(a.special!=='none'&&b.special!=='none')targets=this.fusion(a,b);
      else if(a.special==='overload'||b.special==='overload')targets=this.fusion(a,b);
      else {
        [a.row,b.row]=[b.row,a.row];[a.col,b.col]=[b.col,a.col];this.normalize(this.state.tiles);
        frames.push({tiles:structuredClone(this.state.tiles),cleared:[],points:0,combo:0,effect:'swap'});
        if(!findBoardMatches(this.state.tiles,this.rows,this.cols).matchedIds.length){[a.row,b.row]=[b.row,a.row];[a.col,b.col]=[b.col,a.col];this.normalize(this.state.tiles);frames.push({tiles:structuredClone(this.state.tiles),cleared:[],points:0,combo:0,effect:'invalid'});}
      }
    } else if(action.kind==='special') {
      if(!a||a.locked||a.packet||a.special==='none')return {accepted:false,spendsMove:false,frames};
      this.state.turn++;targets=this.area(a);
    } else {
      if(action.booster==='overclock_moves')return {accepted:false,spendsMove:false,frames};
      if(action.booster==='glitch_wipe'){targets=this.state.tiles.filter(t=>t.locked);if(!targets.length)return {accepted:false,spendsMove:false,frames};}
      else if(!a)return {accepted:false,spendsMove:false,frames};
      else if(action.booster==='overload_core'){if(a.locked||a.packet||a.vault)return {accepted:false,spendsMove:false,frames};a.special='overload';this.state.progress.boosters++;frames.push({tiles:structuredClone(this.state.tiles),cleared:[],points:0,combo:0,effect:'inject',created:[structuredClone(a)]});return {accepted:true,spendsMove:false,frames};}
      else if(action.booster==='line_laser'){const lines=crossLines(a!.row,a!.col,this.rows,this.cols);targets=this.state.tiles.filter(t=>lines.rows.includes(t.row)||lines.cols.includes(t.col));}
      else targets=this.state.tiles.filter(t=>Math.abs(t.row-a!.row)<=1&&Math.abs(t.col-a!.col)<=1);
      // Purge clears both layers but still records the hazard objective.
      if(action.booster==='glitch_wipe')for(const t of targets)t.lockHealth=1;
      this.state.progress.boosters++;
    }
    for(let combo=1;combo<=50;combo++) {
      const match=findBoardMatches(this.state.tiles,this.rows,this.cols);
      if(!targets.length&&!match.matchedIds.length)break;
      if(!targets.length&&naturalSwap)matchedLines+=match.lineCount;
      const frame=this.clear(targets.length?targets:this.state.tiles.filter(t=>match.matchedIds.includes(t.id)),targets.length?[]:match.specialCreations,combo,action.kind==='booster'&&action.booster==='glitch_wipe');
      if(combo===1)frame.effect=actionEffect;frames.push(frame);targets=[];
    }
    // Bound pathological cascades and always finish with a settled, playable board.
    if(findBoardMatches(this.state.tiles,this.rows,this.cols).matchedIds.length||!hasBoardMove(this.state.tiles,this.rows,this.cols))this.state.tiles=recoverBoard(this.state.tiles,this.rows,this.cols,this.random);
    if(spendsMove&&this.state.mission.boss&&this.state.turn%4===0&&!this.complete()) {
      for(const t of this.state.tiles)if(t.bossLock){t.locked=false;t.lockHealth=0;t.obstacleType='none';t.bossLock=false;}
      const row=this.bossRow();
      for(const t of this.state.tiles)if(t.row===row&&!t.packet&&!t.vault&&!t.locked){t.locked=true;t.lockHealth=1;t.obstacleType='lock';t.bossLock=true;}
      this.state.tiles=recoverBoard(this.state.tiles,this.rows,this.cols,this.random);
      frames.push({tiles:structuredClone(this.state.tiles),cleared:[],points:0,combo:0,effect:'boss',message:`Security core locked row ${row+1}. Match beside it to breach.`});
    }
    this.normalize(this.state.tiles);
    const bonusMoves=naturalSwap&&matchedLines>=3?5:0;
    if(bonusMoves&&frames.length){const last=frames[frames.length-1];last.message=[last.message,'+5 MOVES · THREE-LINE COMBO'].filter(Boolean).join(' · ');}
    return {accepted:true,spendsMove,frames,bonusMoves};
  }
  bossRow(){return (Math.floor(this.state.turn/4)+this.state.seed)%this.rows;}
  bossWarning(){return this.state.mission.boss?`Core action in ${4-this.state.turn%4} moves · locks row ${(Math.floor((this.state.turn+4-this.state.turn%4)/4)+this.state.seed)%this.rows+1} · vault is the weak point`:'';}
  legalMoves():Action[] {
    const moves:Action[]=[];
    for(const t of this.state.tiles) {
      if(t.locked)continue;
      if(t.special!=='none')moves.push({kind:'special',at:[t.row,t.col]});
      for(const [dr,dc] of [[0,1],[1,0]]) {
        const b=this.at([t.row+dr,t.col+dc]);if(!b||b.locked)continue;
        if(t.special==='overload'||b.special==='overload'||(t.special!=='none'&&b.special!=='none')){moves.push({kind:'swap',from:[t.row,t.col],to:[b.row,b.col]});continue;}
        const copy=this.state.tiles.map(x=>({...x}));const a2=copy.find(x=>x.id===t.id)!,b2=copy.find(x=>x.id===b.id)!;
        [a2.row,b2.row]=[b2.row,a2.row];[a2.col,b2.col]=[b2.col,a2.col];
        if(findBoardMatches(copy,this.rows,this.cols).matchedIds.length)moves.push({kind:'swap',from:[t.row,t.col],to:[b.row,b.col]});
      }
    }return moves;
  }
  hint(){return this.legalMoves()[0];}
}

export function validSnapshot(x:unknown,tiles:GridTile[]):x is Snapshot {
  const s=x as Snapshot;
  return !!s&&s.version===1&&(s.legacyScore===undefined||typeof s.legacyScore==='boolean')&&[s.seed,s.rng,s.serial,s.turn,s.tutorial].every(v=>Number.isSafeInteger(v)&&v>=0)&&s.seed<=0xffffffff&&s.rng<=0xffffffff&&s.tutorial<=3&&Number.isFinite(s.score)&&s.score>=0&&!!s.progress&&
    Object.keys(emptyProgress()).every(k=>Number.isSafeInteger(s.progress[k as keyof Progress])&&s.progress[k as keyof Progress]>=0)&&
    !!s.mission&&['score','tokens','hazards','packets','vault'].includes(s.mission.kind)&&Number.isFinite(s.mission.target)&&s.mission.target>0&&s.mission.color>=0&&s.mission.color<=4&&Array.isArray(s.tiles)&&s.tiles.length===tiles.length&&s.tiles.every((t,i)=>t.id===tiles[i].id&&t.row===tiles[i].row&&t.col===tiles[i].col);
}
