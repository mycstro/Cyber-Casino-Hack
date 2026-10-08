import {test,expect,type Page} from '@playwright/test';
import {board as fixtureBoard} from '../fixtures';

async function start(page:Page,flat=false) {
  const tiles=fixtureBoard();tiles[0].type=0;tiles[1].type=1;tiles[2].type=0;tiles[9].type=0;
  await page.addInitScript(({tiles,flat})=>{
    localStorage.setItem('cyber_casino_settings_v5',JSON.stringify({sfxMuted:true,bgmMuted:true}));
    localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:1,score:0,levelScore:0,moves:22,tiles,timestamp:Date.now()}));
    if(flat){const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:any,...args:any[]){return type==='webgl2'?null:(getContext as any).call(this,type,...args);} as any;}
  },{tiles,flat});
  await page.route('https://storage.googleapis.com/**',r=>r.abort());await page.goto('/');
  await expect(page.getByRole('main',{name:'Cyber Casino main menu'})).toBeVisible();
  await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
  await expect(page.getByTestId('game-board')).toHaveAttribute('data-busy','false');
  await expect(page.locator('.matrix-stage canvas, [data-testid="flat-board"]')).toBeVisible();
}
async function layout(page:Page) {
  // Mobile viewport metadata, media queries and ResizeObserver settle on the next frames after rotation.
  await expect.poll(()=>page.evaluate(()=>Array.from(document.querySelectorAll('.booster-tray button,.hud-actions button')).every(e=>{const r=e.getBoundingClientRect();return r.x>=-1&&r.right<=innerWidth+1;}))).toBe(true);
  const sizes=await page.evaluate(()=>{
    const rect=(selector:string)=>{const r=document.querySelector(selector)!.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    return {width:innerWidth,height:innerHeight,hud:rect('.game-hud'),stage:rect('.matrix-stage'),dock:rect('.booster-tray'),buttons:Array.from(document.querySelectorAll('.booster-tray button,.hud-actions button')).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height,width:r.width};})};
  });
  expect(sizes.stage.width).toBeGreaterThan(0);expect(sizes.stage.height).toBeGreaterThan(90);
  expect(sizes.hud.right).toBeLessThanOrEqual(sizes.width+1);expect(sizes.dock.bottom).toBeLessThanOrEqual(sizes.height+1);
  for(const r of sizes.buttons){expect(r.x).toBeGreaterThanOrEqual(-1);expect(r.right).toBeLessThanOrEqual(sizes.width+1);expect(r.height).toBeGreaterThanOrEqual(44);}
  const canvas=page.locator('.matrix-stage canvas');
  if(await canvas.count())await expect.poll(async()=>{
    const data=await canvas.getAttribute('data-board-corners');return data?Math.max(...(JSON.parse(data) as number[][]).flat().map(Math.abs)):10;
  }).toBeLessThanOrEqual(1);
  else {const r=(await page.getByTestId('flat-board').boundingBox())!;expect(r.width).toBeLessThanOrEqual(sizes.stage.width);expect(r.height).toBeLessThanOrEqual(sizes.stage.height);}
}

test('menu, controls, board, settings and live rotation fit the viewport',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);await layout(page);
  await page.screenshot({path:`test-results/responsive-${test.info().project.name}.png`});
  await page.getByRole('button',{name:'Settings and View'}).click();
  await page.getByLabel('Graphics quality').selectOption('high');
  await page.locator('.settings-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);
  await expect(page.getByRole('button',{name:'Close settings'})).toBeVisible();await page.getByRole('button',{name:'Close settings'}).click();
  const initial=page.viewportSize()!;await page.setViewportSize({width:initial.height,height:initial.width});await layout(page);
  await page.setViewportSize(initial);await layout(page);
  const board=page.getByTestId('game-board');await board.focus();await board.press('ArrowDown');await board.press('ArrowRight');await board.press('Shift+ArrowUp');
  await expect(board).toHaveAttribute('data-busy','false');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!).moves)).toBe(21);
  expect(errors).toEqual([]);
});

test('GPU-free fallback keeps all tiles, touch selection, animations and progress',async({page})=>{
  await start(page,true);await expect(page.getByTestId('flat-board').locator('button')).toHaveCount(64);await layout(page);
  const board=page.getByTestId('game-board');
  const from=page.getByRole('button',{name:'Row 2 column 2: Diamond',exact:true}),to=page.getByRole('button',{name:'Row 1 column 2: Chip',exact:true});
  if(test.info().project.use.hasTouch)await from.tap();else await from.click();
  await expect(board).toHaveAttribute('data-selected','1,1');
  if(test.info().project.use.hasTouch)await to.tap();else await to.click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!).moves)).toBe(21);
  await expect(board).toHaveAttribute('data-busy','false');
  await expect(page.getByTestId('flat-board').locator('button')).toHaveCount(64);
  const grid=(await page.getByTestId('flat-board').boundingBox())!,retry=(await page.getByRole('button',{name:'Retry 3D visuals'}).boundingBox())!;
  expect(grid.y+grid.height).toBeLessThanOrEqual(retry.y);expect(retry.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:`test-results/fallback-${test.info().project.name}.png`});
});
