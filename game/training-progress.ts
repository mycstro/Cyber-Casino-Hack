export interface LessonPerformance {lesson:number;completed:boolean;attempts:number;completions:number;bestMoves:number|null;lastMoves:number|null;bestMistakes?:number|null;lastMistakes?:number|null;totalMistakes?:number}
export interface TrainingPerformance {lessons:LessonPerformance[];completedLessons:number;totalAttempts:number}
export function readTraining(raw:string|null,count:number):TrainingPerformance {
  let data:any;try{data=JSON.parse(raw||'{}');}catch{}
  const lessons=Array.from({length:count},(_,i)=>{
    const x=Array.isArray(data?.lessons)?data.lessons.find((v:any)=>v?.lesson===i+1):undefined;
    const integer=(v:any)=>Number.isSafeInteger(v)&&v>=0&&v<=100000?v:0;
    return {lesson:i+1,completed:x?.completed===true,attempts:integer(x?.attempts),completions:integer(x?.completions),bestMoves:Number.isSafeInteger(x?.bestMoves)&&x.bestMoves>=0?x.bestMoves:null,lastMoves:Number.isSafeInteger(x?.lastMoves)&&x.lastMoves>=0?x.lastMoves:null,bestMistakes:Number.isSafeInteger(x?.bestMistakes)&&x.bestMistakes>=0?x.bestMistakes:null,lastMistakes:integer(x?.lastMistakes),totalMistakes:integer(x?.totalMistakes)};
  });
  return {lessons,completedLessons:lessons.filter(l=>l.completed).length,totalAttempts:lessons.reduce((sum,l)=>sum+l.attempts,0)};
}
export function recordTraining(previous:TrainingPerformance,lesson:number,moves:number,completed:boolean,mistakes=0):TrainingPerformance {
  const lessons=previous.lessons.map(l=>l.lesson!==lesson?l:{...l,completed:l.completed||completed,attempts:l.attempts+1,completions:l.completions+Number(completed),lastMoves:moves,bestMoves:completed?Math.min(l.bestMoves??moves,moves):l.bestMoves,lastMistakes:mistakes,totalMistakes:(l.totalMistakes||0)+mistakes,bestMistakes:completed?Math.min(l.bestMistakes??mistakes,mistakes):l.bestMistakes});
  return {lessons,completedLessons:lessons.filter(l=>l.completed).length,totalAttempts:lessons.reduce((sum,l)=>sum+l.attempts,0)};
}

export interface PendingTrainingResult {lesson:number;moves:number;completed:boolean;mistakes:number;requestId:string}
export const trainingQueueKey=(accountId:string)=>`cyber_casino_training_pending_${accountId}`;
export function readPendingTraining(raw:string|null,count:number):PendingTrainingResult[] {
  let data:unknown;try{data=JSON.parse(raw||'[]');}catch{return [];}
  if(!Array.isArray(data))return [];
  const ids=new Set<string>();
  return data.filter((r):r is PendingTrainingResult=>{
    if(!r||typeof r.requestId!=='string'||! /^[a-zA-Z0-9_-]{1,100}$/.test(r.requestId)||ids.has(r.requestId)||!Number.isInteger(r.lesson)||r.lesson<1||r.lesson>count||!Number.isInteger(r.moves)||r.moves<0||r.moves>1000||typeof r.completed!=='boolean'||!Number.isInteger(r.mistakes??0)||(r.mistakes??0)<0||(r.mistakes??0)>10000)return false;
    ids.add(r.requestId);return true;
  }).map(r=>({...r,mistakes:r.mistakes??0}));
}
/** Only the current account's outstanding receipts augment its server profile. */
export function pendingTrainingPerformance(server:TrainingPerformance,pending:PendingTrainingResult[]):TrainingPerformance {
  return pending.reduce((p,r)=>recordTraining(p,r.lesson,r.moves,r.completed,r.mistakes),server);
}
export interface TrainingSyncOptions<T extends {id:string}> {
  count:number;read:(key:string)=>string|null;write:(key:string,value:PendingTrainingResult[])=>boolean;
  post:(result:PendingTrainingResult)=>Promise<T>;isCurrent:(accountId:string)=>boolean;
  onProfile:(profile:T)=>void;onQueueChanged:()=>void;
}
/** Serialize requests per account and re-read the queue after every acknowledgement. */
export class TrainingQueueSync<T extends {id:string}> {
  private running=new Map<string,Promise<void>>();
  flush(accountId:string,options:TrainingSyncOptions<T>):Promise<void> {
    const running=this.running.get(accountId);if(running)return running;
    const run=this.drain(accountId,options).finally(()=>{if(this.running.get(accountId)===run)this.running.delete(accountId);});
    this.running.set(accountId,run);return run;
  }
  private async drain(accountId:string,o:TrainingSyncOptions<T>):Promise<void> {
    const key=trainingQueueKey(accountId);
    while(o.isCurrent(accountId)){
      const first=readPendingTraining(o.read(key),o.count)[0];if(!first)return;
      const profile=await o.post(first);
      if(profile.id!==accountId)throw new Error('Training response belongs to another account');
      // New attempts may have been added while the request was in flight.
      const remaining=readPendingTraining(o.read(key),o.count).filter(r=>r.requestId!==first.requestId);
      if(!o.write(key,remaining))throw new Error('Cannot persist the training acknowledgement');
      o.onQueueChanged();
      if(o.isCurrent(accountId))o.onProfile(profile);
    }
  }
}
