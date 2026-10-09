import React from 'react';
import {LESSONS} from '../game/training';
import type {TrainingPerformance} from '../game/training-progress';
export function TrainingAcademy({performance,onStart,onClose}:{performance:TrainingPerformance;onStart:(lesson:number)=>void;onClose:()=>void}) {
  return <div className="heist-hub training-academy" role="dialog" aria-modal="true" aria-labelledby="academy-title" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}if(e.key==='Tab'){const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
    <header className="hub-header"><div><p className="eyebrow">HACKER ACADEMY</p><h2 id="academy-title">Learn every part of the heist.</h2><p>{performance.completedLessons}/{LESSONS.length} lessons completed · {performance.totalAttempts} attempts</p></div><button className="cyber-button" onClick={onClose} autoFocus aria-label="Close training academy">×</button></header>
    <p>Practice with free pieces and boosters. Your campaign inventory and scores stay safe. Replay any lesson, or follow the course in order. Training performance is saved on this device; signed-in results also appear in your profile.</p>
    <button className="cyber-button primary" onClick={()=>onStart(performance.lessons.find(l=>!l.completed)?.lesson||1)}>START GUIDED TRAINING</button>
    <div className="academy-grid">{LESSONS.map((l,i)=>{const result=performance.lessons.find(p=>p.lesson===i+1);return <button className="mission-card" key={l.title} onClick={()=>onStart(i+1)}><span className="eyebrow">LESSON {i+1} · {result?.completed?'COMPLETED':'PRACTICE'}</span><strong>{l.title}</strong><span>{l.goal}</span><span>{result?.attempts||0} attempts · best {result?.bestMoves===null||result?.bestMoves===undefined?'—':result.bestMoves} moves · {result?.bestMistakes??'—'} mistakes</span></button>;})}</div>
  </div>;
}
