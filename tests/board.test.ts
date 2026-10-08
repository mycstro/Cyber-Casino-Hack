import {describe, expect, it} from 'vitest';
import {findBoardMatches, hasBoardMove, recoverBoard} from '../game/board';
import {createSeededRandom} from '../utils';
import {board, paint} from './fixtures';

const match = (tiles: ReturnType<typeof board>) => findBoardMatches(tiles, 8, 8);
describe('matching and special creation', () => {
  it('does not match the stable baseline', () => expect(match(board()).matchedIds).toEqual([]));
  it('matches a run ending at the right edge', () => {
    const result = match(paint(board(), [[0,5],[0,6],[0,7]], 0));
    expect(result.matchedIds).toHaveLength(3);
    expect(result.specialCreations).toEqual([]);
  });
  it('matches a run ending at the bottom edge', () => {
    expect(match(paint(board(), [[5,0],[6,0],[7,0]], 0)).matchedIds).toHaveLength(3);
  });
  it.each(['horizontal', 'vertical'])('a single four-piece %s line does not create a reward-only booster', direction => {
    const positions = Array.from({length: 4}, (_, i) => direction === 'horizontal' ? [0,i] : [i,0]);
    const result = match(paint(board(), positions, 0));
    expect(result.specialCreations).toEqual([]);expect(result.lineCount).toBe(1);
  });
  it('keeps Overload reward-only even for a five-piece line', () => {
    const result = match(paint(board(), [[0,0],[0,1],[0,2],[0,3],[0,4]]));
    expect(result.specialCreations).toEqual([]);
  });
  it.each([
    [[0,0],[0,1],[0,2],[1,0],[2,0]],
    [[0,0],[0,1],[0,2],[1,1],[2,1]],
    [[0,1],[1,1],[2,0],[2,1],[2,2],[2,3],[3,1]],
  ])('creates one Cross Laser for two intersecting lines', (...positions) => {
    // Each parameterized row supplies positions as separate arguments.
    const result = match(paint(board(), positions as number[][]));
    expect(result.specialCreations).toHaveLength(1);
    expect(result.specialCreations[0].special).toBe('lineCross');
    expect(new Set(result.matchedIds).size).toBe(result.matchedIds.length);
  });
  it('a locked tile interrupts a match', () => {
    const tiles = paint(board(), [[0,0],[0,1],[0,2]]);
    tiles[1].locked = true;
    expect(match(tiles).matchedIds).toEqual([]);
  });
  it('keeps independent runs independent', () => {
    const tiles = paint(board(), [[0,0],[0,1],[0,2],[0,3],[7,4],[7,5],[7,6],[7,7]]);
    expect(match(tiles).specialCreations).toHaveLength(1);expect(match(tiles).specialCreations[0].special).toBe('lineCross');expect(match(tiles).lineCount).toBe(2);
  });
});

describe('deadlock recovery', () => {
  it('recognizes the former fallback as unplayable', () => expect(hasBoardMove(board(), 8, 8)).toBe(false));
  it('recognizes a clickable special even without a swap', () => {
    const tiles = board(); tiles[0].special = 'bomb';
    expect(hasBoardMove(tiles, 8, 8)).toBe(true);
  });
  it.each([6,8,10])('recovers stable playable %sx%s boards across 30 seeds', size => {
    const original = board(size, size);
    original.find(t => t.row === 3 && t.col === 3)!.locked = true;
    for (let seed = 0; seed < 30; seed++) {
      const fixed = recoverBoard(original, size, size, createSeededRandom(seed));
      expect(findBoardMatches(fixed, size, size).matchedIds).toEqual([]);
      expect(hasBoardMove(fixed, size, size)).toBe(true);
      expect(fixed.map(t => t.id)).toEqual(original.map(t => t.id));
      expect(fixed.find(t => t.row === 3 && t.col === 3)!.locked).toBe(true);
    }
  });
  it('guarantees a move even when randomness repeatedly fails', () => {
    const fixed = recoverBoard(board(), 8, 8, () => 0);
    expect(match(fixed).matchedIds).toEqual([]);
    expect(hasBoardMove(fixed, 8, 8)).toBe(true);
  });
});
