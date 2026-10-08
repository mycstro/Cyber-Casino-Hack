import {test,expect,type Page} from '@playwright/test';
import {HeistEngine} from '../../game/engine';
import {board as fixtureBoard} from '../fixtures';
import {slotPrize} from '../../game/bonus';
import {completionExperience} from '../../game/experience';
test.beforeEach(async({page})=>{await page.route('https://storage.googleapis.com/**',r=>r.abort());await page.addInitScript(()=>{localStorage.setItem('cyber_casino_settings_v5',JSON.stringify({sfxMuted:true,bgmMuted:true}));localStorage.setItem('cyber_casino_camera_mode','top-down');});await page.goto('/');});
const inventory=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!));
test('a milestone spin shows three matched boosters, reloads mid-spin without duplicate payment and advances once',async({page})=>{
  const e=new HeistEngine(10,123);e.state.tiles=fixtureBoard();e.state.progress.vault=e.state.mission.target-1;Object.assign(e.at([4,4])!,{locked:true,vault:true,lockHealth:2,obstacleType:'plasma_shield'});const snapshot=e.snapshot();
  await page.evaluate(snapshot=>localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:10,score:0,levelScore:0,moves:27,tiles:snapshot.tiles,snapshot,timestamp:Date.now()})),snapshot);await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
  const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-busy','false');await page.getByRole('button',{name:/EMP BLAST/}).click();await board.focus();for(let i=0;i<3;i++){await board.press('ArrowDown');await board.press('ArrowRight');}await board.press('Enter');
  await expect(page.getByTestId('completion-loot')).toContainText('Overload');await expect(page.getByTestId('completion-xp')).toContainText('1.00×');
  await page.getByRole('button',{name:'PLAY BONUS SLOT ROUND'}).click();const round=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_bonus_v1')!)),before=await inventory(page),prize=slotPrize(round.booster);
  const spin=page.getByRole('button',{name:'SPIN FREE BONUS'});const box=(await spin.boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(44);await spin.click();
  const paid={...before,[round.booster]:before[round.booster]+prize.amount};expect(await inventory(page)).toEqual(paid);await expect(page.getByRole('button',{name:'SPINNING…'})).toBeDisabled();await page.reload();
  await expect(page.getByTestId('bonus-round')).toHaveAttribute('data-phase','won');await expect(page.locator('.slot-reel')).toHaveCount(3);for(const reel of await page.locator('.slot-reel').all())await expect(reel).toHaveAttribute('data-booster',round.booster);
  await expect(page.locator('.slot-result')).toContainText(`+${prize.amount} ${prize.name}`);expect(await inventory(page)).toEqual(paid);await page.screenshot({path:`test-results/bonus-won-${test.info().project.name}.png`});
  await page.getByRole('button',{name:'CONTINUE TO LEVEL 11'}).click();await expect(page.getByTestId('game-board')).toHaveAttribute('data-theme','quantum');expect(await page.evaluate(()=>localStorage.getItem('cyber_casino_bonus_v1'))).toBeNull();await page.reload();expect(await inventory(page)).toEqual(paid);await expect(page.getByTestId('bonus-round')).toHaveCount(0);
});
test('booster-free XP counts accepted moves and persists, while injected moves remove its multiplier after reload',async({page})=>{
  for(const boosted of [false,true]){
    const e=new HeistEngine(1,101,8,8,undefined,1);e.state.tutorial=0;e.state.score=3400;e.state.turn=7;const snapshot=e.snapshot();
    await page.evaluate(snapshot=>localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:1,score:3400,levelScore:3400,moves:15,tiles:snapshot.tiles,snapshot,timestamp:Date.now()})),snapshot);await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
    if(boosted){await page.getByRole('button',{name:/\+5 MOVES/}).click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!).snapshot.progress.boosters)).toBe(1);await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();}
    const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_career_v1')!).xp);const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-busy','false');await board.focus();await board.press('ArrowDown');await board.press('ArrowRight');await board.press('Enter');await board.press('ArrowUp');await board.press('Enter');
    const xp=completionExperience(1,8,boosted?1:0);await expect(page.getByTestId('completion-xp')).toContainText(`+${xp.total} XP`);await expect(page.getByTestId('completion-xp')).toContainText(`${xp.multiplier.toFixed(2)}×`);await expect(page.getByTestId('completion-xp')).toContainText('8 moves taken');
    const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_career_v1')!).xp);expect(after).toBe(before+xp.total);await page.screenshot({path:`test-results/xp-${boosted?'base':'clean'}-${test.info().project.name}.png`});await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_career_v1')!).xp)).toBe(after);
  }
});
