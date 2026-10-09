import {defineConfig, devices} from '@playwright/test';
import {existsSync} from 'node:fs';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: 'online.spec.ts',
  timeout: 60000,
  expect: {timeout: 15000},
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['html', {open:'never'}]],
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL,
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']},
  },
  projects: [
    {name:'desktop', use:{...devices['Desktop Chrome'],viewport:{width:1280,height:900}}},
    {name:'mobile', use:{...devices['Pixel 7']}},
    ...[
      ['small-phone',320,568],['phone-landscape',844,390],['tablet',768,1024],
      ['tablet-landscape',1024,768],['laptop',1366,768],['ultrawide',2560,1080],['4k',3840,2160],
    ].map(([name,width,height])=>({name:String(name),testMatch:['responsive.spec.ts','bonus-responsive.spec.ts'],use:{browserName:'chromium' as const,viewport:{width:Number(width),height:Number(height)},hasTouch:Number(width)<1100}})),
    {name:'firefox',testMatch:['responsive.spec.ts','bonus-responsive.spec.ts'],use:{browserName:'firefox',viewport:{width:1280,height:800},channel:undefined,launchOptions:{firefoxUserPrefs:{'webgl.force-enabled':true}}}},
    {name:'webkit-phone',testMatch:['responsive.spec.ts','bonus-responsive.spec.ts'],use:{browserName:'webkit',viewport:{width:390,height:844},hasTouch:true,channel:undefined,launchOptions:{args:[]}}},
    ...(existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')||existsSync('C:/Program Files/Microsoft/Edge/Application/msedge.exe')?[{name:'edge',testMatch:['responsive.spec.ts','bonus-responsive.spec.ts'],use:{browserName:'chromium' as const,channel:'msedge',viewport:{width:1920,height:1080}}}]:[]),
  ],
  webServer: {command:'npm run preview -- --port 4173 --strictPort', url:'http://127.0.0.1:4173', reuseExistingServer: false},
});
