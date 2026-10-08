import React from 'react';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {board} from './fixtures';
import App from '../App';
import {BONUS_KEY,createBonus,slotPrize} from '../game/bonus';
import {HeistEngine} from '../game/engine';

const state = vi.hoisted(() => ({props: {} as Record<string, any>}));
vi.mock('../Game', () => ({
  getDistrictForLevel: (level: number) => ({id:level,tier:1,subtitle:'Test',name:'Test',targetScore:3500,moves:22,
    obstaclePlan:{ice:1,corrupted:0,lock:0,turret:0,plasma_shield:0,void:0}}),
  Game: (props: Record<string, any>) => {state.props = props; return <div data-testid="game" />;},
  MainMenuScene: () => <div data-testid="main-menu-scene" />,
}));
vi.mock('../game/scene-loader',()=>({loadScene:async()=>({
  Game:(props:Record<string,any>)=>{state.props=props;return <div data-testid="game"/>;},
  MainMenuScene:()=> <div data-testid="main-menu-scene"/>,
})}));
vi.mock('../utils/BackgroundMusic', () => ({default: () => null}));
vi.mock('../utils/usePlayground', () => ({
  usePlayground: () => ({sdk:null}), usePlaygroundGameLifecycle: () => {}, useRpc: () => [vi.fn(),false],
}));

describe('application lifecycle integration', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window,'matchMedia',{configurable:true,value:() => ({matches:false})});
  });
  afterEach(cleanup);
  const start = async () => {render(<App />); await act(async()=>{fireEvent.click(screen.getByRole('button', {name:/INITIALIZE HACK/i}));});await screen.findByTestId('game');};
  it('pauses the game for the menu and resumes it', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', {name:'Game Menu'}));
    expect(state.props.isPaused).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'RESUME HACK'}));
    expect(state.props.isPaused).toBe(false);
  });
  it('pauses for settings opened directly from the HUD', async () => {
    await start(); fireEvent.click(screen.getByRole('button',{name:'Settings and View'}));
    expect(state.props.isPaused).toBe(true);
    fireEvent.keyDown(window,{key:'Escape'});
    expect(state.props.isPaused).toBe(false);
  });
  it('does not spend a purge booster while processing', async () => {
    await start(); act(() => state.props.onProcessingChange(true));
    const before = localStorage.getItem('cyber_casino_boosters_v5');
    fireEvent.click(screen.getByRole('button',{name:/PURGE HAZARD/i}));
    expect(state.props.glitchWipeTriggerCount).toBe(0);
    expect(localStorage.getItem('cyber_casino_boosters_v5')).toBe(before);
  });
  it('spends a purge booster only when the game accepts it', async () => {
    await start(); fireEvent.click(screen.getByRole('button',{name:/PURGE HAZARD/i}));
    expect(JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!).glitch_wipe).toBe(1);
    act(() => state.props.onConsumeBooster('glitch_wipe'));
    expect(JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!).glitch_wipe).toBe(0);
  });
  it('writes the next-level checkpoint and awards completion only once', async () => {
    await start();
    act(() => {
      state.props.setGameState((prev: any) => ({...prev,score:4000,moves:10}));
      state.props.setLevelScore(4000);
    });
    act(() => state.props.onSaveBoardState(board(),4000));
    const win = state.props.onDistrictWin;
    act(() => {win(); win();});
    const saved = JSON.parse(localStorage.getItem('cyber_casino_save_v5')!);
    expect(saved).toMatchObject({level:2,score:6000,levelScore:0,moves:22,tiles:null});
    expect(JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!).emp_bomb).toBe(3);
    cleanup(); render(<App />);
    fireEvent.click(screen.getByRole('button',{name:/CONTINUE/i}));
    expect(state.props.currentLevel).toBe(2);
    expect(state.props.gameState.score).toBe(6000);
    expect(JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!).emp_bomb).toBe(3);
  });
  it('restarts with zero level score and fresh moves', async () => {
    await start(); act(() => state.props.setLevelScore(1000));
    fireEvent.click(screen.getByRole('button',{name:'Game Menu'}));
    fireEvent.click(screen.getByRole('button',{name:'RETRY LEVEL 1'}));
    expect(state.props.levelScore).toBe(0);
    expect(state.props.gameState.moves).toBe(22);
    expect(state.props.isPaused).toBe(false);
  });
  it('awards visible booster loot once for each completed replay run',async()=>{
    await start();act(()=>state.props.onDistrictWin());
    const before=JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!);
    expect(screen.getByTestId('completion-loot').textContent).toContain('EMP Blast');
    fireEvent.click(screen.getByRole('button',{name:'RETURN TO HEIST HUB'}));
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:/SUBNET 1.*Score/i}));});
    const win=state.props.onDistrictWin;act(()=>{win();win();});
    const after=JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!);
    expect(after.emp_bomb).toBe(before.emp_bomb+1);expect(after.overclock_moves).toBe(before.overclock_moves+1);
    expect(screen.getByTestId('completion-loot').textContent).toContain('EMP Blast');
  });
  it.each([5,10])('shows all milestone loot and switches chapter immediately after level %i',async level=>{
    localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level,score:0,levelScore:0,moves:22,tiles:null,timestamp:Date.now()}));
    render(<App/>);await act(async()=>{fireEvent.click(screen.getByRole('button',{name:/CONTINUE HEIST/}));});await screen.findByTestId('game');
    const before=JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!);act(()=>state.props.onDistrictWin());
    expect(screen.getByTestId('completion-loot').textContent).toContain('EMP Blast');expect(screen.getByTestId('completion-loot').textContent).toContain('Purge Wipe');
    expect(JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!).emp_bomb).toBe(before.emp_bomb+(level===10?2:1));
    expect(state.props.themeLevel).toBe(level+1);
    if(level===10){expect(screen.getByTestId('completion-loot').textContent).toContain('Overload');expect(screen.getByTestId('completion-loot').textContent).toContain('Dual Laser');}
  });
  it('records daily personal best without changing career loot or checkpoint',async()=>{
    await start();act(()=>state.props.onSaveBoardState(board(),0));
    fireEvent.click(screen.getByRole('button',{name:'Game Menu'}));fireEvent.click(screen.getByRole('button',{name:'SAVE & QUIT TO MAIN MENU'}));
    const before={save:localStorage.getItem('cyber_casino_save_v5'),loot:localStorage.getItem('cyber_casino_boosters_v5')};
    fireEvent.click(screen.getByRole('button',{name:'CAMPAIGN MAP & DAILY HEIST'}));fireEvent.click(screen.getByRole('button',{name:'DAILY'}));
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'START DAILY CHALLENGE'}));});
    act(()=>state.props.setGameState((s:any)=>({...s,score:1000,moves:5})));act(()=>state.props.onDistrictWin());
    expect(JSON.parse(localStorage.getItem('cyber_casino_daily_v1')!).score).toBe(2000);
    expect(localStorage.getItem('cyber_casino_save_v5')).toBe(before.save);expect(localStorage.getItem('cyber_casino_boosters_v5')).toBe(before.loot);
  });
  it('opens the tenth-level slot only after displaying normal rewards, resumes the saved win and cannot pay twice',async()=>{
    localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:10,score:0,levelScore:0,moves:27,tiles:null,timestamp:Date.now()}));
    render(<App/>);await act(async()=>{fireEvent.click(screen.getByRole('button',{name:/CONTINUE HEIST/}));});await screen.findByTestId('game');act(()=>state.props.onDistrictWin());
    expect(screen.getByTestId('completion-loot')).toBeTruthy();expect(screen.queryByTestId('bonus-round')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'PLAY BONUS SLOT ROUND'}));const b=JSON.parse(localStorage.getItem(BONUS_KEY)!);const before=JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!);
    fireEvent.click(screen.getByRole('button',{name:'SPIN FREE BONUS'}));const after=JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!);expect(after[b.booster]).toBe(before[b.booster]+slotPrize(b.booster).amount);
    cleanup();render(<App/>);expect(screen.getByTestId('bonus-round').getAttribute('data-phase')).toBe('won');expect(JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!)).toEqual(after);
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'CONTINUE TO LEVEL 11'}));});await screen.findByTestId('game');expect(state.props.currentLevel).toBe(11);expect(localStorage.getItem(BONUS_KEY)).toBeNull();
  });
  it('preserves a pending spin across reload and rejects campaign launch until it is finished',async()=>{
    const b=createBonus(20,()=>0);localStorage.setItem(BONUS_KEY,JSON.stringify(b));render(<App/>);
    expect(screen.getByTestId('bonus-round').getAttribute('data-phase')).toBe('ready');expect(JSON.parse(localStorage.getItem(BONUS_KEY)!)).toEqual(b);
  });
  it('retains an interrupted slot payment when recovery initially fails, then completes it without another reward',async()=>{
    const original={emp_bomb:2,line_laser:2,overload_core:1,overclock_moves:2,glitch_wipe:1},after={...original,overload_core:2};
    const round={...createBonus(10,()=>.99),claimed:true,applied:false,inventoryAfter:after};localStorage.setItem(BONUS_KEY,JSON.stringify(round));localStorage.setItem('cyber_casino_boosters_v5',JSON.stringify(original));localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:11,score:5000,levelScore:0,moves:23,tiles:null,timestamp:Date.now()}));
    const set=Storage.prototype.setItem;let failed=false;vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key,value){if(key==='cyber_casino_boosters_v5'&&!failed){failed=true;throw Error('temporary quota failure');}set.call(this,key,value);});
    render(<App/>);expect(screen.getByTestId('bonus-round').getAttribute('data-phase')).toBe('won');expect(localStorage.getItem(BONUS_KEY)).not.toBeNull();
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'CONTINUE TO LEVEL 11'}));});await screen.findByTestId('game');expect(JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!)).toEqual(after);expect(localStorage.getItem(BONUS_KEY)).toBeNull();
    cleanup();render(<App/>);expect(JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!)).toEqual(after);
  });
  it('tracks accepted moves and booster use across a saved resume when calculating XP',async()=>{
    await start();const e=new HeistEngine(1,123);e.state.turn=7;act(()=>state.props.onProgress(e.snapshot()));act(()=>state.props.onDistrictWin());
    expect(screen.getByTestId('completion-xp').textContent).toContain('7 moves taken');expect(screen.getByTestId('completion-xp').textContent).toContain('BOOSTER-FREE CLEAR');
    const xp=JSON.parse(localStorage.getItem('cyber_casino_career_v1')!).xp;cleanup();render(<App/>);expect(JSON.parse(localStorage.getItem('cyber_casino_career_v1')!).xp).toBe(xp);
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:/CONTINUE HEIST/}));});await screen.findByTestId('game');
    fireEvent.click(screen.getByRole('button',{name:/\+5 MOVES/}));act(()=>state.props.onSaveBoardState(e.snapshot().tiles,0,e.snapshot()));
    cleanup();render(<App/>);await act(async()=>{fireEvent.click(screen.getByRole('button',{name:/CONTINUE HEIST/}));});await screen.findByTestId('game');act(()=>state.props.onDistrictWin());
    expect(screen.getByTestId('completion-xp').textContent).toContain('BASE XP · BOOSTER USED');expect(screen.getByTestId('completion-xp').textContent).toContain('1.00×');
  });
});
