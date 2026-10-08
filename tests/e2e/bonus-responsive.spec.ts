import {test,expect} from '@playwright/test';
test('milestone slots fit the screen, scroll safely, accept pointer input and retain the paid reward',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://storage.googleapis.com/**',r=>r.abort());
  await page.addInitScript(()=>{
    // This UI and its rewards must also work without a GPU.
    const context=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:any,...args:any[]){return type==='webgl'||type==='webgl2'?null:context.call(this,type,...args);} as typeof context;
    localStorage.setItem('cyber_casino_settings_v5',JSON.stringify({sfxMuted:true,bgmMuted:true}));localStorage.setItem('cyber_casino_preferences_v1',JSON.stringify({quality:'low',reducedMotion:true}));
    if(!localStorage.getItem('slot_fixture_seeded')){localStorage.setItem('slot_fixture_seeded','true');localStorage.setItem('cyber_casino_bonus_v1',JSON.stringify({id:'responsive-milestone',level:10,booster:'overload_core',claimed:false,applied:false}));localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:11,score:5000,levelScore:0,moves:23,tiles:null,timestamp:Date.now()}));}
  });
  await page.goto('/');const machine=page.getByTestId('bonus-round');await expect(machine).toBeVisible();
  await expect.poll(()=>machine.evaluate(e=>e.contains(document.activeElement))).toBe(true);await page.keyboard.press('Tab');await expect.poll(()=>machine.evaluate(e=>e.contains(document.activeElement))).toBe(true);
  const spin=page.getByRole('button',{name:'SPIN FREE BONUS'});await spin.scrollIntoViewIfNeeded();const r=(await spin.boundingBox())!,v=page.viewportSize()!;expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(v.width);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(v.height);
  if(test.info().project.use.hasTouch)await spin.tap();else await spin.click();await expect(machine).toHaveAttribute('data-phase','won');await expect(page.locator('.slot-result')).toContainText('+1 Overload Cores');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!).overload_core)).toBe(2);
  for(const reel of await page.locator('.slot-reel').all()){const b=(await reel.boundingBox())!;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(v.width);await expect(reel).toHaveAttribute('data-booster','overload_core');}
  expect(await page.locator('.bonus-overlay').evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
  await page.reload();await expect(machine).toHaveAttribute('data-phase','won');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!).overload_core)).toBe(2);
  const next=page.getByRole('button',{name:'CONTINUE TO LEVEL 11'});await next.scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/slot-responsive-${test.info().project.name}.png`});if(test.info().project.use.hasTouch)await next.tap();else await next.click();
  await expect(page.getByTestId('flat-board')).toBeVisible();await expect(page.getByTestId('game-board')).toHaveAttribute('data-theme','quantum');expect(errors).toEqual([]);
});
