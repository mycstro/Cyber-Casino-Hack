import React,{useEffect,useRef,useState} from 'react';
import type {GridTile,FloatingText,ShockwaveRing,LaserBeam} from '../types';

const names=['Diamond','Chip','Coin','Circuit','Core'];
/** A DOM surface shares the same engine and controls when GPU rendering is unavailable. */
export function FlatBoard({tiles,rows,cols,selected,hints,onTile,particles,rings,texts,beams,pieceStyle='classic',motion='traffic'}: {
  tiles:GridTile[];rows:number;cols:number;selected:string;hints:string[];onTile:(e:any,r:number,c:number)=>void;
  particles:any[];rings:ShockwaveRing[];texts:FloatingText[];beams:LaserBeam[];pieceStyle?:string;motion?:string;
}) {
  const host=useRef<HTMLDivElement>(null),[side,setSide]=useState(1);
  useEffect(()=>{
    const measure=()=>{const r=host.current;if(r)setSide(Math.max(1,Math.min(r.clientWidth,r.clientHeight)*.94));};
    measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);
    if(host.current)observer?.observe(host.current);window.addEventListener('resize',measure);
    return()=>{observer?.disconnect();window.removeEventListener('resize',measure);};
  },[]);
  const point=(x:number,y:number)=>({left:`${50+x/(cols*1.15)*100}%`,top:`${50-y/(rows*1.15)*100}%`});
  return <div ref={host} className="flat-city"><div className={`chapter-fallback motion-${motion}`} aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div><div className={`flat-board pieces-${pieceStyle}`} data-testid="flat-board" style={{width:side,height:side,aspectRatio:`${cols}/${rows}`}}>
    {tiles.map(t=><button key={t.id} className={`flat-tile ${selected===`${t.row},${t.col}`||hints.includes(`${t.row},${t.col}`)?'focused':''}`}
      aria-label={`Row ${t.row+1} column ${t.col+1}: ${t.packet?'Data packet':t.vault?'Vault':names[t.type]}${t.locked?` shield ${t.lockHealth}`:''}${t.special==='lineCross'?' Cross Laser':''}`}
      style={{...point(t.targetX,t.targetY),width:`${100/cols}%`,height:`${100/rows}%`,transform:`translate(-50%,-50%) scale(${t.scale})`}}
      tabIndex={-1} onPointerDown={e=>onTile(e,t.row,t.col)}>
      <span className={`flat-token kind-${t.type} special-${t.special} ${t.locked?'shielded':''} ${t.packet?'packet':''} ${t.vault?'vault':''}`}/>
      {t.locked&&<span className="flat-health">{t.obstacleType==='lock'?'LOCK ':''}{t.lockHealth}</span>}{t.packet&&<span className="flat-health">↓</span>}
    </button>)}
    <div className="flat-effects" aria-hidden="true">
      {particles.map(p=><i key={p.id} style={{...point(p.x,p.y),background:p.color,opacity:Math.max(0,p.life/p.maxLife),transform:`rotate(${p.rotation||0}rad)`}}/>)}
      {rings.map(r=><span className="flat-ring" key={r.id} style={{...point(r.x,r.y),width:`${r.radius*2/(cols*1.15)*100}%`,aspectRatio:'1',borderColor:r.color,opacity:r.life/r.maxLife}}/>)}
      {texts.map(t=><strong key={t.id} style={{...point(t.x,t.y),color:t.color,opacity:t.life/t.maxLife}}>{t.text}</strong>)}
      {beams.map(b=><span key={b.id} className={`flat-beam ${b.type==='col'?'vertical':''}`} style={{...point(b.startX,b.startY),background:b.color,opacity:b.life/b.maxLife}}/>)}
    </div>
  </div></div>;
}
