import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameRun} from '../game/run';

describe('gameplay asynchronous lifecycle', () => {
  beforeEach(() => vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'performance']}));
  afterEach(() => vi.useRealTimers());
  it('completes an active animation wait', async () => {
    const run = new GameRun(); const wait = run.wait(200);
    await vi.advanceTimersByTimeAsync(200);
    expect(await wait).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('freezes elapsed gameplay time while paused and resumes the remaining time', async () => {
    const run = new GameRun(); let complete = false;
    const wait = run.wait(200).then(ok => {complete = ok;});
    await vi.advanceTimersByTimeAsync(100);
    run.paused = true;
    await vi.advanceTimersByTimeAsync(3000);
    expect(complete).toBe(false);
    run.paused = false;
    await vi.advanceTimersByTimeAsync(100);
    await wait;
    expect(complete).toBe(true);
  });
  it('prevents an old cascade from crediting a new game after disposal', async () => {
    const run = new GameRun(); let score = 0;
    const cascade = (async () => {if (!await run.wait(200)) return; score += 1000;})();
    await vi.advanceTimersByTimeAsync(100);
    run.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    await cascade;
    expect(score).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels every pending wait, including paused work', async () => {
    const run = new GameRun(); run.paused = true;
    const waits = [run.wait(10), run.wait(200), run.wait(500)];
    run.dispose();
    expect(await Promise.all(waits)).toEqual([false,false,false]);
    expect(await run.wait(50)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
