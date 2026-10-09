import {test,expect} from '@playwright/test';
import {board as fixtureBoard} from '../fixtures';
import {HeistEngine} from '../../game/engine';

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('cyber_casino_settings_v5',JSON.stringify({sfxMuted:true,bgmMuted:true,sfxVolume:.7,bgmVolume:.4}));
    localStorage.setItem('cyber_casino_camera_mode','top-down');
  });
  await page.route('https://storage.googleapis.com/**',r=>r.abort());
  await page.goto('/');
});
test('campaign map shows objectives, locked nodes and cosmetic requirements',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'CAMPAIGN MAP & DAILY HEIST'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button',{name:/SUBNET 1 .*Score/i})).toBeEnabled();
  await expect(page.getByRole('button',{name:/SUBNET 2 .*Collect/i})).toBeDisabled();
  await page.screenshot({path:`test-results/campaign-${test.info().project.name}.png`});
  await page.getByRole('button',{name:'COSMETICS',exact:true}).click();
  await expect(page.getByRole('button',{name:/Golden Ghost/})).toBeDisabled();
  await page.screenshot({path:`test-results/hub-${test.info().project.name}.png`});
  expect(errors).toEqual([]);
});
test('opening interactive lessons complete and continue beyond lesson three',async({page})=>{
  await page.getByRole('button',{name:'HACKER TRAINING',exact:true}).click();
  await page.getByRole('button',{name:'START GUIDED TRAINING'}).click();
  for(let lesson=1;lesson<=3;lesson++) {
    const board=page.getByTestId('game-board');await expect(board).toBeVisible();
    await expect(page.getByTestId('training-guide')).toContainText('Practice mistakes cost no moves');
    await expect(board).toHaveAttribute('data-hint','0,1;1,1');
    await expect(page.locator('canvas')).toBeVisible();
    await board.focus();await board.press('Shift+ArrowRight');await expect(board).toHaveAttribute('data-turn','0');
    await expect(page.locator('.board-message')).toContainText('No move was spent');
    // Wrong practice attempts do not change focus back automatically.
    await board.press('ArrowLeft');
    await board.focus();await board.press('ArrowDown');await board.press('ArrowRight');await board.press('Shift+ArrowUp');
    await expect(page.getByText(`LESSON ${lesson} COMPLETE`,{exact:true})).toBeVisible();
    await expect(page.locator('.lesson-result')).toBeVisible();
    await page.getByRole('button',{name:`NEXT LESSON ${lesson+1}`}).click();
  }
  await expect(page.getByTestId('training-guide')).toContainText('LESSON 4/22');
  const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_training_v2')!));
  expect(progress.completedLessons).toBe(3);
});
test('daily has a fixed seed and inventory and preserves the campaign save',async({page})=>{
  await page.getByRole('button',{name:/INITIALIZE HACK/}).click();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('cyber_casino_save_v5'))).not.toBeNull();
  await page.getByRole('button',{name:'Game Menu'}).click();await page.getByRole('button',{name:'SAVE & QUIT TO MAIN MENU'}).click();
  const before=await page.evaluate(()=>({save:localStorage.getItem('cyber_casino_save_v5'),boosters:localStorage.getItem('cyber_casino_boosters_v5')}));
  const launch=async()=>{await page.getByRole('button',{name:'CAMPAIGN MAP & DAILY HEIST'}).click();await page.getByRole('button',{name:'DAILY',exact:true}).click();await page.getByRole('button',{name:'START DAILY CHALLENGE'}).click();await expect(page.getByTestId('game-board')).toBeVisible();};
  await launch();const seed=await page.getByTestId('game-board').getAttribute('data-seed');
  await expect(page.getByRole('button',{name:/OVERLOAD/i})).toBeDisabled();
  await page.getByRole('button',{name:'Game Menu'}).click();await page.getByRole('button',{name:'SAVE & QUIT TO MAIN MENU'}).click();
  await launch();expect(await page.getByTestId('game-board').getAttribute('data-seed')).toBe(seed);
  const after=await page.evaluate(()=>({save:localStorage.getItem('cyber_casino_save_v5'),boosters:localStorage.getItem('cyber_casino_boosters_v5')}));expect(after).toEqual(before);
});
test('graphics and accessibility preferences survive reload',async({page})=>{
  await page.getByRole('button',{name:'SETTINGS',exact:true}).click();
  await page.getByLabel('Graphics quality').selectOption('low');
  await page.getByLabel('Reduce motion and flashes').check();
  await expect(page.getByLabel('Token symbols')).toHaveCount(0);
  await page.reload();await page.getByRole('button',{name:'SETTINGS',exact:true}).click();
  await expect(page.getByLabel('Graphics quality')).toHaveValue('low');
  await expect(page.getByLabel('Reduce motion and flashes')).toBeChecked();
  await expect(page.getByLabel('Token symbols')).toHaveCount(0);
});
test('adjacent laser and bomb can be selected and combined on the actual board',async({page})=>{
  const tiles=fixtureBoard();tiles.find(t=>t.row===3&&t.col===3)!.special='lineH';tiles.find(t=>t.row===3&&t.col===4)!.special='bomb';
  await page.addInitScript(tiles=>localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:1,score:0,levelScore:0,moves:22,tiles,timestamp:Date.now()})),tiles);
  await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
  const board=page.getByTestId('game-board');await expect(board).toBeVisible();await expect(page.locator('canvas')).toBeVisible();await board.focus();
  for(let i=0;i<3;i++){await board.press('ArrowDown');await board.press('ArrowRight');}
  await board.press('Enter');await expect(board).toHaveAttribute('data-selected','3,3');
  await board.press('ArrowRight');await board.press('Enter');
  await expect(page.getByRole('heading',{name:'FIREWALL BREACHED!'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!).level)).toBe(2);
});
test('unlocked cosmetic outfit and high-quality city render without browser errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    localStorage.setItem('cyber_casino_career_v1',JSON.stringify({unlocked:6,stars:{1:3,2:3,3:3,4:3,5:3},best:{},achievements:[],cosmetic:'gold'}));
    localStorage.setItem('cyber_casino_preferences_v1',JSON.stringify({quality:'high',symbols:true,reducedMotion:false}));
  });
  await page.reload();await page.getByRole('button',{name:/INITIALIZE HACK/}).click();
  await expect(page.locator('canvas')).toBeVisible();await expect(page.getByTestId('game-board')).toHaveAttribute('data-busy','false');
  await page.waitForTimeout(1000);await page.screenshot({path:`test-results/city-${test.info().project.name}.png`});
  expect(errors).toEqual([]);
});
for(const [level,kind] of [[2,'tokens'],[3,'hazards'],[4,'packets'],[5,'vault']] as const) {
  test(`${kind} objective completes from a resumed mission in the browser`,async({page})=>{
    const e=new HeistEngine(level,123);e.state.tiles=fixtureBoard();
    e.state.progress[kind]=e.state.mission.target-1;
    let row=3,col=3;
    if(kind==='hazards'){const t=e.at([3,3])!;t.locked=true;t.lockHealth=1;t.obstacleType='ice';}
    if(kind==='packets'){e.at([6,2])!.packet=true;row=7;col=2;}
    if(kind==='vault'){const t=e.at([4,4])!;t.locked=true;t.vault=true;t.lockHealth=2;t.obstacleType='plasma_shield';}
    const snapshot=e.snapshot();
    await page.addInitScript(({level,snapshot})=>localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level,score:0,levelScore:0,moves:22,tiles:snapshot.tiles,snapshot,timestamp:Date.now()})),{level,snapshot});
    await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
    const board=page.getByTestId('game-board');await expect(board).toBeVisible();await expect(page.locator('canvas')).toBeVisible();
    await page.getByRole('button',{name:/EMP BLAST/}).click();await board.focus();
    for(let r=0;r<row;r++)await board.press('ArrowDown');for(let c=0;c<col;c++)await board.press('ArrowRight');await board.press('Enter');
    await expect(page.getByRole('heading',{name:'FIREWALL BREACHED!'})).toBeVisible();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!).level)).toBe(level+1);
  });
}

test('main menu has a full-screen city background on entry and return',async({page})=>{
  await expect(page.getByRole('main',{name:'Cyber Casino main menu'})).toBeVisible();
  await expect(page.locator('.main-menu-background canvas')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({path:`test-results/menu-restored-${test.info().project.name}.png`});
  await page.getByRole('button',{name:/INITIALIZE HACK/}).click();
  await expect(page.getByTestId('game-board')).toHaveAttribute('data-busy','false');
  await page.getByRole('button',{name:'Game Menu'}).click();
  await page.getByRole('button',{name:'SAVE & QUIT TO MAIN MENU'}).click();
  await expect(page.locator('.main-menu-background canvas')).toBeVisible();
});

test('all graphics presets retain every scene element and settings closes with X',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:/INITIALIZE HACK/}).click();
  const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-busy','false');
  for(const quality of ['low','medium','high']) {
    await page.getByRole('button',{name:'Game Menu'}).click();
    await page.getByRole('button',{name:'SETTINGS & VIEW OPTIONS',exact:true}).click();
    await page.getByLabel('Graphics quality').selectOption(quality);
    await page.locator('.settings-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);
    await expect(page.getByRole('button',{name:'Close settings'})).toBeVisible();
    await expect(page.getByLabel('Token symbols')).toHaveCount(0);
    await page.getByRole('button',{name:'Close settings'}).click();
    await page.getByRole('button',{name:'RESUME HACK',exact:true}).click();
    await expect(board).toHaveAttribute('data-scene-elements','city,hacker,sentinel,holograms,floor');
    await expect(board).toHaveAttribute('data-turn','0');
    await page.screenshot({path:`test-results/quality-${quality}-${test.info().project.name}.png`});
  }
  expect(errors).toEqual([]);
});

test('EMP produces synthesized sound and animated explosion feedback',async({page})=>{
  await page.addInitScript(()=>{
    (window as any).__audioStarts=0;
    const original=OscillatorNode.prototype.start;
    OscillatorNode.prototype.start=function(...args:any[]){(window as any).__audioStarts++;return original.apply(this,args as [number?]);};
  });
  await page.reload();
  await page.getByRole('button',{name:'SETTINGS',exact:true}).click();
  await page.getByRole('button',{name:'Toggle sound effects'}).click();
  await page.getByRole('button',{name:'Close settings'}).click();
  await page.getByRole('button',{name:/INITIALIZE HACK/}).click();
  const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-busy','false');
  const before=await page.evaluate(()=>(window as any).__audioStarts);
  await page.getByRole('button',{name:/EMP BLAST/}).click();await board.focus();await board.press('Enter');
  await expect.poll(()=>board.getAttribute('data-feedback')).toBe('emp');
  await expect.poll(async()=>Number(await board.getAttribute('data-particles'))).toBeGreaterThan(0);
  await expect.poll(async()=>Number(await board.getAttribute('data-shockwaves'))).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>(window as any).__audioStarts)).toBeGreaterThan(before);
  await expect(board).toHaveAttribute('data-busy','false');
});

test('GPU context loss switches to a playable board and 3D retry keeps progress',async({page})=>{
  const tiles=fixtureBoard();tiles[0].type=0;tiles[1].type=1;tiles[2].type=0;tiles[9].type=0;
  await page.addInitScript(tiles=>localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:1,score:0,levelScore:0,moves:22,tiles,timestamp:Date.now()})),tiles);
  await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
  const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-busy','false');
  await page.locator('.matrix-stage canvas').evaluate((canvas:any)=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.getByTestId('flat-board')).toBeVisible();
  const from=page.getByRole('button',{name:'Row 2 column 2: Diamond',exact:true}),to=page.getByRole('button',{name:'Row 1 column 2: Chip',exact:true});
  if(test.info().project.use.hasTouch){await from.tap();await to.tap();}else{await from.click();await to.click();}
  await expect(board).toHaveAttribute('data-busy','false');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!).moves)).toBe(21);
  await page.getByRole('button',{name:'Retry 3D visuals'}).click();await expect(page.locator('.matrix-stage canvas')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_save_v5')!).moves)).toBe(21);
});

test('a hidden page suspends an in-flight move and resumes it safely',async({page})=>{
  await page.getByRole('button',{name:'HACKER TRAINING',exact:true}).click();
  await page.getByRole('button',{name:'START GUIDED TRAINING'}).click();
  const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-busy','false');
  await board.focus();await board.press('ArrowDown');await board.press('ArrowRight');await board.press('Shift+ArrowUp');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByRole('button',{name:'HINT',exact:true})).toBeDisabled();
  await page.waitForTimeout(700);await expect(board).toHaveAttribute('data-busy','true');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByText('LESSON 1 COMPLETE',{exact:true})).toBeVisible();
});

test('hints clear on input and cipher locks identify themselves with live hazard counts',async({page})=>{
  const tiles=fixtureBoard();
  tiles[0].type=0;tiles[1].type=1;tiles[2].type=0;tiles[9].type=0;
  for(const [row,col,kind] of [[1,5,'lock'],[6,3,'ice'],[3,4,'corrupted']] as const)Object.assign(tiles.find(t=>t.row===row&&t.col===col)!,{locked:true,lockHealth:1,obstacleType:kind});
  await page.addInitScript(tiles=>localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:1,score:0,levelScore:0,moves:22,tiles,timestamp:Date.now()})),tiles);
  await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
  const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-busy','false');
  await expect(page.getByText('CIPHER LOCK (1)',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'HINT',exact:true}).click();await expect(board).not.toHaveAttribute('data-hint','');
  await page.screenshot({path:`test-results/hint-softened-${test.info().project.name}.png`});
  await board.focus();await board.press('ArrowDown');for(let i=0;i<5;i++)await board.press('ArrowRight');await board.press('Enter');
  await expect(board).toHaveAttribute('data-hint','');
  await expect(page.locator('.board-message')).toContainText('CIPHER LOCK · Shield health 1');
  await page.screenshot({path:`test-results/lock-labelled-${test.info().project.name}.png`});
  await page.getByRole('button',{name:/PURGE HAZARD/}).click();await expect(board).toHaveAttribute('data-busy','false');
  await expect(page.getByText('CIPHER LOCK (1)',{exact:true})).toHaveCount(0);
  await expect(page.getByText('ICE (1)',{exact:true})).toHaveCount(0);
});
