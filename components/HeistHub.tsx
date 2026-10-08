import React, {useState} from 'react';
import {dailyChallenge, DISTRICT_NAMES, getMission} from '../game/campaign';
import {COSMETICS, PIECE_STYLES, completedNodes, totalStars, type Career} from '../game/progression';
import type {Preferences} from '../game/preferences';
import {experienceRank} from '../game/experience';

export function PreferencesPanel({value,onChange}:{value:Preferences;onChange:(value:Preferences)=>void}) {
  return <fieldset className="enhancement-settings"><legend>GRAPHICS & ACCESSIBILITY</legend>
    <label>Graphics quality<select aria-label="Graphics quality" value={value.quality} onChange={e=>onChange({...value,quality:e.target.value as Preferences['quality']})}>
      <option value="low">Low · lighter detail</option><option value="medium">Medium · balanced detail</option><option value="high">High · full detail</option>
    </select></label>
    {([['reducedMotion','Reduce motion and flashes'],['keyboard','Keyboard controls'],['hints','Automatic idle hints']] as const).map(([key,label])=>
      <label key={key}><span>{label}</span><input type="checkbox" checked={value[key]} onChange={e=>onChange({...value,[key]:e.target.checked})}/></label>)}
    <p>Arrow keys move focus. Enter selects a token. Shift + arrow swaps. Barriers show remaining shield health.</p>
  </fieldset>;
}
export function HeistHub({career,onClose,onLevel,onDaily,onTutorial,onCosmetic,onPieceStyle,dailyBest}:{career:Career;onClose:()=>void;onLevel:(level:number)=>void;onDaily:()=>void;onTutorial:()=>void;onCosmetic:(id:string)=>void;onPieceStyle:(id:string)=>void;dailyBest:number}) {
  const [tab,setTab]=useState<'campaign'|'daily'|'style'>('campaign');
  const [district,setDistrict]=useState(Math.min(5,Math.floor((career.unlocked-1)/10)));
  const daily=dailyChallenge();
  return <div className="heist-hub" role="dialog" aria-modal="true" aria-labelledby="hub-title">
    <div className="hub-header"><div><p className="eyebrow">YOUR NEXT HEIST</p><h2 id="hub-title">The city is yours to crack.</h2><p>{totalStars(career)} mastery stars · {career.achievements.length} achievements</p><p data-testid="career-xp">Rank {experienceRank(career.xp)} · {career.xp.toLocaleString()} XP · {(1000-career.xp%1000).toLocaleString()} XP to next rank</p></div><button className="cyber-button" onClick={onClose} autoFocus>BACK</button></div>
    <nav className="hub-tabs" aria-label="Heist modes">{(['campaign','daily','style'] as const).map(t=><button key={t} className="cyber-button" aria-pressed={tab===t} onClick={()=>setTab(t)}>{t==='style'?'COSMETICS':t.toUpperCase()}</button>)}</nav>
    {tab==='campaign'&&<><div className="hub-intro"><p>Earn one star for a breach, one for 5+ moves remaining, and one for using no boosters. Every completed campaign run earns booster loot and XP, including replays. Each run pays once. Clear without boosters for extra XP: fewer moves and harder levels increase your multiplier. Every tenth node includes a free booster slot round.</p><button className="cyber-button" onClick={onTutorial}>HACKER TRAINING · 3 LESSONS</button></div>
      <div className="district-selector">{DISTRICT_NAMES.map((n,i)=><button key={n} className="cyber-button" aria-pressed={district===i} onClick={()=>setDistrict(i)}>{n}</button>)}</div>
      <div className="campaign-grid">{Array.from({length:10},(_,i)=>district*10+i+1).map(level=><button key={level} className="mission-card" disabled={level>career.unlocked} onClick={()=>onLevel(level)}>
        <span className="eyebrow">{level%10===0?'SECURITY CORE':'SUBNET'} {level}</span><strong>{getMission(level).label}</strong>
        <span className="stars" aria-label={`${career.stars[level]||0} stars`}>{'★'.repeat(career.stars[level]||0)}{'☆'.repeat(3-(career.stars[level]||0))}</span>
        <span>{level>career.unlocked?'LOCKED':career.stars[level]?`REPLAY · best ${(career.best[level]||0).toLocaleString()}`:'BREACH NODE'}</span>
      </button>)}</div>{career.unlocked>60&&<button className="cyber-button primary" onClick={()=>onLevel(career.unlocked)}>CONTINUE FRONTIER · NODE {career.unlocked}</button>}<p className="hub-note">After node 60, continue through remixed frontier missions at bounded difficulty.</p></>}
    {tab==='daily'&&<div className="daily-card"><p className="eyebrow">SHARED GLOBAL BOARD · {daily.day} UTC</p><h3>One board. One clean escape.</h3><p>{getMission(daily.level).label}</p><p>Everyone starts with the same board, 1 EMP and 1 laser. Campaign inventory stays in your career. Resets at midnight UTC.</p><strong data-testid="daily-best">Your best: {dailyBest.toLocaleString()} points</strong><button className="cyber-button primary" onClick={onDaily}>START DAILY CHALLENGE</button><p className="hub-note">Records are saved on this device. Online rankings require a server that validates moves and scores.</p></div>}
    {tab==='style'&&<><p className="hub-intro">Unlock board palettes and matching hacker auras with mastery stars. Every style has the same gameplay rules. Choose music in Settings.</p><div className="cosmetic-grid">{COSMETICS.map(c=><button className="mission-card" key={c.id} disabled={totalStars(career)<c.need} onClick={()=>onCosmetic(c.id)} aria-pressed={career.cosmetic===c.id}>
      <span className="cosmetic-swatch" style={{background:c.color}}/><strong>{c.name}</strong><span>{c.description}</span><span>{totalStars(career)<c.need?`UNLOCK AT ${c.need} STARS`:career.cosmetic===c.id?'EQUIPPED':'EQUIP'}</span>
    </button>)}</div><h3>Piece collection</h3><p>Win sets by breaching different campaign nodes. Replays improve stars; each node counts once. Your colors, matching rules and special effects stay consistent.</p><div className="cosmetic-grid">{PIECE_STYLES.map(p=><button className="mission-card" key={p.id} disabled={completedNodes(career)<p.need} onClick={()=>onPieceStyle(p.id)} aria-pressed={career.pieceStyle===p.id} aria-label={`${p.name} pieces`}>
      <span className={`piece-preview pieces-${p.id}`} aria-hidden="true">{[0,1,2,3,4].map(t=><i key={t} className={`flat-token kind-${t}`}/>)}</span><strong>{p.name}</strong><span>{p.description}</span><span>{completedNodes(career)<p.need?`BREACH ${p.need} NODES · ${completedNodes(career)}/${p.need}`:career.pieceStyle===p.id?'EQUIPPED':'EQUIP'}</span>
    </button>)}</div><p className="hub-note">Achievements: {career.achievements.join(' · ')||'Complete your first breach to begin.'}</p></>}
  </div>;
}
