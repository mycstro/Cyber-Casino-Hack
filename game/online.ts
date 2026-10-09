import {useCallback,useEffect,useRef,useState} from 'react';
import type {Action,Snapshot} from './engine';
import type {BoosterInventory} from '../types';
import {createRequestId} from './id';

export interface TrainingLesson {lesson:number;completed:boolean;attempts:number;completions:number;bestMoves:number|null;lastMoves:number|null;bestMistakes?:number|null;lastMistakes?:number|null;totalMistakes?:number}
export interface ControlPreferences {desktop:'keyboard'|'pointer';mobile:'touch';tablet:'touch'|'pointer';keyboardEnabled:boolean}
export interface Profile {id:string;username:string;displayName:string;provider:string;inventory:BoosterInventory;stats:{soloWins:number;soloScore:number;multiWins:number;multiLosses:number;matches:number;bestLevel:number};training?:{lessons:TrainingLesson[];completedLessons:number;totalAttempts:number};controls?:ControlPreferences}
export type LeaderboardEntry=Pick<Profile,'id'|'displayName'|'stats'>;
export interface Provider {enabled:boolean;reason?:string}
export interface RoomPlayer {id:string;displayName:string;score:number;moves:number;complete:boolean;readyNext:boolean;connected:boolean;sequence:number}
export interface Room {code:string;hostId:string;level:number;seed:number;status:'lobby'|'countdown'|'playing'|'results';startsAt:number;serverNow:number;players:RoomPlayer[];winnerId:string|null;results:{id:string;displayName:string;score:number;place:number;completed:boolean}[];snapshot:Snapshot;moves:number;sequence:number}
export interface OnlineBonus {id:string;level:number;booster:keyof BoosterInventory;quantity:number}
export interface Session {user:Profile|null;csrf:string;providers:{facebook:Provider;instagram:Provider};bonus?:OnlineBonus|null}
let csrf='',sessionEpoch=0;
export async function request<T>(path:string,method='GET',body?:unknown):Promise<T> {
  const epoch=sessionEpoch;
  const response=await fetch(`/api${path}`,{method,credentials:'same-origin',headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-CSRF-Token':csrf})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json().catch(()=>{throw new Error('The online service returned an unreadable response.');});
  if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'The request could not be completed.');
  if(typeof data.csrf==='string'&&epoch===sessionEpoch)csrf=data.csrf;
  return data as T;
}
function sessionMutation<T>(path:string,method:string,body?:unknown){sessionEpoch++;return request<T>(path,method,body);}
export const onlineApi={
  session:()=>request<Session>('/session'),
  register:(username:string,password:string,displayName:string)=>sessionMutation<{user:Profile}>('/register','POST',{username,password,displayName}),
  login:(username:string,password:string)=>sessionMutation<{user:Profile}>('/login','POST',{username,password}),
  logout:()=>sessionMutation('/logout','POST'),
  profile:(displayName:string)=>request<{user:Profile}>('/profile','PATCH',{displayName}),
  controls:(device:'desktop'|'mobile'|'tablet',mode:'keyboard'|'pointer'|'touch',keyboardEnabled?:boolean)=>request<{user:Profile}>('/controls','PATCH',{device,mode,keyboardEnabled}),
  training:(lesson:number,moves:number,completed:boolean,requestId:string=createRequestId(),mistakes=0)=>request<{user:Profile}>('/training','POST',{lesson,moves,completed,requestId,mistakes}),
  password:(currentPassword:string,newPassword:string)=>sessionMutation('/password','POST',{currentPassword,newPassword}),
  deleteAccount:(password:string)=>sessionMutation('/account','DELETE',{password}),
  leaderboard:()=>request<{entries:LeaderboardEntry[]}>('/leaderboard'),
  claimBonus:(id:string)=>request<{user:Profile;booster:keyof BoosterInventory;quantity:number}>('/bonus/claim','POST',{id}),
  room:()=>request<{room:Room|null}>('/rooms/current'),
  host:(level:number)=>request<{room:Room}>('/rooms','POST',{level}),
  join:(code:string)=>request<{room:Room}>('/rooms/join','POST',{code}),
  start:(code:string)=>request<{room:Room}>(`/rooms/${encodeURIComponent(code)}/start`,'POST'),
  next:(code:string)=>request<{room:Room}>(`/rooms/${encodeURIComponent(code)}/next`,'POST'),
  leave:(code:string)=>request(`/rooms/${encodeURIComponent(code)}/leave`,'POST'),
  action:(code:string,sequence:number,action:Action,requestId:string=createRequestId(),expected?:{serial:number;rng:number})=>request<{room:Room;accepted:boolean}>(`/rooms/${encodeURIComponent(code)}/action`,'POST',{sequence,action,requestId,expectedSerial:expected?.serial,expectedRng:expected?.rng}),
  soloStart:(level:number,seed:number)=>request<{runId:string;snapshot:Snapshot;moves:number;sequence:number}>('/solo/start','POST',{level,seed}),
  soloAction:(id:string,sequence:number,action:Action,requestId:string=createRequestId(),expected?:{serial:number;rng:number})=>request<{accepted:boolean;snapshot:Snapshot;moves:number;sequence:number;complete:boolean;bonusMoves?:number;user:Profile;bonus?:OnlineBonus|null}>(`/solo/${encodeURIComponent(id)}/action`,'POST',{sequence,action,requestId,expectedSerial:expected?.serial,expectedRng:expected?.rng}),
};
export type OnlineTab='account'|'profile'|'race'|'leaderboard';
export function useOnline(callbacks:{onRaceStart:(room:Room)=>void;onAuthoritative?:(room:Room)=>void;onSolo:(level:number)=>void;onMenu:()=>void}) {
  const [user,setUser]=useState<Profile|null>(null),[room,setRoom]=useState<Room|null>(null),[open,setOpen]=useState(false),[tab,setTab]=useState<OnlineTab>('account'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[available,setAvailable]=useState(false);
  const [providers,setProviders]=useState<Session['providers']>({facebook:{enabled:false,reason:'Checking provider availability…'},instagram:{enabled:false,reason:'Checking provider availability…'}});
  const [pendingBonus,setPendingBonus]=useState<OnlineBonus|null>(null);
  const callbackRef=useRef(callbacks);callbackRef.current=callbacks;
  const authGeneration=useRef(0),authPending=useRef(false),userRef=useRef(user);userRef.current=user;
  const roomRef=useRef<Room|null>(null),started=useRef(''),queue=useRef<Promise<unknown>>(Promise.resolve());
  const acceptRoom=useCallback((next:Room|null)=>{const current=roomRef.current;if(next&&current&&next.code===current.code&&next.seed===current.seed&&(next.sequence<current.sequence||next.serverNow<current.serverNow))return;roomRef.current=next;setRoom(next);if(next?.status==='results'&&current?.status!=='results'||next?.status==='lobby'&&!current){setTab('race');setOpen(true);}if(next&&(next.status==='playing'||next.status==='countdown'&&next.serverNow>=next.startsAt)){const key=`${next.code}:${next.seed}`;if(started.current!==key){started.current=key;setOpen(false);callbackRef.current.onRaceStart(next);}}},[]);
  const refresh=useCallback(async(expectedGeneration?:number)=>{if(authPending.current&&expectedGeneration===undefined)return;const generation=expectedGeneration??authGeneration.current,epoch=sessionEpoch;try{const session=await onlineApi.session();if(generation!==authGeneration.current||epoch!==sessionEpoch)return;setUser(session.user);setProviders(session.providers);setPendingBonus(session.bonus??null);setAvailable(true);setError('');if(session.user){const response=await onlineApi.room();if(generation===authGeneration.current&&epoch===sessionEpoch)acceptRoom(response.room);}else acceptRoom(null);}catch(e){if(generation===authGeneration.current&&epoch===sessionEpoch)throw e;}},[acceptRoom]);
  useEffect(()=>{let alive=true;refresh().then(()=>{if(new URLSearchParams(window.location.search).get('online')==='profile'){setTab('profile');setOpen(true);}}).catch(()=>{if(alive){setAvailable(false);setError('Online service is unavailable. Solo play is still available.');setProviders({facebook:{enabled:false,reason:'Online service unavailable'},instagram:{enabled:false,reason:'Online service unavailable'}});}});return()=>{alive=false;};},[refresh]);
  useEffect(()=>{if(!user)return;const identity=user.id;let disposed=false;const poll=async()=>{if(authPending.current)return;const generation=authGeneration.current,epoch=sessionEpoch;try{const response=await onlineApi.room();if(!disposed&&generation===authGeneration.current&&epoch===sessionEpoch&&userRef.current?.id===identity)acceptRoom(response.room);}catch(e){if(!disposed&&generation===authGeneration.current&&userRef.current?.id===identity)setError(e instanceof Error?e.message:'Connection interrupted.');}};const timer=setInterval(poll,1000);return()=>{disposed=true;clearInterval(timer);};},[user?.id,acceptRoom]);
  useEffect(()=>{if(room?.status!=='countdown')return;const generation=authGeneration.current,epoch=sessionEpoch,identity=userRef.current?.id;let disposed=false;const timer=setTimeout(()=>{if(authPending.current)return;onlineApi.room().then(response=>{if(!disposed&&generation===authGeneration.current&&epoch===sessionEpoch&&userRef.current?.id===identity)acceptRoom(response.room);}).catch(e=>{if(!disposed&&generation===authGeneration.current)setError(e instanceof Error?e.message:'Cannot synchronize the race start.');});},Math.max(0,room.startsAt-room.serverNow));return()=>{disposed=true;clearTimeout(timer);};},[room?.status,room?.startsAt,room?.serverNow,acceptRoom]);
  useEffect(()=>{if(room?.status!=='results')return;const generation=authGeneration.current;void refresh().catch(()=>{if(generation===authGeneration.current)setError('Race results are saved. Reconnect to refresh your profile statistics.');});},[room?.code,room?.seed,room?.status,refresh]);
  const perform=async(work:()=>Promise<unknown>,message='')=>{setBusy(true);setError('');setNotice('');try{await work();if(message)setNotice(message);return true;}catch(e){setError(e instanceof Error?e.message:'Request failed.');return false;}finally{setBusy(false);}};
  const auth=async(mode:'login'|'register',username:string,password:string,displayName:string)=>{const generation=++authGeneration.current;authPending.current=true;try{return await perform(async()=>{await (mode==='login'?onlineApi.login(username,password):onlineApi.register(username,password,displayName));if(generation!==authGeneration.current)return;await refresh(generation);if(generation===authGeneration.current)setTab('profile');},'Signed in.');}finally{if(generation===authGeneration.current)authPending.current=false;}};
  const logout=async()=>{const generation=++authGeneration.current;authPending.current=true;try{return await perform(async()=>{await onlineApi.logout();if(generation!==authGeneration.current)return;acceptRoom(null);started.current='';setUser(null);setPendingBonus(null);setTab('account');await refresh(generation);},'Signed out.');}finally{if(generation===authGeneration.current)authPending.current=false;}};
  const host=(level:number)=>perform(async()=>{const response=await onlineApi.host(level);acceptRoom(response.room);setTab('race');setOpen(true);});
  const join=(code:string)=>perform(async()=>{const response=await onlineApi.join(code.trim().toUpperCase());acceptRoom(response.room);setTab('race');setOpen(true);});
  const start=()=>perform(async()=>{if(roomRef.current)acceptRoom((await onlineApi.start(roomRef.current.code)).room);});
  const next=()=>perform(async()=>{if(roomRef.current)acceptRoom((await onlineApi.next(roomRef.current.code)).room);});
  const leave=()=>perform(async()=>{if(roomRef.current)await onlineApi.leave(roomRef.current.code);acceptRoom(null);started.current='';setOpen(false);callbackRef.current.onMenu();});
  const exit=(destination:'solo'|'menu')=>perform(async()=>{const level=(roomRef.current?.level??1)+1;if(roomRef.current)await onlineApi.leave(roomRef.current.code);acceptRoom(null);started.current='';setOpen(false);if(destination==='solo')callbackRef.current.onSolo(level);else callbackRef.current.onMenu();});
  const reconnect=()=>perform(async()=>{const response=await onlineApi.room();acceptRoom(response.room);if(response.room?.status==='playing'){callbackRef.current.onRaceStart(response.room);setOpen(false);}},'Connection restored.');
  const submitAction=(action:Action,snapshot?:Snapshot):Promise<Room|null>=>{const generation=authGeneration.current,identity=userRef.current?.id;const isCurrent=()=>generation===authGeneration.current&&identity===userRef.current?.id&&!authPending.current;const pending=queue.current.then(async()=>{const current=roomRef.current;if(!isCurrent()||!current||current.status!=='playing')return null;const requestId:string=createRequestId();let result;try{try{result=await onlineApi.action(current.code,current.sequence,action,requestId,snapshot);}catch(e){if(!(e instanceof TypeError))throw e;result=await onlineApi.action(current.code,current.sequence,action,requestId,snapshot);}}catch(e){if(!isCurrent())return null;try{const recovered=await onlineApi.room();if(!isCurrent())return null;acceptRoom(recovered.room);if(recovered.room?.status==='playing')callbackRef.current.onRaceStart(recovered.room);}catch{/* Retain the last confirmed board until the player reconnects. */}throw e;}if(!isCurrent())return null;acceptRoom(result.room);if(!result.accepted)return null;callbackRef.current.onAuthoritative?.(result.room);return result.room;});queue.current=pending.catch(e=>{if(!isCurrent())return;setError(e instanceof Error?e.message:'Action could not be synchronized.');setTab('race');setOpen(true);});return pending;};
  return {user,setUser,room,open,setOpen,tab,setTab,error,busy,notice,available,providers,pendingBonus,setPendingBonus,refresh,perform,auth,logout,host,join,start,next,leave,exit,reconnect,submitAction,show:(nextTab:OnlineTab='account')=>{setTab(nextTab);setOpen(true);}};
}
export type OnlineState=ReturnType<typeof useOnline>;
