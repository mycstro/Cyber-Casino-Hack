export const THEMES = [
  {id:'neon',name:'Neon District',primary:'#00dce8',secondary:'#ff0077',sky:'#030817',motion:'traffic',pitch:1,wave:'square',filter:1},
  {id:'quantum',name:'Quantum Vaults',primary:'#8d92ff',secondary:'#48e0ef',sky:'#071b2d',motion:'orbits',pitch:1.25,wave:'sine',filter:1.3},
  {id:'lotus',name:'Black Lotus',primary:'#eb489b',secondary:'#83e3bc',sky:'#170818',motion:'petals',pitch:.85,wave:'triangle',filter:.7},
  {id:'ai',name:'AI Central',primary:'#61e594',secondary:'#efbd57',sky:'#041710',motion:'streams',pitch:1.5,wave:'sawtooth',filter:1.6},
  {id:'singularity',name:'Singularity',primary:'#b477f4',secondary:'#f79860',sky:'#10071e',motion:'vortex',pitch:.65,wave:'sine',filter:.5},
  {id:'horizons',name:'Matrix Horizons',primary:'#f5b96c',secondary:'#4ccecf',sky:'#10262c',motion:'aurora',pitch:1.12,wave:'triangle',filter:1.15},
] as const;
export type SceneTheme = typeof THEMES[number];
/** Chapter boundaries are 11, 21, ...; frontier scenery continues cycling after 60. */
export function themeForLevel(level:number):SceneTheme {
  return THEMES[Math.floor((Math.max(1,Number.isFinite(level)?level:1)-1)/10)%THEMES.length];
}
export function themedTone(theme:SceneTheme,frequency:number,wave:OscillatorType):{frequency:number;wave:OscillatorType} {
  return {frequency:Math.max(1,frequency*theme.pitch),wave:theme.id==='neon'?wave:theme.wave};
}
