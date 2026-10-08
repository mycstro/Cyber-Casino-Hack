import type {GridTile} from '../types';

export function board(rows = 8, cols = 8): GridTile[] {
  return Array.from({length: rows * cols}, (_, i) => {
    const row = Math.floor(i / cols), col = i % cols;
    const x = (col - (cols - 1) / 2) * 1.15, y = ((rows - 1) / 2 - row) * 1.15;
    return {id: `tile-${row}-${col}`, row, col, type: (row + col) % 5, special: 'none',
      locked: false, lockHealth: 0, obstacleType: 'none', matched: false, x, y,
      targetX: x, targetY: y, scale: 1, rotationY: 0};
  });
}

export function paint(tiles: GridTile[], positions: number[][], type = 4) {
  for (const [row, col] of positions) tiles.find(t => t.row === row && t.col === col)!.type = type;
  return tiles;
}
/** A settled board where swapping R4 C4 right clears two lines, or three with the added vertical diamond line. */
export function comboBoard(lines=2){const tiles=board();paint(tiles,[[3,3],[3,5],[3,6]],0);paint(tiles,[[3,7]],2);paint(tiles,[[3,4],[2,3],[4,3]],1);if(lines===3)paint(tiles,[[2,4],[4,4]],0);return tiles;}
