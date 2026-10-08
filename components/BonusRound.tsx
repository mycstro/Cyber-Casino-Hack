import React,{useEffect,useRef,useState} from 'react';
import {SLOT_PRIZES,slotPrize,type BonusRound as Round} from '../game/bonus';
import {gameAudio} from '../utils/helper';

export function BonusRound({round,reducedMotion,onSpin,onContinue}:{round:Round;reducedMotion:boolean;onSpin:()=>boolean;onContinue:()=>boolean}) {
  const [phase,setPhase]=useState<'ready'|'spinning'|'won'>(round.claimed?'won':'ready');
  const [tick,setTick]=useState(0),started=useRef(0);
  const [error,setError]=useState('');
  const host=useRef<HTMLElement>(null);
  const prize=slotPrize(round.booster);
  useEffect(()=>{const id=setTimeout(()=>host.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(),0);return()=>clearTimeout(id);},[phase]);
  useEffect(()=>{
    if(phase!=='spinning')return;
    const interval=setInterval(()=>{const elapsed=performance.now()-started.current;setTick(n=>n+1);if(elapsed>(reducedMotion?250:2100)){setPhase('won');gameAudio.playVictoryFanfare();}else if(!reducedMotion)gameAudio.playHoverMicroTone();},reducedMotion?125:100);
    return()=>clearInterval(interval);
  },[phase,reducedMotion]);
  const elapsed=performance.now()-started.current;
  return <div className="bonus-overlay"><section ref={host} className="bonus-machine" role="dialog" aria-modal="true" aria-labelledby="bonus-title" data-testid="bonus-round" data-phase={phase} onKeyDown={e=>{if(e.key==='Tab'){e.preventDefault();host.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();}}}>
    <p className="eyebrow">LEVEL {round.level} CLEARED · FREE MILESTONE ROUND</p>
    <h2 id="bonus-title">BOOSTER JACKPOT</h2><p>One free spin. Three matching boosters. Every spin wins.</p>
    <div className="slot-reels" aria-label="Three booster reels">{[0,1,2].map(i=>{
      const settled=phase==='won'||(phase==='spinning'&&(reducedMotion||elapsed>1100+i*400));
      const symbol=settled?prize:SLOT_PRIZES[(tick+i*2)%5];
      return <div key={i} className={`slot-reel ${phase==='spinning'&&!settled?'rolling':''}`} style={{color:symbol.color}} data-booster={symbol.booster} aria-label={`Reel ${i+1}: ${symbol.name}`}><span aria-hidden="true">{symbol.icon}</span><strong>{symbol.name}</strong></div>;
    })}</div>
    <div className="slot-result" role="status" aria-live="polite">{phase==='won'?<><strong>THREE MATCHED · +{prize.amount} {prize.name}</strong><span>Power {prize.power}/5 · added to your booster inventory</span></>:phase==='spinning'?<strong>MATCHING YOUR REELS…</strong>:<><strong>YOUR FREE SPIN IS READY</strong><span>Higher power means a smaller quantity.</span></>}</div>
    {error&&<p role="alert" className="text-amber-300">{error}</p>}
    {phase==='won'?<button className="cyber-button primary" autoFocus onClick={()=>{if(!onContinue())setError('Cannot save completion. Free browser storage, then retry. Your saved reward will not be paid twice.');}}>CONTINUE TO LEVEL {round.level+1}</button>:<button className="cyber-button primary" autoFocus disabled={phase==='spinning'} onClick={()=>{if(phase!=='ready')return;if(!onSpin()){setError('Cannot save this spin. Free browser storage, then retry.');return;}setError('');started.current=performance.now();setPhase('spinning');gameAudio.playConfirmSelect();}}> {phase==='spinning'?'SPINNING…':'SPIN FREE BONUS'}</button>}
    <div className="slot-paytable"><h3>WINNING MATCHES</h3>{SLOT_PRIZES.map(p=><div key={p.booster}><span style={{color:p.color}} aria-hidden="true">{p.icon}</span><span>{p.name}<small>Power {p.power}/5</small></span><strong>×{p.amount}</strong></div>)}</div>
  </section></div>;
}
