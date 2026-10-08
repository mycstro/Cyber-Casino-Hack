import {test, expect, type Page} from '@playwright/test';
import {board} from '../fixtures';
import {boardCameraDistance} from '../../game/camera';

const SAVE = 'cyber_casino_save_v5';
const BOOSTERS = 'cyber_casino_boosters_v5';

async function prepare(page: Page, options: {score?:number;levelScore?:number;moves?:number;hazard?:boolean} = {}) {
  const tiles = board();
  // A deterministic valid swap: move (1,1) into (0,1) to make three zeroes.
  tiles[0].type=0; tiles[1].type=1; tiles[2].type=0; tiles[9].type=0;
  if(options.hazard)Object.assign(tiles[54],{locked:true,lockHealth:2,obstacleType:'plasma_shield'});
  await page.addInitScript(({save, tiles, options}) => {
    localStorage.setItem('cyber_casino_settings_v5',JSON.stringify({sfxMuted:true,bgmMuted:true,sfxVolume:0.7,bgmVolume:0.4}));
    localStorage.setItem('cyber_casino_camera_mode','top-down');
    // Do not overwrite the checkpoint on subsequent reloads.
    if (!localStorage.getItem(save)) localStorage.setItem(save,JSON.stringify({
      level:1,score:0,levelScore:0,moves:22,tiles,timestamp:Date.now(),...options,
    }));
  },{save:SAVE,tiles,options});
  await page.route('https://storage.googleapis.com/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('button',{name:/CONTINUE HEIST/i}).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button',{name:/EMP BLAST/i})).toBeEnabled();
  // Let the animated camera converge before projecting tile coordinates.
  await page.waitForTimeout(1200);
}

async function point(page: Page, row: number, col: number) {
  const rect = (await page.locator('canvas').boundingBox())!;
  const aspect = rect.width/rect.height;
  const z = Math.max(13.5,boardCameraDistance(8,8,aspect,48));
  const visibleHeight=2*z*Math.tan(48*Math.PI/360);
  return {x:rect.x+rect.width/2+(col-3.5)*1.15*rect.height/visibleHeight,
    y:rect.y+rect.height/2-(3.5-row)*1.15*rect.height/visibleHeight};
}

async function swap(page: Page) {
  const from = await point(page,1,1), to = await point(page,0,1);
  await clickPoint(page,from);
  await expect(page.getByTestId('game-board')).toHaveAttribute('data-selected','1,1');
  await clickPoint(page,to);
}

async function clickPoint(page: Page, p: {x:number;y:number}) {
  if (test.info().project.name === 'mobile') await page.touchscreen.tap(p.x,p.y);
  else await page.mouse.click(p.x,p.y);
}

test('renders, makes a real swap, persists it, and resumes after reload', async ({page}) => {
  const errors: string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await prepare(page);
  for (const [row,col] of [[0,0],[0,7],[7,0],[7,7]]) {
    const p=await point(page,row,col), rect=(await page.locator('canvas').boundingBox())!;
    expect(p.x).toBeGreaterThan(rect.x); expect(p.x).toBeLessThan(rect.x+rect.width);
    expect(p.y).toBeGreaterThan(rect.y); expect(p.y).toBeLessThan(rect.y+rect.height);
  }
  await swap(page);
  await expect.poll(async()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).score,SAVE)).toBeGreaterThan(0);
  await expect(page.getByRole('button',{name:/EMP BLAST/i})).toBeEnabled();
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE);
  expect(saved.moves).toBe(21);
  expect(saved.tiles).toHaveLength(64);
  expect(new Set(saved.tiles.map((t:any)=>`${t.row},${t.col}`)).size).toBe(64);
  await page.reload();
  await page.getByRole('button',{name:/CONTINUE HEIST/i}).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('game-board')).toHaveAttribute('data-busy','false');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).score,SAVE)).toBe(saved.score);
  expect(errors).toEqual([]);
  await page.screenshot({path:`test-results/game-${test.info().project.name}.png`});
});

test('pauses a live cascade and prevents spending a busy booster', async ({page}) => {
  await prepare(page);
  await swap(page);
  await expect(page.getByRole('button',{name:/PURGE HAZARD/i})).toBeDisabled();
  const before=await page.evaluate(key=>localStorage.getItem(key),BOOSTERS);
  await page.getByRole('button',{name:'Game Menu'}).click();
  await expect(page.getByRole('button',{name:'RESUME TO FINISH CURRENT MOVE'})).toBeDisabled();
  const snapshot=await page.evaluate(key=>localStorage.getItem(key),SAVE);
  await page.waitForTimeout(800);
  expect(await page.evaluate(key=>localStorage.getItem(key),SAVE)).toBe(snapshot);
  expect(await page.evaluate(key=>localStorage.getItem(key),BOOSTERS)).toBe(before);
  await page.getByRole('button',{name:'RESUME HACK'}).click();
  await expect(page.getByRole('button',{name:/EMP BLAST/i})).toBeEnabled();
  await expect.poll(async()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).score,SAVE)).toBeGreaterThan(0);
});

test('restart cancels an active cascade', async ({page}) => {
  await prepare(page); await swap(page);
  await page.getByRole('button',{name:'Game Menu'}).click();
  await page.getByRole('button',{name:'RETRY LEVEL 1'}).click();
  await page.waitForTimeout(1000);
  const data=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE);
  expect(data).toMatchObject({level:1,score:0,levelScore:0,moves:22});
});

test('completion reloads into the next level without granting rewards twice', async ({page}) => {
  await prepare(page,{score:3400,levelScore:3400});
  await page.getByRole('button',{name:/EMP BLAST/i}).click();
  const p=await point(page,3,3); await clickPoint(page,p);
  await expect.poll(async()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).level,SAVE)).toBe(2);
  const inventory=await page.evaluate(key=>localStorage.getItem(key),BOOSTERS);
  await page.reload();
  await page.getByRole('button',{name:/CONTINUE HEIST \(LVL 2/i}).click();
  expect(await page.evaluate(key=>localStorage.getItem(key),BOOSTERS)).toBe(inventory);
});

test('rejects corrupt storage and still starts a new game', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('cyber_casino_save_v5','{"level":1,"score":0,"levelScore":0,"moves":22,"tiles":[]}');
    localStorage.setItem('cyber_casino_settings_v5','{"sfxMuted":true,"bgmMuted":true}');
  });
  await page.goto('/');
  await expect(page.getByRole('button',{name:/CONTINUE HEIST/i})).toHaveCount(0);
  await page.getByRole('button',{name:/INITIALIZE HACK/i}).click();
  await expect.poll(async()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).tiles.length,SAVE)).toBe(64);
});

test('accepted quantum purge consumes exactly one booster without consuming a move', async ({page}) => {
  await prepare(page,{hazard:true});
  const purge=page.getByRole('button',{name:/PURGE HAZARD/i});
  await purge.scrollIntoViewIfNeeded();
  await purge.click();
  await expect.poll(async()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).glitch_wipe,BOOSTERS)).toBe(0);
  await expect(page.getByTestId('game-board')).toHaveAttribute('data-busy','false');
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE);
  expect(saved.moves).toBe(22);
  expect(saved.score).toBeGreaterThan(0);
  expect(saved.tiles).toHaveLength(64);
});

test('running out of moves ends the game and clears its save', async ({page}) => {
  await prepare(page,{moves:1});
  await clickPoint(page,await point(page,7,6));
  await expect(page.getByTestId('game-board')).toHaveAttribute('data-selected','7,6');
  await clickPoint(page,await point(page,7,7));
  await expect(page.getByRole('heading',{name:'CONNECTION TRACED!'})).toBeVisible();
  expect(await page.evaluate(key=>localStorage.getItem(key),SAVE)).toBeNull();
});
