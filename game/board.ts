import type {GridTile, TileSpecial} from '../types';

export interface SpecialCreation {row: number; col: number; type: number; special: TileSpecial}

/** Every straight matched run counts as a line. Two lines earn one Cross Laser; reward-only boosters have no recipe. */
export function findBoardMatches(board: GridTile[], rows: number, cols: number) {
  const cells = new Map(board.map(t => [`${t.row},${t.col}`, t]));
  const runs: GridTile[][] = [];
  for (const horizontal of [true, false]) {
    const outer = horizontal ? rows : cols;
    const inner = horizontal ? cols : rows;
    for (let a = 0; a < outer; a++) {
      let run: GridTile[] = [];
      for (let b = 0; b <= inner; b++) {
        const t = cells.get(horizontal ? `${a},${b}` : `${b},${a}`);
        if (!t || t.locked || t.packet || (run.length && run[0].type !== t.type)) {
          if (run.length >= 3) runs.push(run);
          run = [];
        }
        if (t && !t.locked && !t.packet) run.push(t);
      }
    }
  }
  const matchedIds = [...new Set(runs.flat().map(t => t.id))];
  const specialCreations: SpecialCreation[] = [];
  if(runs.length===2){
    const intersection=runs[0].find(t=>runs[1].some(x=>x.id===t.id));
    const tile=intersection??runs[0][Math.floor((runs[0].length-1)/2)];
    specialCreations.push({row:tile.row,col:tile.col,type:tile.type,special:'lineCross'});
  }
  return {matchedIds, specialCreations,lineCount:runs.length};
}

export function crossLines(row:number,col:number,rows:number,cols:number){return {rows:[row,row===rows-1?row-1:row+1],cols:[col,col===cols-1?col-1:col+1]};}

export function hasBoardMove(board: GridTile[], rows: number, cols: number): boolean {
  if (board.some(t => !t.locked && t.special !== 'none')) return true;
  for (const t of board) {
    if (t.locked) continue;
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const other = board.find(x => x.row === t.row + dr && x.col === t.col + dc && !x.locked);
      if (!other) continue;
      const swapped = board.map(x => x.id === t.id ? {...x, row: other.row, col: other.col}
        : x.id === other.id ? {...x, row: t.row, col: t.col} : x);
      if (findBoardMatches(swapped, rows, cols).matchedIds.length) return true;
    }
  }
  return false;
}

/** Outer rows are reserved for a guaranteed move if random recovery fails. */
export function recoverBoard(board: GridTile[], rows: number, cols: number, random = Math.random): GridTile[] {
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = board.map(t => t.locked ? {...t} : {...t, type: Math.floor(random() * 5)});
    if (!findBoardMatches(candidate, rows, cols).matchedIds.length && hasBoardMove(candidate, rows, cols)) return candidate;
  }
  const candidate = board.map(t => ({...t, type: (t.row + t.col) % 5}));
  const motif = new Map([['0,0', 0], ['0,1', 1], ['0,2', 0], ['1,1', 0]]);
  for (const t of candidate) {
    const type = motif.get(`${t.row},${t.col}`);
    if (type !== undefined) Object.assign(t, {type, locked: false, lockHealth: 0, obstacleType: 'none'});
  }
  return candidate;
}
