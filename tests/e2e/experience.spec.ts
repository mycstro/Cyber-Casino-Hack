import {test,expect} from '@playwright/test';
import {HeistEngine} from '../../game/engine';
import {board as fixtureBoard} from '../fixtures';

test.beforeEach(async({page})=>{
  await page.route('https://storage.googleapis.com/**',r=>r.abort());
  await page.addInitScript(()=>{
    localStorage.setItem('cyber_casino_settings_v5',JSON.stringify({sfxMuted:false,bgmMuted:true,sfxVolume:.7}));
    localStorage.setItem('cyber_casino_camera_mode','top-down');
    (window as any).__tones=[];
    const scheduled=new WeakMap<AudioParam,number>(),set=AudioParam.prototype.setValueAtTime;
    AudioParam.prototype.setValueAtTime=function(value,time){scheduled.set(this,value);return set.call(this,value,time);};
    const start=OscillatorNode.prototype.start;
    OscillatorNode.prototype.start=function(...args){(window as any).__tones.push({wave:this.type,freq:scheduled.get(this.frequency)??this.frequency.value});return start.apply(this,args);};
  });
});

test('chapter boundaries change rendered scenery and action timbre without losing scene objects',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const tones:{wave:string;freq:number}[]=[];
  for(const [level,theme,motion] of [[10,'neon','traffic'],[11,'quantum','orbits'],[21,'lotus','petals'],[31,'ai','streams'],[41,'singularity','vortex'],[51,'horizons','aurora'],[61,'neon','traffic']] as const){
    await page.goto('/');
    await page.evaluate(level=>localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level,score:0,levelScore:0,moves:22,tiles:null,timestamp:Date.now()})),level);
    await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
    const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-theme',theme);await expect(board).toHaveAttribute('data-motion',motion);
    await expect(board).toHaveAttribute('data-scene-elements','city,hacker,sentinel,holograms,floor');
    await expect(page.locator('.matrix-stage canvas')).toHaveAttribute('data-environment',`environment-${theme}`);
    await page.evaluate(()=>(window as any).__tones=[]);await page.getByRole('button',{name:'HINT',exact:true}).click();
    const trace=await page.evaluate(()=>(window as any).__tones as {wave:string;freq:number}[]);expect(trace.length).toBeGreaterThan(0);
    expect(trace[0].wave).toBe({neon:'sine',quantum:'sine',lotus:'triangle',ai:'sawtooth',singularity:'sine',horizons:'triangle'}[theme]);
    if(level===10||level===11)tones.push(trace[0]);
    if(level===11||level===21)await page.screenshot({path:`test-results/chapter-${theme}-${test.info().project.name}.png`});
  }
  // Both click profiles use sine; the boundary changes pitch by 25% (with 5% variation).
  expect(tones[1].freq/tones[0].freq).toBeGreaterThan(1.12);expect(tones[1].freq/tones[0].freq).toBeLessThan(1.4);expect(errors).toEqual([]);
});

test('a first breach wins a piece set, equips it and persists it across reloads',async({page})=>{
  const e=new HeistEngine(5,123);e.state.tiles=fixtureBoard();e.state.progress.vault=e.state.mission.target-1;
  Object.assign(e.at([4,4])!,{locked:true,vault:true,lockHealth:2,obstacleType:'plasma_shield'});const snapshot=e.snapshot();
  await page.goto('/');await page.evaluate(snapshot=>{
    localStorage.setItem('cyber_casino_career_v1',JSON.stringify({unlocked:5,stars:{1:1,2:1,3:1,4:1},best:{},achievements:[],cosmetic:'neon'}));
    localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:5,score:0,levelScore:0,moves:22,tiles:snapshot.tiles,snapshot,timestamp:Date.now()}));
  },snapshot);await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
  const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-busy','false');
  await page.getByRole('button',{name:/EMP BLAST/}).click();await board.focus();for(let i=0;i<3;i++){await board.press('ArrowDown');await board.press('ArrowRight');}await board.press('Enter');
  await expect(page.getByTestId('piece-reward')).toContainText('Prismatic Gems');await page.getByRole('button',{name:'EQUIP NEW PIECES'}).click();
  await page.getByRole('button',{name:'BREACH LEVEL 6',exact:true}).click();await expect(board).toHaveAttribute('data-pieces','gems');
  await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();await expect(page.getByTestId('game-board')).toHaveAttribute('data-pieces','gems');
  await page.screenshot({path:`test-results/pieces-gems-${test.info().project.name}.png`});
  await page.getByRole('button',{name:'Game Menu'}).click();await page.getByRole('button',{name:'SAVE & QUIT TO MAIN MENU'}).click();
  await page.getByRole('button',{name:'CAMPAIGN MAP & DAILY HEIST'}).click();await page.getByRole('button',{name:'COSMETICS',exact:true}).click();
  await expect(page.getByRole('button',{name:'Prismatic Gems pieces',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'Arcade Blocks pieces',exact:true})).toBeDisabled();
});

test('all collectible sets work with native touch training and the GPU-free board',async({page})=>{
  await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:any,...args:any[]){return type==='webgl2'?null:(get as any).call(this,type,...args);} as any;});
  await page.goto('/');await page.getByRole('button',{name:'HACKER TRAINING',exact:true}).click();
  const guide=page.getByTestId('training-guide'),board=page.getByTestId('game-board');await expect(guide).toContainText('1 · Select');
  const from=page.getByRole('button',{name:'Row 2 column 2: Diamond',exact:true}),to=page.getByRole('button',{name:'Row 1 column 2: Chip',exact:true});
  if(test.info().project.use.hasTouch)await from.tap();else await from.click();await expect(guide).toContainText('2 · Now select');
  await page.screenshot({path:`test-results/training-${test.info().project.name}.png`});
  if(test.info().project.use.hasTouch)await to.tap();else await to.click();await expect(page.getByText('LESSON 1 COMPLETE',{exact:true})).toBeVisible();
  for(const style of ['classic','gems','arcade','relics']){
    await page.evaluate(style=>{
      localStorage.setItem('cyber_casino_career_v1',JSON.stringify({unlocked:21,stars:Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,1])),best:{},achievements:[],cosmetic:'neon',pieceStyle:style}));
      localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:21,score:0,levelScore:0,moves:22,tiles:null,timestamp:Date.now()}));
    },style);await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();await expect(board).toHaveAttribute('data-pieces',style);
    await expect(page.getByTestId('flat-board')).toHaveClass(new RegExp(`pieces-${style}`));await expect(page.getByTestId('flat-board').locator('button')).toHaveCount(64);
    await expect(page.locator('.chapter-fallback')).toHaveClass(/motion-petals/);
    await page.screenshot({path:`test-results/flat-pieces-${style}-${test.info().project.name}.png`});
  }
});

test('new 3D piece collections retain special auras at every graphics quality',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const tiles=fixtureBoard();
  tiles[0].special='lineH';tiles[1].special='bomb';tiles[2].special='overload';tiles[3].special='lineCross';
  await page.goto('/');
  for(const style of ['gems','arcade','relics']){
    await page.evaluate(({style,tiles})=>{
      localStorage.setItem('cyber_casino_career_v1',JSON.stringify({unlocked:21,stars:Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,1])),best:{},achievements:[],cosmetic:'neon',pieceStyle:style}));
      localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:21,score:0,levelScore:0,moves:22,tiles,timestamp:Date.now()}));
    },{style,tiles});await page.reload();await page.getByRole('button',{name:/CONTINUE HEIST/}).click();
    const board=page.getByTestId('game-board');await expect(board).toHaveAttribute('data-pieces',style);
    for(const quality of ['low','medium','high']){
      await page.getByRole('button',{name:'Settings and View'}).click();await page.getByLabel('Graphics quality').selectOption(quality);await page.getByRole('button',{name:'Close settings'}).click();
      await expect(board).toHaveAttribute('data-scene-elements','city,hacker,sentinel,holograms,floor');await expect(page.locator('.matrix-stage canvas')).toBeVisible();
      await page.screenshot({path:`test-results/pieces-${style}-${quality}-${test.info().project.name}.png`});
    }
  }
  expect(errors).toEqual([]);
});
