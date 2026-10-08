import {MusicTrack} from './utils/helper';

/** Game configuration schema. */
export const CONFIG = {
  // --- Game ---
  title: {
    value: 'Cyber Casino Hack',
    type: 'string',
    label: 'Game Title',
    group: 'Game',
  },
  baseCanvasWidth: {
    value: 800,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'Game',
  },
  baseCanvasHeight: {
    value: 900,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'Game',
  },

  // --- Grid & Puzzle Rules ---
  gridRows: {
    value: 8,
    type: 'number',
    label: 'Grid Rows',
    group: 'Grid',
    min: 6,
    max: 10,
    step: 1,
  },
  gridCols: {
    value: 8,
    type: 'number',
    label: 'Grid Columns',
    group: 'Grid',
    min: 6,
    max: 10,
    step: 1,
  },
  startingMoves: {
    value: 22,
    type: 'number',
    label: 'Starting Moves (D1)',
    group: 'Rules',
    min: 10,
    max: 40,
    step: 1,
  },
  targetScoreD1: {
    value: 2500,
    type: 'number',
    label: 'Target Score District 1',
    group: 'Rules',
    min: 1000,
    max: 5000,
    step: 250,
  },
  targetScoreD2: {
    value: 6000,
    type: 'number',
    label: 'Target Score District 2',
    group: 'Rules',
    min: 3000,
    max: 10000,
    step: 500,
  },
  targetScoreD3: {
    value: 12000,
    type: 'number',
    label: 'Target Score District 3',
    group: 'Rules',
    min: 6000,
    max: 20000,
    step: 1000,
  },
  targetScoreD4: {
    value: 20000,
    type: 'number',
    label: 'Target Score District 4',
    group: 'Rules',
    min: 10000,
    max: 35000,
    step: 1000,
  },
  scoreMultiplierStep: {
    value: 1.5,
    type: 'number',
    label: 'Combo Multiplier Step',
    group: 'Rules',
    min: 1.1,
    max: 3.0,
    step: 0.1,
  },

  // --- Camera ---
  fov: {
    value: 48,
    type: 'number',
    label: 'Field of View',
    group: 'Camera',
    min: 30,
    max: 90,
    step: 2,
  },
  cameraX: {
    value: 0,
    type: 'number',
    label: 'Camera X',
    group: 'Camera',
  },
  cameraY: {
    value: -0.2,
    type: 'number',
    label: 'Camera Y',
    group: 'Camera',
  },
  cameraZ: {
    value: 13.5,
    type: 'number',
    label: 'Camera Z',
    group: 'Camera',
  },

  // --- Visuals & Theme ---
  backgroundColor: {
    value: '#05060f',
    type: 'color',
    label: 'Background Color',
    group: 'Visuals',
  },
  primaryColor: {
    value: '#00f7ff',
    type: 'color',
    label: 'Primary Neon Color',
    group: 'Visuals',
  },
  fontFamily: {
    value: 'Orbitron, sans-serif',
    type: 'string',
    label: 'Font Family',
    group: 'Visuals',
  },
  ambientColor: {
    value: '#151c38',
    type: 'color',
    label: 'Ambient Light Color',
    group: 'Visuals',
  },
  ambientIntensity: {
    value: 1.6,
    type: 'number',
    label: 'Ambient Intensity',
    group: 'Visuals',
    min: 0,
    max: 5,
    step: 0.1,
  },
  sunColor: {
    value: '#00e5ff',
    type: 'color',
    label: 'Sun Color',
    group: 'Visuals',
  },
  sunIntensity: {
    value: 3.2,
    type: 'number',
    label: 'Sun Intensity',
    group: 'Visuals',
    min: 0,
    max: 10,
    step: 0.1,
  },
  hemiSkyColor: {
    value: '#ff0077',
    type: 'color',
    label: 'Hemisphere Sky Color',
    group: 'Visuals',
  },
  hemiGroundColor: {
    value: '#060b1e',
    type: 'color',
    label: 'Hemisphere Ground Color',
    group: 'Visuals',
  },
  hemiIntensity: {
    value: 0.9,
    type: 'number',
    label: 'Hemisphere Intensity',
    group: 'Visuals',
    min: 0,
    max: 3,
    step: 0.1,
  },

  // --- Physics ---
  gravity: {
    value: -9.81,
    type: 'number',
    label: 'Gravity',
    group: 'Physics',
    min: -30,
    max: 0,
    step: 0.5,
  },

  // --- System ---
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'System',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'System',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'System',
  },

  // --- Audio ---
  defaultMusicVolume: {
    value: 0.45,
    type: 'number',
    label: 'Default Music Volume',
    group: 'Audio',
  },
  defaultSfxVolume: {
    value: 0.7,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'Audio',
  },
  backgroundMusicUrl: {
    value:
      'https://storage.googleapis.com/assets-gen-playground/musiclibrary/grid_runner.mp3',
    type: 'string',
    label: 'Background Music URL',
    group: 'Audio',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/** Type helper for reading values in game code. */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

/** Background music tracks available for the game to use (6 valid high-energy tracks). */
export const AVAILABLE_MUSIC_TRACKS: readonly MusicTrack[] = [
  {
    name: 'Grid Runner',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/grid_runner.mp3',
    description: 'Cyberpunk adrenaline synth pulse and high-energy matrix beat.',
  },
  {
    name: 'Acid Bass',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/acid_bass.mp3',
    description: 'Underground cyber rave driving 303 squelch and acid bassline.',
  },
  {
    name: 'Automated Dream',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/automated_dream.mp3',
    description: 'Intellectual matrix flow, electronic synth textures and neon melodies.',
  },
  {
    name: 'Chrome Matrix',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/chrome_cobblestone.mp3',
    description: 'Industrial cyber rhythm and neon focus beat.',
  },
  {
    name: 'Overdrive Rift',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/rock_riff.mp3',
    description: 'High voltage electric synth-rock energy and driving tempo.',
  },
  {
    name: 'Cyber Funk',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/funk_riff_emin.mp3',
    description: 'Upbeat cyberpunk funk groove and soulful energy.',
  },
];
