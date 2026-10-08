import {mkdirSync,writeFileSync} from 'node:fs';
import {HeistEngine, type Action} from '../game/engine.ts';
import {getDistrictForLevel} from '../game/campaign.ts';
import {findBoardMatches} from '../game/board.ts';

const perLevel=Number(process.argv[2]||200);
if(!Number.isSafeInteger(perLevel)||perLevel<1||perLevel>10000)throw new Error('Use 1–10000 seeds per level.');
const levels=[1,2,3,4,5,6,10,22,33,44,55,60];
const report=[];
function choose(e:HeistEngine):Action|undefined {
  const options=e.legalMoves();
  const ranked=options.map(action=>{
    let hits=e.state.tiles;
    if(action.kind==='swap') {
      hits=e.state.tiles.map(t=>({...t}));const a=hits.find(t=>t.row===action.from[0]&&t.col===action.from[1])!,b=hits.find(t=>t.row===action.to[0]&&t.col===action.to[1])!;
      [a.row,b.row]=[b.row,a.row];[a.col,b.col]=[b.col,a.col];
      const ids=findBoardMatches(hits,e.rows,e.cols).matchedIds;hits=hits.filter(t=>ids.includes(t.id));
    }else if(action.kind==='special')hits=e.area(e.at(action.at)!);
    let rank=hits.length;
    if(e.state.mission.kind==='tokens')rank+=hits.filter(t=>t.type===e.state.mission.color).length*5;
    for(const t of e.state.tiles){
      if(t.locked&&(e.state.mission.kind==='hazards'||t.vault))rank+=hits.some(h=>Math.abs(h.row-t.row)+Math.abs(h.col-t.col)===1)?12:0;
      if(t.packet)rank+=hits.filter(h=>h.col===t.col&&h.row>t.row).length*8;
    }
    return {action,rank};
  });
  ranked.sort((a,b)=>b.rank-a.rank);return ranked[0]?.action;
}
for(const level of levels) {
  let wins=0,assisted=0,movesLeft=0,scores=0,used=0;
  for(let seed=1;seed<=perLevel;seed++) {
    const e=new HeistEngine(level,seed*9973);let moves=getDistrictForLevel(level).moves;let booster=false;
    while(moves>0&&!e.complete()) {
      const action=choose(e);if(!action)throw new Error(`Dead board: level ${level}, seed ${seed}`);
      const result=e.action(action);moves=moves-1+(result.bonusMoves||0);
      if(moves===5&&!e.complete()) {
        // One fixed EMP near the objective; report assisted wins separately.
        const target=e.state.tiles.find(t=>t.vault)||e.state.tiles.find(t=>t.locked)||e.state.tiles.find(t=>t.packet)||e.state.tiles[27];
        e.action({kind:'booster',booster:'emp_bomb',at:[target.row,target.col]});booster=true;used++;
      }
      if(e.state.tiles.length!==64||new Set(e.state.tiles.map(t=>`${t.row},${t.col}`)).size!==64)throw new Error('Board invariant failed');
    }
    scores+=e.state.score;
    if(e.complete()){wins++;movesLeft+=moves;if(booster)assisted++;}
  }
  const row={level,seeds:perLevel,completionRate:Number((wins/perLevel).toFixed(3)),unassistedWins:wins-assisted,assistedWins:assisted,
    meanMovesRemainingOnWin:wins?Number((movesLeft/wins).toFixed(2)):0,meanScore:Math.round(scores/perLevel),boosterUseRate:Number((used/perLevel).toFixed(3))};
  report.push(row);console.log(JSON.stringify(row));
}
mkdirSync('reports',{recursive:true});
writeFileSync('reports/balance.json',JSON.stringify({rulesVersion:3,seedCount:perLevel*levels.length,policy:'Greedy objective-aware legal moves; earned Cross Lasers and +5 match moves; one EMP if incomplete at five moves remaining. Bot results are not human completion rates.',levels:report},null,2)+'\n');
