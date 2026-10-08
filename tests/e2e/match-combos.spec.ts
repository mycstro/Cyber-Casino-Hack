import {test,expect,type Page} from '@playwright/test';
import {HeistEngine} from '../../game/engine';
import {comboBoard} from '../fixtures';
test.beforeEach(async({page})=>{await page.route('https://storage.googleapis.com/**',r=>r.abort());await page.addInitScript(()=>{localStorage.setItem('cyber_casino_settings_v5',JSON.stringify({sfxMuted:true,bgmMuted:true}));localStorage.setItem('cyber_casino_camera_mode','top-down');});await page.goto('/');});
async function prepare(page:Page,lines:number,fallback=false){
  const e=new HeistEngine(3,123);e.state.tiles=comboBoard(lines);const snapshot=e.snapshot();
  if(fallback)await page.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:any,...args:any[]){return ['webgl','webgl2'].includes(type)?null:old.call(this,type,...args);} as typeof old;});
  await page.evaluate(snapshot=>localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:3,score:0,levelScore:0,moves:22,tiles:snapshot.tiles,snapshot,timestamp:Date.now()})),snapshot);await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
  const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-busy','false');await board.focus();for(let i=0;i<3;i++){await board.press('ArrowDown');await board.press('ArrowRight');}await board.press('Shift+ArrowRight');await expect(board).toHaveAttribute('data-busy','false');return board;
}
test('two matched lines create a visible double-cross piece that can fire without inventory consumption',async({page})=>{
  const before=await page.evaluate(()=>localStorage.getItem('cyber_casino_boosters_v5'));const board=await prepare(page,2);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!)),cross=saved.snapshot.tiles.find((t:any)=>t.special==='lineCross');expect(cross).toBeTruthy();expect(saved.snapshot.progress.boosters).toBe(0);expect(saved.snapshot.tiles.some((t:any)=>t.special==='bomb'||t.special==='overload')).toBe(false);
  await page.screenshot({path:`test-results/match-cross-${test.info().project.name}.png`});
  // A reload preserves the earned piece and locates it through the keyboard readout.
  await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();await expect(board).toHaveAttribute('data-busy','false');await board.focus();for(let r=0;r<cross.row;r++)await board.press('ArrowDown');for(let c=0;c<cross.col;c++)await board.press('ArrowRight');await expect(page.locator('.keyboard-readout')).toContainText('Cross Laser');await board.press('Enter');await board.press('Enter');await expect(board).toHaveAttribute('data-feedback','laser');await expect.poll(async()=>Number(await board.getAttribute('data-beams'))).toBeGreaterThanOrEqual(4);await expect(board).toHaveAttribute('data-busy','false');expect(await page.evaluate(()=>localStorage.getItem('cyber_casino_boosters_v5'))).toBe(before);
});
test('three matched lines add five moves exactly once and remain booster-free across reload',async({page})=>{
  const board=await prepare(page,3);await expect(page.locator('.board-message')).toContainText('+5 MOVES');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!));expect(saved.moves).toBe(26);expect(saved.snapshot.turn).toBe(1);expect(saved.snapshot.progress.boosters).toBe(0);expect(saved.snapshot.tiles.some((t:any)=>t.special==='bomb'||t.special==='overload')).toBe(false);
  await page.screenshot({path:`test-results/match-moves-${test.info().project.name}.png`});await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();await expect(board).toHaveAttribute('data-turn','1');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!).moves)).toBe(26);
});
test('the match-created Cross Laser has a distinct GPU-free shape and works with native touch',async({page})=>{
  await prepare(page,2,true);await expect(page.getByTestId('flat-board')).toBeVisible();const cross=page.getByRole('button',{name:/Cross Laser/});await expect(cross).toHaveCount(1);await expect(cross.locator('.special-lineCross')).toBeVisible();
  if(test.info().project.use.hasTouch){await cross.tap();await cross.tap();}else{await cross.click();await cross.click();}await expect(page.getByTestId('game-board')).toHaveAttribute('data-feedback','laser');await expect(page.getByTestId('game-board')).toHaveAttribute('data-busy','false');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!).snapshot.progress.boosters)).toBe(0);
});
