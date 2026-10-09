import {test,expect,type Page} from '@playwright/test';
import {board} from '../fixtures';
import {boardCameraDistance} from '../../game/camera';

async function setup(page:Page,flat=false){
  const tiles=board();tiles[0].type=0;tiles[1].type=1;tiles[2].type=0;tiles[9].type=0;
  await page.addInitScript(({tiles,flat})=>{
    localStorage.setItem('cyber_casino_settings_v5',JSON.stringify({sfxMuted:true,bgmMuted:true}));
    localStorage.setItem('cyber_casino_camera_mode','top-down');
    if(!localStorage.getItem('cyber_casino_save_v5'))localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:1,score:0,levelScore:0,moves:22,tiles,timestamp:Date.now()}));
    if(flat){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:any,...args:any[]){return type==='webgl2'?null:(original as any).call(this,type,...args)} as any;}
  },{tiles,flat});
  await page.route('https://storage.googleapis.com/**',r=>r.abort());await page.goto('/');
}
async function settings(page:Page){await page.getByRole('button',{name:'Settings and View'}).click();return page.getByLabel('Game resolution');}
async function fits(page:Page){
  await expect.poll(()=>page.evaluate(()=>Array.from(document.querySelectorAll('.booster-tray button,.hud-actions button')).every(e=>{const r=e.getBoundingClientRect();return r.x>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&r.height>=44}))).toBe(true);
  const canvas=page.locator('.matrix-stage canvas');
  if(await canvas.count())await expect.poll(async()=>{const value=await canvas.getAttribute('data-board-corners');return value?Math.max(...JSON.parse(value).flat().map(Math.abs)):10}).toBeLessThanOrEqual(1);
}

test('4K standard resolution scales the menu, persists alternatives and supports real raycast input',async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width:3840,height:2160});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);
  const shell=page.locator('.game-shell');await expect(shell).toHaveAttribute('data-resolution','1080p');
  await expect.poll(()=>shell.evaluate(e=>e.clientWidth)).toBe(1920);
  const menu=page.getByRole('main',{name:'Cyber Casino main menu'});await expect(menu).toBeVisible();
  const menuWidth=(await page.locator('.main-menu-content > div').boundingBox())!.width;expect(menuWidth).toBeGreaterThan(700);expect(menuWidth).toBeLessThan(1200);
  await expect(page.locator('.main-menu-scene canvas')).toHaveAttribute('data-ring-depth','-0.6');
  const menuCanvas=(await page.locator('.main-menu-scene canvas').boundingBox())!;expect(menuCanvas.x).toBeCloseTo(0);expect(menuCanvas.y).toBeCloseTo(0);expect(menuCanvas.width).toBeCloseTo(3840);expect(menuCanvas.height).toBeCloseTo(2160);
  await page.screenshot({path:`test-results/v2-4k-menu-${test.info().project.name}.png`});
  await page.getByRole('button',{name:/CONTINUE HEIST/}).click();await expect(page.getByTestId('game-board')).toHaveAttribute('data-busy','false');await fits(page);
  await expect(page.locator('.matrix-stage canvas')).toHaveAttribute('data-ring-depth','-0.6');
  await page.waitForTimeout(1200);
  const rect=(await page.locator('.matrix-stage canvas').boundingBox())!,distance=Math.max(13.5,boardCameraDistance(8,8,rect.width/rect.height,48)),visibleHeight=2*distance*Math.tan(48*Math.PI/360);
  const point=(row:number,col:number)=>({x:rect.x+rect.width/2+(col-3.5)*1.15*rect.height/visibleHeight,y:rect.y+rect.height/2-(3.5-row)*1.15*rect.height/visibleHeight});
  let p=point(1,1);await page.mouse.click(p.x,p.y);await expect(page.getByTestId('game-board')).toHaveAttribute('data-selected','1,1');p=point(0,1);await page.mouse.click(p.x,p.y);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!).moves)).toBe(21);await expect(page.getByTestId('game-board')).toHaveAttribute('data-busy','false');
  await page.screenshot({path:`test-results/v2-4k-board-${test.info().project.name}.png`});
  let select=await settings(page);await expect(select).toHaveValue('1080p');await select.selectOption('720p');await expect.poll(()=>shell.evaluate(e=>e.clientWidth)).toBe(1280);
  await page.getByRole('button',{name:'Close settings'}).click();await page.reload();await expect(shell).toHaveAttribute('data-resolution','720p');await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
  select=await settings(page);await select.selectOption('native');await expect.poll(()=>shell.evaluate(e=>e.clientWidth)).toBe(3840);await select.selectOption('1080p');await expect.poll(()=>shell.evaluate(e=>e.clientWidth)).toBe(1920);await page.getByRole('button',{name:'Close settings'}).click();await fits(page);expect(errors).toEqual([]);
});

test('small-screen and landscape layouts keep readable controls and native fallback input',async({page})=>{
  await page.setViewportSize({width:320,height:568});await setup(page,true);await page.getByRole('button',{name:/CONTINUE HEIST/}).click();await expect(page.getByTestId('flat-board').locator('button')).toHaveCount(64);await fits(page);
  await page.getByRole('button',{name:'Row 2 column 2: Diamond',exact:true}).click();await expect(page.getByTestId('game-board')).toHaveAttribute('data-selected','1,1');await page.getByRole('button',{name:'Row 1 column 2: Chip',exact:true}).click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!).moves)).toBe(21);
  await page.setViewportSize({width:844,height:390});await fits(page);const select=await settings(page);await select.selectOption('720p');await page.getByRole('button',{name:'Close settings'}).click();await fits(page);
  const flat=(await page.getByTestId('flat-board').boundingBox())!;expect(flat.x).toBeGreaterThanOrEqual(0);expect(flat.x+flat.width).toBeLessThanOrEqual(844);
  await page.screenshot({path:`test-results/v2-landscape-${test.info().project.name}.png`});
});
