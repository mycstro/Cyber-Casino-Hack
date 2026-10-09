import {test,expect} from '@playwright/test';
import {LESSONS} from '../../game/training';
test('the complete training course teaches all lessons, records performance and preserves career inventory',async({page})=>{
  test.setTimeout(180000);
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:any,...args:any[]){return type==='webgl'||type==='webgl2'?null:(original as any).call(this,type,...args);} as any;
    localStorage.setItem('cyber_casino_settings_v5',JSON.stringify({sfxMuted:true,bgmMuted:true}));
    localStorage.setItem('cyber_casino_preferences_v1',JSON.stringify({quality:'low',reducedMotion:true}));
  });
  await page.route('https://storage.googleapis.com/**',r=>r.abort());await page.goto('/');
  await page.getByRole('button',{name:'HACKER TRAINING',exact:true}).click();
  await expect(page.locator('.academy-grid .mission-card')).toHaveCount(LESSONS.length);
  await page.locator('.academy-grid .mission-card').first().click();
  const inventory=await page.evaluate(()=>localStorage.getItem('cyber_casino_boosters_v5'));
  for(const [i,l]of LESSONS.entries()){
    await expect(page.getByTestId('training-guide')).toContainText(`LESSON ${i+1}/${LESSONS.length}`);
    if(l.kind==='overview')await page.getByRole('button',{name:'ACKNOWLEDGE & COMPLETE LESSON'}).click();
    else if(l.booster)await page.getByRole('button',{name:'PRACTICE BOOSTER'}).click();
    else {
      const a=l.action!;const click=async(p:number[])=>{const token=page.getByRole('button',{name:new RegExp(`^Row ${p[0]+1} column ${p[1]+1}:`)});if(test.info().project.use.hasTouch)await token.tap();else await token.click();};
      if(a.kind==='swap'){await click(a.from);await click(a.to);}else if(a.kind==='special'){await click(a.at);await click(a.at);}
    }
    await expect(page.getByText(`LESSON ${i+1} COMPLETE`,{exact:true})).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_training_v2')!).completedLessons)).toBe(i+1);
    expect(await page.evaluate(()=>localStorage.getItem('cyber_casino_boosters_v5'))).toBe(inventory);
    await page.getByRole('button',{name:i===LESSONS.length-1?'TRAINING COMPLETE':`NEXT LESSON ${i+2}`}).click();
  }
  await expect(page.getByRole('heading',{name:'Learn every part of the heist.'})).toBeVisible();
  await expect(page.locator('.training-academy')).toContainText(`${LESSONS.length}/${LESSONS.length} lessons completed`);
  const career=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyber_casino_career_v1')!));expect(career.achievements).toContain('Hacker Academy');expect(career.unlocked).toBe(1);
  await page.reload();await page.getByRole('button',{name:'HACKER TRAINING',exact:true}).click();await expect(page.locator('.training-academy')).toContainText(`${LESSONS.length}/${LESSONS.length} lessons completed`);
  await page.screenshot({path:`test-results/training-course-${test.info().project.name}.png`});
});
