import {test,expect,type Page} from '@playwright/test';
import {HeistEngine} from '../../game/engine';
import {getDistrictForLevel} from '../../game/campaign';
import {board as fixtureBoard} from '../fixtures';
import {slotPrize} from '../../game/bonus';
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('cyber_casino_settings_v5',JSON.stringify({sfxMuted:true,bgmMuted:true}));localStorage.setItem('cyber_casino_camera_mode','top-down');});
  await page.route('https://storage.googleapis.com/**',r=>r.abort());await page.goto('/');
});
async function blast(page:Page){
  await page.getByRole('button',{name:/CONTINUE HEIST/}).click();const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-busy','false');
  await page.getByRole('button',{name:/EMP BLAST/}).click();await board.focus();for(let i=0;i<3;i++){await board.press('ArrowDown');await board.press('ArrowRight');}await board.press('Enter');
  await expect(page.getByRole('heading',{name:'FIREWALL BREACHED!'})).toBeVisible();return board;
}
async function inventory(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!));}
async function finishSlot(page:Page){await page.getByRole('button',{name:'SPIN FREE BONUS'}).click();await page.getByRole('button',{name:/CONTINUE TO LEVEL/}).click();}
test('first completion and replay both display and credit loot, while reload cannot pay twice',async({page})=>{
  const tiles=fixtureBoard();
  for(let run=0;run<2;run++){
    const before=await inventory(page);
    await page.evaluate(tiles=>localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:1,score:3400,levelScore:3400,moves:22,tiles,timestamp:Date.now()})),tiles);await page.reload();await blast(page);
    const loot=page.getByTestId('completion-loot');await loot.scrollIntoViewIfNeeded();await expect(loot).toBeVisible();await expect(loot).toContainText('EMP Blast');await expect(loot).toContainText('+5 Moves');
    const after=await inventory(page);expect(after.emp_bomb).toBe(before.emp_bomb);expect(after.overclock_moves).toBe(before.overclock_moves+1);
    await expect(page.getByTestId('completion-stars')).toBeVisible();await page.screenshot({path:`test-results/rewards-${run?'replay':'first'}-${test.info().project.name}.png`});
    await page.reload();expect(await inventory(page)).toEqual(after);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!).level)).toBe(2);
  }
});
test('tenth-level victory shows full boss loot and immediately replaces the rendered environment',async({page})=>{
  const e=new HeistEngine(10,123);e.state.tiles=fixtureBoard();e.state.progress.vault=e.state.mission.target-1;Object.assign(e.at([4,4])!,{locked:true,vault:true,lockHealth:2,obstacleType:'plasma_shield'});const snapshot=e.snapshot();
  const before=await inventory(page);await page.evaluate(snapshot=>localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:10,score:0,levelScore:0,moves:22,tiles:snapshot.tiles,snapshot,timestamp:Date.now()})),snapshot);await page.reload();
  const board=await blast(page);await expect(board).toHaveAttribute('data-theme','quantum');await expect(page.locator('.matrix-stage canvas')).toHaveAttribute('data-environment','environment-quantum');
  const loot=page.getByTestId('completion-loot');
  for(const name of ['EMP Blast','+5 Moves','Dual Laser','Overload','Purge Wipe']){const row=loot.locator('.grid>div').filter({hasText:name});await row.scrollIntoViewIfNeeded();await expect(row).toBeVisible();}
  const after=await inventory(page);expect(after).toEqual({...before,emp_bomb:before.emp_bomb+1,overclock_moves:before.overclock_moves+2,line_laser:before.line_laser+2,overload_core:before.overload_core+1,glitch_wipe:before.glitch_wipe+1});
  const card=page.getByRole('dialog',{name:'Level completion and rewards'});const r=(await card.boundingBox())!,v=page.viewportSize()!;expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(v.height);
  await page.screenshot({path:`test-results/rewards-boss-${test.info().project.name}.png`});
  await page.reload();await expect(page.getByTestId('bonus-round')).toHaveAttribute('data-phase','ready');expect(await inventory(page)).toEqual(after);
  const b=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_bonus_v1')!));await finishSlot(page);await expect(page.getByTestId('game-board')).toHaveAttribute('data-theme','quantum');expect(await inventory(page)).toEqual({...after,[b.booster]:after[b.booster]+slotPrize(b.booster).amount});
  await page.screenshot({path:`test-results/chapter-transition-${test.info().project.name}.png`});
});
test('every tenth completed level changes the actual rendered environment through a full cycle',async({page})=>{
  test.setTimeout(180000);const tiles=fixtureBoard();
  for(const [level,theme] of [[10,'quantum'],[20,'lotus'],[30,'ai'],[40,'singularity'],[50,'horizons'],[60,'neon']] as const){
    await test.step(`Clear level ${level} and enter ${theme}`,async()=>{
      const score=getDistrictForLevel(level).targetScore-100;
      await page.evaluate(({level,score,tiles})=>localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level,score,levelScore:score,moves:22,tiles,timestamp:Date.now()})),{level,score,tiles});await page.reload();
      await page.getByRole('button',{name:/CONTINUE HEIST/}).click();const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-busy','false');
      await page.getByRole('button',{name:/EMP BLAST/}).click();await board.focus();await board.press('Enter');
      await expect(page.getByRole('dialog',{name:'Level completion and rewards'})).toBeVisible();await expect(board).toHaveAttribute('data-theme',theme);
      await expect(page.locator('.matrix-stage canvas')).toHaveAttribute('data-environment',`environment-${theme}`);await expect(page.getByTestId('completion-loot')).toContainText('EMP Blast');
      await page.screenshot({path:`test-results/completed-${level}-${test.info().project.name}.png`});
      await page.getByRole('button',{name:'PLAY BONUS SLOT ROUND'}).click();await finishSlot(page);
    });
  }
});
