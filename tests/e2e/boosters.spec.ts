import {test,expect} from '@playwright/test';
import {HeistEngine} from '../../game/engine';
import {board as fixtureBoard} from '../fixtures';
test.beforeEach(async({page})=>{await page.route('https://storage.googleapis.com/**',r=>r.abort());await page.addInitScript(()=>{localStorage.setItem('cyber_casino_settings_v5',JSON.stringify({sfxMuted:true,bgmMuted:true}));localStorage.setItem('cyber_casino_camera_mode','top-down');});await page.goto('/');});
test('overload activates distant bombs and lasers with visual effects and preserves toolbar inventory',async({page})=>{
  const e=new HeistEngine(3,123);e.state.tiles=fixtureBoard();e.at([0,0])!.special='overload';const positions=[[7,7,'bomb'],[6,5,'lineH'],[5,6,'lineV']] as const;
  for(const [r,c,s] of positions)e.at([r,c])!.special=s;const ids=positions.map(([r,c])=>e.at([r,c])!.id),snapshot=e.snapshot();
  await page.evaluate(snapshot=>localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:3,score:0,levelScore:0,moves:22,tiles:snapshot.tiles,snapshot,timestamp:Date.now()})),snapshot);await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
  const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-busy','false');const before=await page.evaluate(()=>localStorage.getItem('cyber_casino_boosters_v5'));await board.focus();await board.press('Enter');await board.press('Enter');
  await expect(board).toHaveAttribute('data-feedback','overload');await expect.poll(async()=>Number(await board.getAttribute('data-beams'))).toBeGreaterThan(0);await expect.poll(async()=>Number(await board.getAttribute('data-shockwaves'))).toBeGreaterThan(0);
  await expect(board).toHaveAttribute('data-busy','false');expect(await board.getAttribute('data-turn')).toBe('1');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!));expect(saved.snapshot.tiles.some((t:any)=>ids.includes(t.id))).toBe(false);expect(saved.snapshot.progress.boosters).toBe(0);expect(await page.evaluate(()=>localStorage.getItem('cyber_casino_boosters_v5'))).toBe(before);
});
test('Purge clears every hazard and both shield layers and keeps inventory when used on a clean board',async({page})=>{
  const e=new HeistEngine(1,123);e.state.tiles=fixtureBoard();const kinds=['ice','corrupted','lock','turret','plasma_shield','void'] as const;
  kinds.forEach((obstacleType,i)=>Object.assign(e.at([i,1])!,{locked:true,lockHealth:i>3?2:1,obstacleType,bossLock:i===2}));const snapshot=e.snapshot();
  await page.evaluate(snapshot=>localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:1,score:0,levelScore:0,moves:22,tiles:snapshot.tiles,snapshot,timestamp:Date.now()})),snapshot);await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
  const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-busy','false');const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!));
  await page.getByRole('button',{name:/PURGE HAZARD/}).click();await expect(board).toHaveAttribute('data-feedback','purge');await expect(board).toHaveAttribute('data-busy','false');
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!));expect(save.moves).toBe(22);expect(save.snapshot.progress.hazards).toBe(6);expect(save.snapshot.tiles.some((t:any)=>t.locked||t.bossLock||t.lockHealth>0)).toBe(false);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!).glitch_wipe)).toBe(before.glitch_wipe-1);
  await page.evaluate(()=>localStorage.setItem('cyber_casino_boosters_v5',JSON.stringify({...JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!),glitch_wipe:2})));await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();await expect(board).toHaveAttribute('data-busy','false');await page.getByRole('button',{name:/PURGE HAZARD/}).click();await expect(page.getByText('No hazards to purge. Booster kept.')).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!).glitch_wipe)).toBe(2);
});
