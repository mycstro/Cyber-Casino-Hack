import {expect, it} from 'vitest';
import {boardCameraDistance} from '../game/camera';

it.each([0.45,0.6,1,1.8,3])('fits all board corners at aspect ratio %s', aspect => {
  for (const size of [6,8,10]) {
    const distance = boardCameraDistance(size,size,aspect,48);
    const height = 2 * distance * Math.tan(48 * Math.PI / 360);
    expect(height).toBeGreaterThan(size * 1.15 + 0.8);
    expect(height * aspect).toBeGreaterThan(size * 1.15 + 0.8);
  }
});
