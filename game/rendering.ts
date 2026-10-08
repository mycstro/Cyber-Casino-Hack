import type {Preferences} from './preferences';

/** Carry fractional frame intervals across browser ticks, including 60/120/144 Hz displays. */
export class RenderClock {
  private next:number|undefined;
  ready(time:number,fps:number) {
    if(this.next===undefined)this.next=time;
    if(time+.75<this.next)return false;
    const interval=1000/fps;
    this.next+=Math.max(1,Math.floor((time-this.next)/interval)+1)*interval;
    return true;
  }
}

/** Bound work by both user preference and actual drawing area, including large displays. */
export function pixelDensity(quality:Preferences['quality'],deviceDpr:number,width:number,height:number) {
  const limit=quality==='high'?1.75:quality==='medium'?1.25:1;
  const pixels=quality==='high'?2_500_000:quality==='medium'?1_750_000:1_000_000;
  return Math.max(.5,Math.min(limit,Math.max(.5,deviceDpr||1),Math.sqrt(pixels/Math.max(1,width*height))));
}

export class RenderBudget {
  dpr:number; fps:number; private frames=0; private elapsed=0; private fast=0;
  constructor(readonly maxDpr:number,readonly maxFps:number){this.dpr=maxDpr;this.fps=maxFps;}
  sample(delta:number) {
    // Ignore suspension gaps rather than treating a hidden tab as a slow device.
    if(delta<=0||delta>.5)return false;
    this.frames++;this.elapsed+=delta;
    if(this.frames<60)return false;
    const average=this.elapsed/this.frames;this.frames=0;this.elapsed=0;
    if(average>1/this.fps*1.35){this.fast=0;this.dpr=Math.max(.5,this.dpr-.15);this.fps=Math.max(24,this.fps-6);return true;}
    if(average<1/this.fps*1.12&&++this.fast>=3){this.fast=0;const old=this.dpr;this.dpr=Math.min(this.maxDpr,this.dpr+.1);this.fps=Math.min(this.maxFps,this.fps+3);return old!==this.dpr;}
    return false;
  }
}
