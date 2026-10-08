import {describe, expect, it} from 'vitest';
import {parseBoosters, parseSavedGame} from '../game/persistence';
import type {CyberDistrict} from '../types';
import {board} from './fixtures';

const district = (level: number) => ({targetScore: level * 3500, moves: 22} as CyberDistrict);
const save = () => ({level: 1, score: 1000, levelScore: 1000, moves: 20, tiles: board(), timestamp: 123});
const parse = (value: unknown) => parseSavedGame(JSON.stringify(value), 8, 8, district);
describe('save validation', () => {
  it('restores a valid settled board', () => expect(parse(save())).toEqual(save()));
  it('accepts a next-level checkpoint without tiles', () => {
    expect(parse({...save(), level: 2, levelScore: 0, tiles: null})?.level).toBe(2);
  });
  it('migrates a legacy winning save without awarding more rewards', () => {
    const data = parse({...save(), score: 4000, levelScore: 4000});
    expect(data).toMatchObject({level: 2, score: 4000, levelScore: 0, moves: 22, tiles: null});
  });
  it.each([null, {}, {level: -1}, {moves: 0}, {moves: 1.5}, {score: '1000'},
    {levelScore: 2000}, {tiles: []}, {tiles: null}])('rejects invalid data %j', override => {
    expect(parse(override === null || Object.keys(override).length === 0 ? override : {...save(), ...override})).toBeNull();
  });
  it('rejects a duplicate grid position', () => {
    const data = save(); data.tiles[1].row = data.tiles[0].row; data.tiles[1].col = data.tiles[0].col;
    expect(parse(data)).toBeNull();
  });
  it('rejects transient matched tiles', () => {
    const data = save(); data.tiles[0].matched = true; expect(parse(data)).toBeNull();
  });
  it('rejects malformed JSON', () => expect(parseSavedGame('{',8,8,district)).toBeNull());
});
describe('booster inventory validation', () => {
  const defaults = {emp_bomb:2,line_laser:2,overload_core:1,overclock_moves:2,glitch_wipe:1};
  it('preserves zero stock and valid counts', () => expect(parseBoosters('{"emp_bomb":0,"glitch_wipe":3}', defaults))
    .toEqual({...defaults, emp_bomb:0, glitch_wipe:3}));
  it('replaces negative and fractional counts', () => expect(parseBoosters('{"emp_bomb":-5,"glitch_wipe":1.5}',defaults)).toEqual(defaults));
});
