import {expect,it} from 'vitest';
import {pixelDensity,RenderBudget,RenderClock} from '../game/rendering';

it('bounds framebuffer work from phone through 4K without trusting excessive device density',()=>{
  for(const [width,height,dpr] of [[320,568,3],[768,1024,2],[1920,1080,1],[3840,2160,2]]) {
    const density=pixelDensity('high',dpr,width,height);
    expect(density).toBeLessThanOrEqual(1.75);expect(density).toBeGreaterThanOrEqual(.5);
    expect(width*height*density*density).toBeLessThanOrEqual(2_500_001);
  }
});
it('reduces sustained slow render load, ignores suspension, and recovers gradually',()=>{
  const b=new RenderBudget(1.5,60);
  for(let i=0;i<60;i++)b.sample(1/24);
  expect(b.dpr).toBeLessThan(1.5);expect(b.fps).toBeLessThan(60);
  const reduced=b.dpr;for(let i=0;i<60;i++)b.sample(5);expect(b.dpr).toBe(reduced);
  for(let i=0;i<180;i++)b.sample(1/b.fps);
  expect(b.dpr).toBeGreaterThan(reduced);expect(b.dpr).toBeLessThanOrEqual(1.5);
});
it('keeps render density and frame rate bounded on a persistently slow device',()=>{
  const b=new RenderBudget(1,30);for(let i=0;i<1800;i++)b.sample(1/10);
  expect(b.dpr).toBe(.5);expect(b.fps).toBe(24);
});

it.each([60,120,144])('maintains fractional frame budgets on a %i Hz display without drift',refresh=>{
  for(const target of [30,45,60]) {
    const clock=new RenderClock();let frames=0;
    for(let tick=0;tick<refresh*5;tick++)if(clock.ready(tick*1000/refresh,target))frames++;
    expect(Math.abs(frames-target*5)).toBeLessThanOrEqual(1);
  }
});
it('resumes after suspension without rendering a backlog of missed frames',()=>{
  const clock=new RenderClock();expect(clock.ready(0,45)).toBe(true);expect(clock.ready(5000,45)).toBe(true);
  expect(clock.ready(5000,45)).toBe(false);expect(clock.ready(5005,45)).toBe(false);
});
