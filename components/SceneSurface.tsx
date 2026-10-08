import React,{useCallback,useState} from 'react';

function hasWebGL2() {
  try {
    const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2',{failIfMajorPerformanceCaveat:false});
    if(!gl)return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();return true;
  }catch{return false;}
}

class SceneBoundary extends React.Component<{children:React.ReactNode;fallback:React.ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}

/** Keep game state outside the GPU surface so context loss never destroys a heist. */
export function SceneSurface({children,fallback,decorative=false}:{children:(onLost:()=>void)=>React.ReactNode;fallback:React.ReactNode;decorative?:boolean}) {
  const [supported,setSupported]=useState(hasWebGL2),[attempt,setAttempt]=useState(0);
  const onLost=useCallback(()=>setSupported(false),[]);
  const recovery=<div className="scene-fallback">{fallback}{!decorative&&<button className="renderer-retry" onClick={()=>{setSupported(hasWebGL2());setAttempt(n=>n+1);}}>Retry 3D visuals</button>}</div>;
  if(!supported)return recovery;
  return <SceneBoundary key={attempt} fallback={recovery}>{children(onLost)}</SceneBoundary>;
}
