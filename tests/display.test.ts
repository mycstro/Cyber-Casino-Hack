import {describe,it,expect} from 'vitest';
import {displayLayout,resolutionDensity} from '../game/display';
import {readPreferences} from '../game/preferences';

describe('independent game resolution',()=>{
  it('uses a standard 1080p logical viewport on a 4K display',()=>{
    expect(displayLayout(3840,2160)).toEqual({scale:2,width:1920,height:1080});
    expect(resolutionDensity(3840,2160)).toBe(.5);
  });
  it('preserves readable responsive layouts on smaller and rotated screens',()=>{
    for(const [width,height] of [[320,568],[844,390],[768,1024],[1366,768]]){
      expect(displayLayout(width,height)).toEqual({scale:1,width,height});
      expect(resolutionDensity(width,height)).toBeGreaterThanOrEqual(1);
    }
  });
  it('fits ultrawide screens without changing their aspect or cropping controls',()=>{
    const view=displayLayout(5120,2160);
    expect(view.scale).toBe(2);expect(view.width).toBe(2560);expect(view.height).toBe(1080);
    expect(view.width/view.height).toBeCloseTo(5120/2160);
  });
  it('supports explicit resolution and native rendering independently of hardware',()=>{
    expect(displayLayout(3840,2160,'720p')).toEqual({scale:3,width:1280,height:720});
    expect(displayLayout(3840,2160,'1440p')).toEqual({scale:1.5,width:2560,height:1440});
    expect(displayLayout(3840,2160,'2160p')).toEqual({scale:1,width:3840,height:2160});
    expect(displayLayout(3840,2160,'native')).toEqual({scale:1,width:3840,height:2160});
    expect(resolutionDensity(3840,2160,'native')).toBe(Infinity);
  });
  it('migrates existing and invalid preferences to the standard default',()=>{
    for(const raw of [null,'{}','null','invalid','{"resolution":"8k"}'])expect(readPreferences(raw).resolution).toBe('1080p');
    for(const resolution of ['720p','1080p','1440p','2160p','native'])expect(readPreferences(JSON.stringify({resolution})).resolution).toBe(resolution);
  });
});
