import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import App from '../App';
import {readTraining,trainingQueueKey} from '../game/training-progress';
import {HeistEngine} from '../game/engine';

const state=vi.hoisted(()=>({props:{} as any,profile:null as any,setUser:null as any,training:vi.fn()}));
vi.mock('../game/online',()=>({onlineApi:{training:state.training},useOnline:()=>{
  const [user,setUser]=React.useState(state.profile);state.setUser=setUser;
  return {user,setUser,room:null,open:false,pendingBonus:null,setPendingBonus:vi.fn(),show:vi.fn(),setOpen:vi.fn()};
}}));
vi.mock('../game/scene-loader',()=>({loadScene:async()=>({Game:(p:any)=>{state.props=p;return <div data-testid="game"/>;},MainMenuScene:()=>null})}));
vi.mock('../utils/BackgroundMusic',()=>({default:()=>null}));
vi.mock('../utils/usePlayground',()=>({usePlayground:()=>({sdk:null}),usePlaygroundGameLifecycle:()=>{},useRpc:()=>[vi.fn(),false]}));

const profile=(id='account-a')=>({id,username:id,displayName:id,provider:'password',inventory:{emp_bomb:2,line_laser:2,overload_core:1,overclock_moves:2,glitch_wipe:1},training:readTraining(null,22),controls:{desktop:'pointer',mobile:'touch',tablet:'touch',keyboardEnabled:true},stats:{soloWins:0,soloScore:0,multiWins:0,multiLosses:0,matches:0,bestLevel:1}});
describe('offline account training in the application',()=>{
  beforeEach(()=>{localStorage.clear();state.profile=profile();state.training.mockReset();Object.defineProperty(window,'matchMedia',{configurable:true,value:()=>({matches:false})});});
  afterEach(cleanup);
  it('shows a signed-in completion immediately, retries on reconnect, and removes the acknowledged receipt without touching guest training',async()=>{
    state.training.mockRejectedValue(new Error('offline'));
    render(<App/>);fireEvent.click(screen.getByRole('button',{name:'HACKER TRAINING'}));await act(async()=>fireEvent.click(screen.getByRole('button',{name:'START GUIDED TRAINING'})));await screen.findByTestId('game');
    act(()=>state.props.onProgress(new HeistEngine(1,101,8,8,undefined,1).snapshot()));await act(async()=>state.props.onDistrictWin());await waitFor(()=>expect(state.training).toHaveBeenCalledTimes(1));
    const pending=JSON.parse(localStorage.getItem(trainingQueueKey('account-a'))!);expect(pending).toHaveLength(1);expect(localStorage.getItem('cyber_casino_training_v2')).toBeNull();
    // The stubbed game returns to the menu; the Academy overlays the account's pending receipt.
    act(()=>state.props.setGameState((s:any)=>({...s,status:'START'})));fireEvent.click(screen.getByRole('button',{name:'HACKER TRAINING'}));expect(screen.getByText(/1\/22 lessons completed/)).toBeTruthy();
    const updated=profile();updated.training.lessons[0]={...updated.training.lessons[0],completed:true,attempts:1,completions:1,bestMoves:0,lastMoves:0,bestMistakes:0,lastMistakes:0,totalMistakes:0};updated.training.completedLessons=1;updated.training.totalAttempts=1;
    state.training.mockResolvedValue({user:updated});await act(async()=>window.dispatchEvent(new Event('online')));
    await waitFor(()=>expect(JSON.parse(localStorage.getItem(trainingQueueKey('account-a'))!)).toEqual([]));expect(screen.getByText(/1\/22 lessons completed/)).toBeTruthy();expect(state.training.mock.calls[1][3]).toBe(pending[0].requestId);
  });
  it('does not show guest or another account queued progress in the signed-in academy',async()=>{
    const guest=readTraining(null,22);guest.lessons[0].completed=true;guest.completedLessons=1;localStorage.setItem('cyber_casino_training_v2',JSON.stringify(guest));
    localStorage.setItem(trainingQueueKey('account-b'),JSON.stringify([{requestId:'other',lesson:2,moves:1,completed:true,mistakes:0}]));
    render(<App/>);fireEvent.click(screen.getByRole('button',{name:'HACKER TRAINING'}));expect(screen.getByText(/0\/22 lessons completed/)).toBeTruthy();expect(state.training).not.toHaveBeenCalled();
  });
});
