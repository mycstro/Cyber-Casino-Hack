import {describe,it,expect,vi} from 'vitest';
import {readTraining,recordTraining,readPendingTraining,pendingTrainingPerformance,TrainingQueueSync,trainingQueueKey,type PendingTrainingResult} from '../game/training-progress';
describe('training performance',()=>{
  it('migrates the curriculum and preserves completed lessons',()=>{const p=recordTraining(readTraining(null,3),2,3,true);const next=readTraining(JSON.stringify(p),18);expect(next.lessons).toHaveLength(18);expect(next.completedLessons).toBe(1);expect(next.lessons[1].bestMoves).toBe(3);});
  it('counts retries without losing a successful best',()=>{let p=readTraining(null,18);p=recordTraining(p,1,4,true,3);p=recordTraining(p,1,1,true,1);p=recordTraining(p,1,7,false,5);expect(p.lessons[0]).toMatchObject({attempts:3,completions:2,bestMoves:1,lastMoves:7,completed:true,bestMistakes:1,lastMistakes:5,totalMistakes:9});expect(p.totalAttempts).toBe(3);expect(p.completedLessons).toBe(1);});
  it('discards corrupt and negative saved metrics',()=>{const p=readTraining('{"lessons":[{"lesson":1,"attempts":-1,"bestMoves":"bad"}]}',18);expect(p.lessons[0].attempts).toBe(0);expect(p.lessons[0].bestMoves).toBeNull();expect(readTraining('oops',18).totalAttempts).toBe(0);expect(readTraining('{"lessons":{}}',22).lessons).toHaveLength(22);});
});

describe('account-scoped offline training synchronization',()=>{
  const result=(id:string,lesson=1):PendingTrainingResult=>({requestId:id,lesson,moves:1,completed:true,mistakes:2});
  function harness(){
    const storage=new Map<string,string>();let current='account-a';const profiles:{id:string;training:ReturnType<typeof readTraining>}[]=[];
    const options={count:22,read:(key:string)=>storage.get(key)||null,write:(key:string,value:PendingTrainingResult[])=>{storage.set(key,JSON.stringify(value));return true;},isCurrent:(id:string)=>id===current,onProfile:(p:{id:string;training:ReturnType<typeof readTraining>})=>profiles.push(p),onQueueChanged:vi.fn()};
    return {storage,options,profiles,switchTo:(id:string)=>{current=id;}};
  }
  it('shows queued completions while preserving the server baseline and keeping another account separate',()=>{
    const h=harness(),a=readTraining(null,22),b=recordTraining(readTraining(null,22),2,3,true);
    h.options.write(trainingQueueKey('account-a'),[result('receipt-a')]);h.options.write(trainingQueueKey('account-b'),[result('receipt-b',3)]);
    const view=pendingTrainingPerformance(a,readPendingTraining(h.options.read(trainingQueueKey('account-a')),22));
    expect(view.completedLessons).toBe(1);expect(view.lessons[0].bestMistakes).toBe(2);expect(a.completedLessons).toBe(0);
    const other=pendingTrainingPerformance(b,readPendingTraining(h.options.read(trainingQueueKey('account-b')),22));expect(other.completedLessons).toBe(2);expect(other.lessons[0].completed).toBe(false);
  });
  it('serializes concurrent flushes, consumes attempts appended during a request and never applies a stale profile',async()=>{
    const h=harness();h.options.write(trainingQueueKey('account-a'),[result('one')]);let release!:(p:{id:string;training:ReturnType<typeof readTraining>})=>void;
    let profile=readTraining(null,22),calls=0;const post=vi.fn((r:PendingTrainingResult)=>{profile=recordTraining(profile,r.lesson,r.moves,r.completed,r.mistakes);return ++calls===1?new Promise<{id:string;training:ReturnType<typeof readTraining>}>(resolve=>release=resolve):Promise.resolve({id:'account-a',training:profile});});
    const sync=new TrainingQueueSync<{id:string;training:ReturnType<typeof readTraining>}>(),options={...h.options,post};const first=sync.flush('account-a',options);
    h.options.write(trainingQueueKey('account-a'),[result('one'),result('two',2)]);const duplicate=sync.flush('account-a',options);expect(duplicate).toBe(first);expect(post).toHaveBeenCalledTimes(1);
    release({id:'account-a',training:profile});await first;expect(post).toHaveBeenCalledTimes(2);expect(h.profiles.map(p=>p.training.completedLessons)).toEqual([1,2]);expect(readPendingTraining(h.options.read(trainingQueueKey('account-a')),22)).toEqual([]);
  });
  it('keeps a failed receipt available for reconnect retry and acknowledges it once',async()=>{
    const h=harness();h.options.write(trainingQueueKey('account-a'),[result('retry')]);const sync=new TrainingQueueSync<{id:string}>(),post=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({id:'account-a'});
    const options={...h.options,onProfile:vi.fn(),post};await expect(sync.flush('account-a',options)).rejects.toThrow('offline');expect(readPendingTraining(h.options.read(trainingQueueKey('account-a')),22)).toHaveLength(1);
    await sync.flush('account-a',options);expect(options.onProfile).toHaveBeenCalledTimes(1);expect(post.mock.calls.map(([r])=>r.requestId)).toEqual(['retry','retry']);expect(readPendingTraining(h.options.read(trainingQueueKey('account-a')),22)).toEqual([]);
  });
  it('does not apply an old account response after an account switch or submit its remaining receipts as the new account',async()=>{
    const h=harness();h.options.write(trainingQueueKey('account-a'),[result('one'),result('two',2)]);let release!:(p:{id:string;training:ReturnType<typeof readTraining>})=>void;
    const post=vi.fn(()=>new Promise<{id:string;training:ReturnType<typeof readTraining>}>(resolve=>release=resolve)),sync=new TrainingQueueSync<{id:string;training:ReturnType<typeof readTraining>}>();const pending=sync.flush('account-a',{...h.options,post});h.switchTo('account-b');release({id:'account-a',training:readTraining(null,22)});await pending;
    expect(h.profiles).toEqual([]);expect(post).toHaveBeenCalledTimes(1);expect(readPendingTraining(h.options.read(trainingQueueKey('account-a')),22).map(r=>r.requestId)).toEqual(['two']);
  });
  it('rejects mismatched account responses and corrupt or duplicate queued receipts',async()=>{
    const h=harness();h.options.write(trainingQueueKey('account-a'),[result('one')]);const sync=new TrainingQueueSync<{id:string}>();await expect(sync.flush('account-a',{...h.options,onProfile:vi.fn(),post:async()=>({id:'account-b'})})).rejects.toThrow('another account');expect(readPendingTraining(h.options.read(trainingQueueKey('account-a')),22)).toHaveLength(1);
    expect(readPendingTraining(JSON.stringify([result('one'),result('one'),{...result('bad'),lesson:23},{...result('bad2'),moves:-1}]),22)).toHaveLength(1);expect(readPendingTraining('bad',22)).toEqual([]);
  });
});
