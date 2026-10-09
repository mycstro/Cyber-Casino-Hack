import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import App from '../App';
import {HeistEngine} from '../game/engine';
const state=vi.hoisted(()=>({props:{} as any,setUser:undefined as any,user:undefined as any}));
vi.mock('../game/scene-loader',()=>({loadScene:async()=>({Game:(props:any)=>{state.props=props;return <div data-testid="mock-board"/>;},MainMenuScene:()=>null})}));
vi.mock('../utils/BackgroundMusic',()=>({default:()=>null}));
vi.mock('../utils/usePlayground',()=>({usePlayground:()=>({sdk:null}),usePlaygroundGameLifecycle:()=>{},useRpc:()=>[vi.fn(),false]}));
vi.mock('../game/online',async()=>{const actual=await vi.importActual<any>('../game/online');return {...actual,useOnline:()=>{
  const [user,setUser]=React.useState(state.user);state.setUser=setUser;
  return {user,setUser,room:null,open:false,pendingBonus:null,setPendingBonus:vi.fn(),refresh:vi.fn().mockResolvedValue(undefined),show:vi.fn(),providers:{facebook:{enabled:false},instagram:{enabled:false}},available:true};
},onlineApi:{...actual.onlineApi,soloStart:vi.fn(),soloAction:vi.fn(),claimBonus:vi.fn()}};});
import {onlineApi} from '../game/online';
const inventory={emp_bomb:9,line_laser:8,overload_core:7,overclock_moves:6,glitch_wipe:5};
const profile=(counts=inventory)=>({id:'account-one',username:'alias',displayName:'Alias',provider:'password',inventory:counts,stats:{soloWins:0,soloScore:0,multiWins:0,multiLosses:0,matches:0,bestLevel:0}});
beforeEach(()=>{localStorage.clear();state.user=profile();Object.defineProperty(window,'matchMedia',{configurable:true,value:()=>({matches:false})});vi.mocked(onlineApi.soloStart).mockResolvedValue({runId:'verified-run',sequence:0,snapshot:new HeistEngine(1,42).snapshot(),moves:22});});
afterEach(()=>{cleanup();vi.clearAllMocks();});
async function start(){render(<App/>);await act(async()=>{fireEvent.click(screen.getByRole('button',{name:/INITIALIZE HACK/}));});await screen.findByTestId('mock-board');}
it('uses the verified inventory exactly once while preserving the guest balance',async()=>{
  await start();const guest=localStorage.getItem('cyber_casino_boosters_v5'),engine=new HeistEngine(1,42);
  const after={...inventory,emp_bomb:8};vi.mocked(onlineApi.soloAction).mockResolvedValue({accepted:true,sequence:1,moves:21,snapshot:engine.snapshot(),complete:false,user:profile(after)});
  await act(async()=>{await state.props.onAction({kind:'booster',booster:'emp_bomb',at:[3,3]},engine.snapshot());});
  act(()=>state.props.onConsumeBooster('emp_bomb'));
  expect(screen.getByRole('button',{name:/EMP BLAST/}).textContent).toContain('x8');expect(localStorage.getItem('cyber_casino_boosters_v5')).toBe(guest);
  const won={...after,emp_bomb:9,overclock_moves:7};await act(async()=>state.setUser(profile(won)));act(()=>state.props.onDistrictWin());
  expect(localStorage.getItem('cyber_casino_boosters_v5')).toBe(guest);await act(async()=>fireEvent.click(screen.getByRole('button',{name:'BREACH LEVEL 2'})));expect(screen.getByRole('button',{name:/EMP BLAST/}).textContent).toContain('x9');
  await act(async()=>state.setUser(null));expect(localStorage.getItem('cyber_casino_boosters_v5')).toBe(guest);
});
it('keeps resumed local heists separate from signed account inventory',async()=>{
  const tiles=new HeistEngine(1,42).snapshot().tiles;localStorage.setItem('cyber_casino_save_v5',JSON.stringify({level:1,score:0,levelScore:0,moves:22,tiles,timestamp:Date.now()}));
  render(<App/>);await act(async()=>{fireEvent.click(screen.getByRole('button',{name:/CONTINUE HEIST/}));});await screen.findByTestId('mock-board');
  expect(state.props.onAction).toBeUndefined();expect(screen.getByRole('button',{name:/EMP BLAST/}).textContent).toContain('x2');act(()=>state.props.onConsumeBooster('emp_bomb'));expect(screen.getByRole('button',{name:/EMP BLAST/}).textContent).toContain('x1');expect(JSON.parse(localStorage.getItem('cyber_casino_boosters_v5')!).emp_bomb).toBe(1);
});
it('ignores a late solo response after logout',async()=>{
  await start();let resolve!: (r:any)=>void;vi.mocked(onlineApi.soloAction).mockImplementation(()=>new Promise(r=>{resolve=r;}));
  let request!:Promise<boolean>;await act(async()=>{request=state.props.onAction({kind:'swap',from:[1,1],to:[0,1]},new HeistEngine(1,42).snapshot());});
  await act(async()=>state.setUser(null));let accepted=true;await act(async()=>{resolve({accepted:true,sequence:1,snapshot:new HeistEngine(1,42).snapshot(),moves:21,complete:false,user:profile()});accepted=await request;});expect(accepted).toBe(false);expect(screen.queryByRole('button',{name:/PROFILE & MULTIPLAYER/})).toBeNull();
});
