export const RESOLUTIONS = {'720p':[1280,720], '1080p':[1920,1080], '1440p':[2560,1440], '2160p':[3840,2160], native:null} as const;
export type GameResolution = keyof typeof RESOLUTIONS;
/** CSS layout stays responsive on small screens; large screens use a logical game viewport. */
export function displayLayout(width:number,height:number,resolution:GameResolution='1080p') {
  const target=RESOLUTIONS[resolution];
  const scale=target?Math.max(1,Math.min(width/target[0],height/target[1])):1;
  return {scale,width:width/scale,height:height/scale};
}
export function resolutionDensity(width:number,height:number,resolution:GameResolution='1080p') {
  const target=RESOLUTIONS[resolution];
  return target?Math.sqrt(target[0]*target[1]/Math.max(1,width*height)):Infinity;
}
