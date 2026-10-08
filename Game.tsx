// tslint:disable
/* eslint-disable */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {Html} from '@react-three/drei/web/Html';
import {getConfig} from './constants';
import {
  BoosterType,
  CyberDistrict,
  FloatingText,
  GridTile,
  LaserBeam,
  ObstacleType,
  ShockwaveRing,
  TileSpecial,
} from './types';
import {gameAudio} from './utils/helper';
import {findBoardMatches, hasBoardMove, recoverBoard,crossLines} from './game/board';
import {GameRun} from './game/run';
import {boardCameraDistance} from './game/camera';

// ============================================================================
// DYNAMIC ENDLESS LEVEL & TIER GENERATOR (NO LEVEL CAP)
// ============================================================================

import {getDistrictForLevel} from './game/campaign';
export {getDistrictForLevel} from './game/campaign';
import {HeistEngine, TOKEN_NAMES, type Action, type Snapshot, type Frame} from './game/engine';
import type {Preferences} from './game/preferences';
import {pixelDensity,RenderBudget,RenderClock} from './game/rendering';
import {SceneSurface} from './components/SceneSurface';
import {FlatBoard} from './components/FlatBoard';
import {hazardName} from './game/hazards';
import {themeForLevel,type SceneTheme} from './game/themes';
import {lesson,trainingSwap} from './game/training';
const PiecesContext=React.createContext('classic');
const MotionContext = React.createContext(false);
const DetailContext = React.createContext<Preferences['quality']>('medium');
function detailSegments(value:number,quality:Preferences['quality']) {return Math.max(6,Math.round(value*(quality==='low'?.5:quality==='medium'?.75:1)));}
function DetailSphere({args}: {args:ConstructorParameters<typeof THREE.SphereGeometry>}) {
  const q=React.useContext(DetailContext);return <sphereGeometry args={[args[0],detailSegments(args[1]||16,q),detailSegments(args[2]||12,q),args[3],args[4],args[5],args[6]]}/>;
}
function DetailTorus({args}: {args:ConstructorParameters<typeof THREE.TorusGeometry>}) {
  const q=React.useContext(DetailContext);return <torusGeometry args={[args[0],args[1],detailSegments(args[2]||8,q),detailSegments(args[3]||24,q),args[4]]}/>;
}
function useSceneFrame(callback: Parameters<typeof useFrame>[0]) {
  const stopped = React.useContext(MotionContext);
  useFrame((state,delta) => {if (!stopped) callback(state,delta);});
}

const TOKEN_COLORS = [
  '#00e5ff',
  '#ff0077',
  '#ffb700',
  '#00ff66',
  '#b026ff',
];

const CELL_SIZE = 1.15;

const scratchVec3A = new THREE.Vector3();
const scratchVec3B = new THREE.Vector3();

export type CameraMode = '3d-angled' | 'cinematic' | 'top-down';

export type HackerAction =
  | 'idle'
  | 'typing'
  | 'celebrate'
  | 'blast'
  | 'glitch'
  | 'tense';

export interface RichParticle {
  id: string;
  type: 'firework' | 'stardust' | 'splash' | 'spark' | 'ice_shard' | 'data_bit' | 'emp_spark' | 'void_dust';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  rotSpeed?: number;
  rotation?: number;
  rotX?: number;
  rotY?: number;
}

function useAnimatedBillboardTexture(type: 'casino' | 'matrix' | 'warning') {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const [texture,setTexture]=useState<THREE.CanvasTexture|null>(null);
  const quality=React.useContext(DetailContext),stopped=React.useContext(MotionContext),lastPaint=useRef(-1);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = quality==='low'?256:quality==='medium'?384:512;
    canvas.height = canvas.width/2;
    canvasRef.current = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    textureRef.current = tex;
    lastPaint.current=-1;setTexture(tex);

    return () => {
      tex.dispose();
    };
  }, [quality]);

  useFrame(({clock}) => {
    const canvas = canvasRef.current;
    const tex = textureRef.current;
    if (!canvas || !tex) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const t = clock.getElapsedTime();
    if(lastPaint.current>=0&&(stopped||t-lastPaint.current<1/(quality==='low'?12:quality==='medium'?18:24)))return;
    lastPaint.current=t;ctx.setTransform(canvas.width/512,0,0,canvas.height/256,0,0);

    ctx.fillStyle = '#050a18';
    ctx.fillRect(0, 0, 512, 256);

    if (type === 'casino') {
      ctx.fillStyle = '#ff0077';
      ctx.font = 'bold 34px monospace';
      ctx.fillText('NEO-VEGAS 777', 30, 60);

      ctx.fillStyle = '#00f7ff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('QUANTUM MATRIX JACKPOT', 30, 100);

      for (let i = 0; i < 5; i++) {
        const h = Math.abs(Math.sin(t * 4 + i)) * 80 + 20;
        ctx.fillStyle = i % 2 === 0 ? '#ffe600' : '#00ff66';
        ctx.fillRect(40 + i * 85, 220 - h, 65, h);
      }
    } else if (type === 'matrix') {
      ctx.fillStyle = '#00ff66';
      ctx.font = '15px monospace';
      for (let col = 0; col < 16; col++) {
        const charY = ((t * 120 + col * 40) % 240) + 20;
        const hex = Math.floor(Math.sin(t + col) * 89999 + 10000).toString(16).toUpperCase();
        ctx.fillText(`0x${hex}`, col * 32, charY);
      }
      ctx.fillStyle = '#00f7ff';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('MULTI-TIER GRID: ACTIVE', 20, 240);
    } else {
      const flash = Math.sin(t * 8) > 0;
      ctx.fillStyle = flash ? '#ff0044' : '#66001a';
      ctx.fillRect(0, 0, 512, 256);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('! CYBER INTRUSION !', 35, 90);

      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('SECURITY SUBROUTINES ACTIVE', 35, 145);
      ctx.fillText(`NETWORK INTEGRITY: [${Math.max(12, 99 - (Math.floor(t * 10) % 80))}%]`, 35, 185);
    }

    tex.needsUpdate = true;
  });

  return texture;
}

function AnimatedBillboard({
  position,
  rotation,
  type,
  size = [4, 2],
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  type: 'casino' | 'matrix' | 'warning';
  size?: [number, number];
}) {
  const texture = useAnimatedBillboardTexture(type);

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[size[0] + 0.3, size[1] + 0.3, 0.2]} />
        <meshStandardMaterial color="#0b132b" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh>
        <planeGeometry args={[size[0], size[1]]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshStandardMaterial color="#00f7ff" emissive="#00f7ff" emissiveIntensity={1} />
        )}
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[size[0] + 0.1, size[1] + 0.1]} />
        <meshStandardMaterial
          color={type === 'warning' ? '#ff0044' : '#00f7ff'}
          emissive={type === 'warning' ? '#ff0044' : '#00f7ff'}
          emissiveIntensity={2.5}
          wireframe
        />
      </mesh>
    </group>
  );
}

function FlyingCyberTraffic() {
  const cars = useMemo(() => {
    return Array.from({length: 14}).map((_, i) => ({
      id: i,
      speed: 5 + (i % 5) * 2.5,
      y: -3.5 + (i % 4) * 2.2 + Math.random() * 0.5,
      z: -11 - (i % 3) * 3.5,
      dir: i % 2 === 0 ? 1 : -1,
      color: i % 3 === 0 ? '#00f7ff' : i % 3 === 1 ? '#ff0077' : '#ffe600',
      offset: (i / 14) * 48 - 24,
    }));
  }, []);

  const groupRef = useRef<THREE.Group>(null);

  useSceneFrame(({clock}) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const car = cars[i];
      if (!car) return;
      const range = 56;
      let x = (car.offset + car.dir * t * car.speed) % range;
      if (x > range / 2) x -= range;
      if (x < -range / 2) x += range;
      child.position.x = x;
      child.position.y = car.y + Math.sin(t * 2 + i) * 0.15;
    });
  });

  return (
    <group ref={groupRef}>
      {cars.map((car) => (
        <group
          key={car.id}
          position={[car.offset, car.y, car.z]}
          rotation={[0, car.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <mesh>
            <boxGeometry args={[0.55, 0.24, 1.3]} />
            <meshStandardMaterial
              color="#050814"
              emissive={car.color}
              emissiveIntensity={0.9}
              metalness={0.9}
            />
          </mesh>
          <mesh position={[0.16, 0, -0.65]}>
            <DetailSphere args={[0.07, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3} />
          </mesh>
          <mesh position={[-0.16, 0, -0.65]}>
            <DetailSphere args={[0.07, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3} />
          </mesh>
          <mesh position={[0, 0, 0.7]}>
            <boxGeometry args={[0.42, 0.09, 0.2]} />
            <meshStandardMaterial color="#ff0044" emissive="#ff0044" emissiveIntensity={4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DigitalRainParticles() {
  const particleCount = 40;
  const particles = useMemo(() => {
    return Array.from({length: particleCount}).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 26,
      y: (Math.random() - 0.5) * 18,
      z: -4 - Math.random() * 9,
      speed: 1.5 + Math.random() * 3.5,
      color: i % 4 === 0 ? '#ff0077' : i % 3 === 0 ? '#00e5ff' : '#00ff66',
      size: 0.12 + Math.random() * 0.16,
    }));
  }, []);

  const groupRef = useRef<THREE.Group>(null);

  useSceneFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, idx) => {
      const p = particles[idx];
      if (!p) return;
      child.position.y -= p.speed * delta;
      if (child.position.y < -9) {
        child.position.y = 9;
        child.position.x = (Math.random() - 0.5) * 26;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {particles.map((p) => (
        <group key={p.id} position={[p.x, p.y, p.z]}>
          <mesh>
            <boxGeometry args={[p.size * 0.25, p.size * 1.8, 0.05]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={p.color}
              emissiveIntensity={3.2}
              transparent
              opacity={0.7}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FloatingHoloDisplays({district}: {district: CyberDistrict}) {
  const leftDisplayRef = useRef<THREE.Group>(null);
  const rightDisplayRef = useRef<THREE.Group>(null);

  useSceneFrame(({clock}) => {
    const t = clock.getElapsedTime();
    if (leftDisplayRef.current) {
      leftDisplayRef.current.position.y = 0.6 + Math.sin(t * 1.8) * 0.12;
      leftDisplayRef.current.rotation.y = 0.55 + Math.cos(t * 1.2) * 0.04;
    }
    if (rightDisplayRef.current) {
      rightDisplayRef.current.position.y = 0.6 + Math.cos(t * 1.6) * 0.12;
      rightDisplayRef.current.rotation.y = -0.55 + Math.sin(t * 1.1) * 0.04;
    }
  });

  return (
    <group name="holograms">
      <group ref={leftDisplayRef} position={[-6.2, 0.6, 0.2]}>
        <mesh>
          <planeGeometry args={[1.8, 2.4]} />
          <meshStandardMaterial
            color="#05152b"
            emissive={district.accentColor}
            emissiveIntensity={0.8}
            transparent
            opacity={0.65}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[1.7, 2.3]} />
          <meshStandardMaterial
            color="#00f7ff"
            emissive="#00f7ff"
            emissiveIntensity={1.8}
            wireframe
            transparent
            opacity={0.4}
          />
        </mesh>
        {[-0.6, -0.3, 0, 0.3, 0.6].map((y, idx) => (
          <mesh key={idx} position={[-0.4, y, 0.04]}>
            <boxGeometry args={[0.6 + (idx % 3) * 0.3, 0.08, 0.02]} />
            <meshStandardMaterial color="#ffffff" emissive={district.accentColor} emissiveIntensity={3} />
          </mesh>
        ))}
      </group>

      <group ref={rightDisplayRef} position={[6.2, 0.6, 0.2]}>
        <mesh>
          <planeGeometry args={[1.8, 2.4]} />
          <meshStandardMaterial
            color="#1b0826"
            emissive="#ff0077"
            emissiveIntensity={0.8}
            transparent
            opacity={0.65}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[1.7, 2.3]} />
          <meshStandardMaterial
            color="#ff0077"
            emissive="#ff0077"
            emissiveIntensity={1.8}
            wireframe
            transparent
            opacity={0.4}
          />
        </mesh>
        {[-0.5, -0.1, 0.3, 0.7].map((y, idx) => (
          <mesh key={idx} position={[0.3, y, 0.04]}>
            <boxGeometry args={[0.8, 0.09, 0.02]} />
            <meshStandardMaterial color="#ffffff" emissive="#ff0077" emissiveIntensity={3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function SecuritySentinelDrone({comboStreak}: {comboStreak: number}) {
  const droneRef = useRef<THREE.Group>(null);
  const ringRef1 = useRef<THREE.Mesh>(null);
  const ringRef2 = useRef<THREE.Mesh>(null);

  useSceneFrame(({clock}, delta) => {
    const t = clock.getElapsedTime();
    if (!droneRef.current) return;

    const baseSpeed = comboStreak > 1 ? 2.5 : 1.2;
    droneRef.current.position.x = 5.2 + Math.sin(t * baseSpeed) * 0.6;
    droneRef.current.position.y = 3.8 + Math.cos(t * 1.8) * 0.3;
    droneRef.current.position.z = 1.0 + Math.sin(t * 2.2) * 0.4;
    droneRef.current.rotation.y = Math.sin(t * 1.5) * 0.4 - 0.4;

    if (ringRef1.current) ringRef1.current.rotation.z += delta * 4;
    if (ringRef2.current) ringRef2.current.rotation.x += delta * 3.5;
  });

  return (
    <group name="sentinel" ref={droneRef} position={[5.2, 3.8, 1.0]}>
      <mesh>
        <DetailSphere args={[0.32, 16, 16]} />
        <meshStandardMaterial color="#0b1124" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.22]}>
        <DetailSphere args={[0.14, 12, 12]} />
        <meshStandardMaterial
          color="#ff0044"
          emissive={comboStreak > 1 ? '#ffe600' : '#ff0044'}
          emissiveIntensity={4.5}
        />
      </mesh>
      <mesh ref={ringRef1}>
        <DetailTorus args={[0.55, 0.035, 8, 24]} />
        <meshStandardMaterial color="#00f7ff" emissive="#00f7ff" emissiveIntensity={2.5} />
      </mesh>
      <mesh ref={ringRef2} rotation={[Math.PI / 3, 0, 0]}>
        <DetailTorus args={[0.65, 0.03, 8, 24]} />
        <meshStandardMaterial color="#ff0077" emissive="#ff0077" emissiveIntensity={2.5} />
      </mesh>
      <pointLight
        color={comboStreak > 1 ? '#ffe600' : '#00f7ff'}
        intensity={comboStreak > 1 ? 35 : 18}
        distance={6}
        decay={1.6}
      />
    </group>
  );
}

function HolographicFloorPlatform({accentColor}: {accentColor: string}) {
  const ring1 = useRef<THREE.Group>(null);
  const ring2 = useRef<THREE.Group>(null);
  const ring3 = useRef<THREE.Group>(null);

  useSceneFrame((_, delta) => {
    if (ring1.current) ring1.current.rotation.z += delta * 0.4;
    if (ring2.current) ring2.current.rotation.z -= delta * 0.6;
    if (ring3.current) ring3.current.rotation.z += delta * 0.25;
  });

  return (
    <group name="floor" position={[0, -0.2, -0.6]}>
      <group ref={ring1}>
        <mesh>
          <ringGeometry args={[6.2, 6.4, 64]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={accentColor}
            emissiveIntensity={2.8}
            side={THREE.DoubleSide}
          />
        </mesh>
        {Array.from({length: 16}).map((_, i) => {
          const angle = (i / 16) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 6.3, Math.sin(angle) * 6.3, 0.02]}
              rotation={[0, 0, angle]}>
              <boxGeometry args={[0.3, 0.08, 0.02]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3.5} />
            </mesh>
          );
        })}
      </group>

      <group ref={ring2}>
        <mesh>
          <ringGeometry args={[5.2, 5.35, 48]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ff0077"
            emissiveIntensity={2.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      <group ref={ring3}>
        <mesh>
          <ringGeometry args={[4.2, 4.3, 36]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffe600"
            emissiveIntensity={2.0}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

function CyberHackerCharacter({
  hackerAction,
  speechText,
  accent = '#00f7ff',
}: {
  hackerAction: HackerAction;
  speechText: string;
  accent?: string;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const droneRef = useRef<THREE.Group>(null);
  const holoScreenRef = useRef<THREE.Group>(null);

  useSceneFrame(({clock}, delta) => {
    const t = clock.getElapsedTime();

    if (droneRef.current) {
      const droneSpeed = hackerAction === 'celebrate' ? 6 : 2;
      droneRef.current.position.x = 0.85 + Math.sin(t * droneSpeed) * 0.3;
      droneRef.current.position.y = 2.1 + Math.sin(t * 3.5) * 0.15;
      droneRef.current.position.z = 0.2 + Math.cos(t * droneSpeed) * 0.25;
      droneRef.current.rotation.y += delta * 3;
    }

    if (rootRef.current) {
      const breath = Math.sin(t * 2.5) * 0.03;
      rootRef.current.position.y = -3.2 + breath;
    }

    if (!leftArmRef.current || !rightArmRef.current || !headRef.current) return;

    if (hackerAction === 'typing') {
      leftArmRef.current.rotation.x = -Math.PI / 2.6 + Math.sin(t * 22) * 0.18;
      leftArmRef.current.rotation.y = 0.3 + Math.cos(t * 20) * 0.1;
      rightArmRef.current.rotation.x = -Math.PI / 2.6 + Math.cos(t * 24) * 0.18;
      rightArmRef.current.rotation.y = -0.3 + Math.sin(t * 18) * 0.1;
      headRef.current.rotation.x = 0.25;
      headRef.current.rotation.y = Math.sin(t * 4) * 0.08;
    } else if (hackerAction === 'celebrate') {
      leftArmRef.current.rotation.x = -Math.PI * 0.85 + Math.sin(t * 10) * 0.25;
      leftArmRef.current.rotation.z = -0.5;
      rightArmRef.current.rotation.x = -Math.PI * 0.85 + Math.cos(t * 10) * 0.25;
      rightArmRef.current.rotation.z = 0.5;
      headRef.current.rotation.x = -0.3 + Math.sin(t * 8) * 0.1;
      headRef.current.rotation.y = 0;
    } else if (hackerAction === 'blast') {
      rightArmRef.current.rotation.x = -Math.PI / 2;
      rightArmRef.current.rotation.y = -0.35;
      rightArmRef.current.rotation.z = 0;
      leftArmRef.current.rotation.x = -Math.PI / 4;
      headRef.current.rotation.x = -0.1;
      headRef.current.rotation.y = 0.2;
    } else if (hackerAction === 'glitch') {
      const jitter = (Math.random() - 0.5) * 0.3;
      leftArmRef.current.rotation.x = -Math.PI / 3 + jitter;
      rightArmRef.current.rotation.x = -Math.PI / 3 - jitter;
      headRef.current.rotation.x = -0.35;
      headRef.current.rotation.y = jitter * 2;
    } else if (hackerAction === 'tense') {
      leftArmRef.current.rotation.x = -Math.PI / 2.2;
      rightArmRef.current.rotation.x = -Math.PI / 1.5 + Math.sin(t * 6) * 0.1;
      rightArmRef.current.rotation.y = -0.6;
      headRef.current.rotation.x = 0.35;
      headRef.current.rotation.y = Math.sin(t * 3) * 0.15;
    } else {
      leftArmRef.current.rotation.x = -0.4 + Math.sin(t * 1.8) * 0.08;
      leftArmRef.current.rotation.y = 0.2;
      leftArmRef.current.rotation.z = 0;
      rightArmRef.current.rotation.x = -0.4 + Math.cos(t * 1.8) * 0.08;
      rightArmRef.current.rotation.y = -0.2;
      rightArmRef.current.rotation.z = 0;
      headRef.current.rotation.x = 0.1 + Math.sin(t * 1.2) * 0.05;
      headRef.current.rotation.y = Math.sin(t * 0.8) * 0.12;
    }

    if (holoScreenRef.current) {
      holoScreenRef.current.position.y = 1.35 + Math.sin(t * 3) * 0.04;
    }
  });

  return (
    <group name="hacker" ref={rootRef} position={[-6.2, -3.2, 0.5]} rotation={[0, 0.45, 0]}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[1.2, 1.4, 0.3, 16]} />
        <meshStandardMaterial color="#080e22" emissive={accent} emissiveIntensity={0.6} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 1.15, 16]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2.5}
          side={THREE.DoubleSide}
          />
      </mesh>

      {speechText && (
        <group position={[0, 2.7, 0]}>
          <Html center distanceFactor={12}>
            <div className="hacker-speech bg-black/85 border border-cyan-400 text-cyan-300 font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-lg shadow-cyan-500/40 backdrop-blur-md animate-pulse">
              <span className="text-yellow-400 font-black mr-1">[CIPHER]:</span>
              {speechText}
            </div>
          </Html>
        </group>
      )}

      <group ref={droneRef} position={[0.85, 2.1, 0.2]}>
        <mesh>
          <DetailSphere args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#101828" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0, -0.16]}>
          <DetailSphere args={[0.07, 8, 8]} />
          <meshStandardMaterial
            color={accent}
            emissive={hackerAction === 'glitch' ? '#ff0044' : accent}
            emissiveIntensity={3.5}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.5, 0.03, 0.1]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} />
        </mesh>
        <pointLight color={accent} intensity={15} distance={1.5} />
      </group>

      <mesh position={[-0.22, 0.65, 0]}>
        <capsuleGeometry args={[0.09, 0.7, 4, 8]} />
        <meshStandardMaterial color="#0a1224" metalness={0.7} />
      </mesh>
      <mesh position={[0.22, 0.65, 0]}>
        <capsuleGeometry args={[0.09, 0.7, 4, 8]} />
        <meshStandardMaterial color="#0a1224" metalness={0.7} />
      </mesh>

      <mesh position={[0, 1.35, 0]}>
        <capsuleGeometry args={[0.26, 0.6, 4, 8]} />
        <meshStandardMaterial color={accent} emissive="#ff0077" emissiveIntensity={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 1.35, 0.22]}>
        <boxGeometry args={[0.12, 0.55, 0.05]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3} />
      </mesh>

      <group ref={headRef} position={[0, 1.95, 0]}>
        <mesh>
          <DetailSphere args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#e2b897" />
        </mesh>
        <mesh position={[0, 0.12, -0.04]}>
          <coneGeometry args={[0.22, 0.25, 6]} />
          <meshStandardMaterial color={accent} emissive="#0099bb" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0, 0.03, -0.16]}>
          <boxGeometry args={[0.3, 0.09, 0.1]} />
          <meshStandardMaterial
            color="#ff0077"
            emissive={hackerAction === 'glitch' ? '#ff0000' : '#ff0077'}
            emissiveIntensity={3.5}
          />
        </mesh>
      </group>

      <group ref={leftArmRef} position={[-0.38, 1.6, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.6]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <mesh position={[0, -0.62, 0]}>
          <DetailSphere args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#e2b897" />
        </mesh>
      </group>

      <group ref={rightArmRef} position={[0.38, 1.6, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.08, 0.07, 0.6]} />
          <meshStandardMaterial color="#2d3748" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, -0.3, 0.04]}>
          <boxGeometry args={[0.04, 0.5, 0.02]} />
          <meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={3} />
        </mesh>
        <mesh position={[0, -0.62, 0]}>
          <DetailSphere args={[0.08, 8, 8]} />
          <meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={2} />
        </mesh>
      </group>

      <group ref={holoScreenRef} position={[0, 1.35, -0.6]} rotation={[0.4, 0, 0]}>
        <mesh>
          <planeGeometry args={[1.2, 0.45]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={2.2}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[1.15, 0.4]} />
          <meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={2.8} wireframe />
        </mesh>
        {Array.from({length: 8}).map((_, idx) => (
          <mesh key={idx} position={[-0.45 + idx * 0.13, -0.1, 0.02]}>
            <boxGeometry args={[0.09, 0.06, 0.01]} />
            <meshStandardMaterial color="#ffffff" emissive={accent} emissiveIntensity={3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function ElectricShockAura({color = '#00f7ff'}: {color?: string}) {
  const arcRef1 = useRef<THREE.Mesh>(null);
  const arcRef2 = useRef<THREE.Mesh>(null);

  useSceneFrame(({clock}) => {
    const t = clock.getElapsedTime();
    if (arcRef1.current) {
      arcRef1.current.rotation.z = t * 14 + Math.sin(t * 30) * 0.4;
      arcRef1.current.rotation.x = Math.cos(t * 20) * 0.5;
    }
    if (arcRef2.current) {
      arcRef2.current.rotation.z = -t * 16 + Math.cos(t * 25) * 0.4;
      arcRef2.current.rotation.y = Math.sin(t * 18) * 0.5;
    }
  });

  return (
    <group position={[0, 0, 0.1]}>
      <mesh ref={arcRef1}>
        <DetailTorus args={[0.46, 0.035, 6, 12]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={4.0} wireframe />
      </mesh>
      <mesh ref={arcRef2} rotation={[Math.PI / 2, 0, 0]}>
        <DetailTorus args={[0.48, 0.03, 6, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffe600" emissiveIntensity={3.5} wireframe />
      </mesh>
    </group>
  );
}

function LaserPurgeAura({isVertical}: {isVertical: boolean}) {
  const beamRef = useRef<THREE.Mesh>(null);
  useSceneFrame(({clock}) => {
    const t = clock.getElapsedTime();
    if (beamRef.current) {
      const pulse = 1 + Math.sin(t * 12) * 0.15;
      beamRef.current.scale.set(isVertical ? 1 : pulse, isVertical ? pulse : 1, 1);
    }
  });

  return (
    <group position={[0, 0, 0.12]}>
      <mesh ref={beamRef} rotation={isVertical ? [0, 0, 0] : [0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.1, 0.9, 0.08]} />
        <meshStandardMaterial color="#ffffff" emissive="#00f7ff" emissiveIntensity={3.5} />
      </mesh>
    </group>
  );
}

function ClusterBombAura() {
  const ringRef = useRef<THREE.Mesh>(null);
  useSceneFrame(({clock}) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      const p = 1 + Math.sin(t * 8) * 0.2;
      ringRef.current.scale.set(p, p, p);
      ringRef.current.rotation.z += 0.08;
    }
  });

  return (
    <group position={[0, 0, 0.12]}>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.42, 0.52, 16]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={3.0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function DataDiamondMesh({special, locked}: {special: TileSpecial; locked: boolean}) {
  const meshRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useSceneFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 1.6;
      meshRef.current.rotation.x += delta * 0.6;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z -= delta * 2.2;
    }
  });

  const isElectric = special === 'overload';

  return (
    <group ref={meshRef}>
      <mesh>
        <octahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial
          color={locked ? '#b3f0ff' : '#00e5ff'}
          emissive={isElectric ? '#ffffff' : '#0099cc'}
          emissiveIntensity={isElectric ? 2.5 : locked ? 1.5 : 0.9}
          metalness={0.8}
          roughness={locked ? 0.05 : 0.15}
          transparent={locked}
          opacity={locked ? 0.9 : 1.0}
        />
      </mesh>
      <mesh>
        <DetailSphere args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#00ffff" emissiveIntensity={3} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
        <DetailTorus args={[0.48, 0.025, 8, 24]} />
        <meshStandardMaterial color="#80f7ff" emissive="#00f7ff" emissiveIntensity={1.6} />
      </mesh>

      {isElectric && <ElectricShockAura color="#00f7ff" />}
      {special === 'lineH' && <LaserPurgeAura isVertical={false} />}
      {special === 'lineV' && <LaserPurgeAura isVertical={true} />}
      {special === 'bomb' && <ClusterBombAura />}
    </group>
  );
}

function HoloChipMesh({special, locked}: {special: TileSpecial; locked: boolean}) {
  const meshRef = useRef<THREE.Group>(null);
  const crownRef = useRef<THREE.Mesh>(null);

  useSceneFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 1.3;
    }
    if (crownRef.current) {
      crownRef.current.rotation.y -= delta * 2.0;
    }
  });

  const isElectric = special === 'overload';

  return (
    <group ref={meshRef} rotation={[Math.PI / 8, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[0.42, 0.42, 0.14, 24]} />
        <meshStandardMaterial
          color={locked ? '#ff99cc' : '#ff0077'}
          emissive={isElectric ? '#ffffff' : '#cc0055'}
          emissiveIntensity={isElectric ? 2.5 : 1.0}
          metalness={0.88}
          roughness={0.18}
        />
      </mesh>
      <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.34, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#ff88bb" emissiveIntensity={1.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.075, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.34, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#ff88bb" emissiveIntensity={1.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={crownRef} position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.12, 0.08, 0.06, 6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffe600" emissiveIntensity={3} />
      </mesh>

      {isElectric && <ElectricShockAura color="#ff0077" />}
      {special === 'lineH' && <LaserPurgeAura isVertical={false} />}
      {special === 'lineV' && <LaserPurgeAura isVertical={true} />}
      {special === 'bomb' && <ClusterBombAura />}
    </group>
  );
}

function NeuralCoinMesh({special, locked}: {special: TileSpecial; locked: boolean}) {
  const meshRef = useRef<THREE.Group>(null);
  useSceneFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 1.5;
      meshRef.current.rotation.z += delta * 0.35;
    }
  });

  const isElectric = special === 'overload';

  return (
    <group ref={meshRef}>
      <mesh>
        <cylinderGeometry args={[0.42, 0.42, 0.14, 12]} />
        <meshStandardMaterial
          color={locked ? '#ffeaa7' : '#ffb700'}
          emissive={isElectric ? '#ffffff' : '#ff7700'}
          emissiveIntensity={isElectric ? 2.5 : 0.9}
          metalness={0.92}
          roughness={0.12}
        />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.24, 0.24, 0.18]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffe600" emissiveIntensity={2.0} />
      </mesh>
      {Array.from({length: 8}).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.41, Math.sin(angle) * 0.41, 0]}
            rotation={[0, 0, angle]}>
            <boxGeometry args={[0.06, 0.04, 0.15]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffaa00" emissiveIntensity={2.5} />
          </mesh>
        );
      })}

      {isElectric && <ElectricShockAura color="#ffe600" />}
      {special === 'lineH' && <LaserPurgeAura isVertical={false} />}
      {special === 'lineV' && <LaserPurgeAura isVertical={true} />}
      {special === 'bomb' && <ClusterBombAura />}
    </group>
  );
}

function CipherNodeMesh({special, locked}: {special: TileSpecial; locked: boolean}) {
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useSceneFrame((_, delta) => {
    if (innerRef.current) innerRef.current.rotation.y += delta * 2.2;
    if (outerRef.current) {
      outerRef.current.rotation.x += delta * 1.1;
      outerRef.current.rotation.y -= delta * 1.1;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 1.8;
    }
  });

  const isElectric = special === 'overload';

  return (
    <group>
      <mesh ref={innerRef}>
        <DetailSphere args={[0.28, 16, 16]} />
        <meshStandardMaterial
          color={locked ? '#b3ffd9' : '#00ff66'}
          emissive={isElectric ? '#ffffff' : '#00bb44'}
          emissiveIntensity={isElectric ? 2.5 : 1.2}
          metalness={0.6}
          roughness={0.25}
        />
      </mesh>
      <mesh ref={outerRef}>
        <boxGeometry args={[0.56, 0.56, 0.56]} />
        <meshStandardMaterial color="#80ffaa" emissive="#00ff66" emissiveIntensity={1.4} wireframe />
      </mesh>
      <mesh ref={ringRef} rotation={[0, Math.PI / 4, 0]}>
        <DetailTorus args={[0.42, 0.02, 6, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#00ff88" emissiveIntensity={2.5} />
      </mesh>

      {isElectric && <ElectricShockAura color="#00ff66" />}
      {special === 'lineH' && <LaserPurgeAura isVertical={false} />}
      {special === 'lineV' && <LaserPurgeAura isVertical={true} />}
      {special === 'bomb' && <ClusterBombAura />}
    </group>
  );
}

function QuantumDieMesh({special, locked}: {special: TileSpecial; locked: boolean}) {
  const meshRef = useRef<THREE.Group>(null);
  useSceneFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 1.0;
      meshRef.current.rotation.y += delta * 1.2;
    }
  });

  const isElectric = special === 'overload';

  return (
    <group ref={meshRef}>
      <mesh>
        <boxGeometry args={[0.52, 0.52, 0.52]} />
        <meshStandardMaterial
          color={locked ? '#e0b3ff' : '#b026ff'}
          emissive={isElectric ? '#ffffff' : '#7700cc'}
          emissiveIntensity={isElectric ? 2.5 : 1.1}
          metalness={0.8}
          roughness={0.18}
        />
      </mesh>
      <mesh position={[0, 0, 0.27]}>
        <DetailSphere args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#e088ff" emissiveIntensity={2.8} />
      </mesh>
      <mesh position={[0, 0, -0.27]}>
        <DetailSphere args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#e088ff" emissiveIntensity={2.8} />
      </mesh>
      <mesh position={[0, 0.27, 0]}>
        <DetailSphere args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#e088ff" emissiveIntensity={2.8} />
      </mesh>
      <mesh position={[0, -0.27, 0]}>
        <DetailSphere args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#e088ff" emissiveIntensity={2.8} />
      </mesh>

      {isElectric && <ElectricShockAura color="#b026ff" />}
      {special === 'lineH' && <LaserPurgeAura isVertical={false} />}
      {special === 'lineV' && <LaserPurgeAura isVertical={true} />}
      {special === 'bomb' && <ClusterBombAura />}
    </group>
  );
}

function IceFirewallOverlay() {
  const frostRef = useRef<THREE.Group>(null);
  useSceneFrame(({clock}) => {
    const t = clock.getElapsedTime();
    if (frostRef.current) {
      frostRef.current.rotation.z = Math.sin(t * 0.5) * 0.05;
    }
  });

  return (
    <group ref={frostRef} position={[0, 0, 0.12]}>
      <mesh>
        <boxGeometry args={[0.84, 0.84, 0.3]} />
        <meshStandardMaterial
          color="#c8f5ff"
          emissive="#00e1ff"
          emissiveIntensity={0.9}
          transparent
          opacity={0.65}
          roughness={0.1}
          metalness={0.3}
        />
      </mesh>
      {[-0.38, 0.38].map((x) =>
        [-0.38, 0.38].map((y) => (
          <mesh key={`${x}-${y}`} position={[x, y, 0.09]} rotation={[0, 0, Math.PI / 4]}>
            <octahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial color="#ffffff" emissive="#88f2ff" emissiveIntensity={1.8} transparent opacity={0.8} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0, 0.17]}>
        <planeGeometry args={[0.76, 0.76]} />
        <meshStandardMaterial color="#ffffff" emissive="#00f7ff" emissiveIntensity={2.2} wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function CorruptedGlitchOverlay() {
  const glitchRef = useRef<THREE.Group>(null);
  useSceneFrame(({clock}) => {
    const t = clock.getElapsedTime();
    if (glitchRef.current) {
      glitchRef.current.rotation.z = Math.sin(t * 8) * 0.12;
      glitchRef.current.scale.setScalar(1 + Math.sin(t * 14) * 0.06);
    }
  });

  return (
    <group ref={glitchRef} position={[0, 0, 0.14]}>
      <mesh>
        <boxGeometry args={[0.88, 0.88, 0.28]} />
        <meshStandardMaterial color="#2a0008" emissive="#ff0033" emissiveIntensity={2.4} wireframe transparent opacity={0.85} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.26, 0]} />
        <meshStandardMaterial color="#ffffff" emissive="#ff0055" emissiveIntensity={4.5} />
      </mesh>
      <mesh position={[0, 0, 0.12]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.7, 0.08, 0.02]} />
        <meshStandardMaterial color="#ffe600" emissive="#ffbb00" emissiveIntensity={3} />
      </mesh>
    </group>
  );
}

function QuantumLockOverlay() {
  const ringRef = useRef<THREE.Mesh>(null);
  useSceneFrame(({clock}) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 2.5;
    }
  });

  return (
    <group position={[0, 0, 0.14]}>
      <mesh>
        <boxGeometry args={[0.82, 0.82, 0.26]} />
        <meshStandardMaterial color="#140e05" emissive="#8a5200" emissiveIntensity={0.35} metalness={0.55} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.22, 0.08]}>
        <DetailTorus args={[0.22, 0.05, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#ffb84d" emissive="#b57216" emissiveIntensity={0.8} />
      </mesh>
      <mesh ref={ringRef} position={[0, -0.08, 0.14]}>
        <ringGeometry args={[0.16, 0.26, 12]} />
        <meshStandardMaterial color="#ffca6a" emissive="#b77b21" emissiveIntensity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.08, 0.15]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 8]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
    </group>
  );
}

function EMPTurretOverlay() {
  const turretRef = useRef<THREE.Group>(null);
  useSceneFrame(({clock}) => {
    const t = clock.getElapsedTime();
    if (turretRef.current) {
      turretRef.current.rotation.z = t * 3;
    }
  });

  return (
    <group position={[0, 0, 0.14]}>
      <mesh>
        <cylinderGeometry args={[0.42, 0.44, 0.22, 6]} />
        <meshStandardMaterial color="#081426" emissive="#00e5ff" emissiveIntensity={1.2} metalness={0.9} roughness={0.2} />
      </mesh>
      <group ref={turretRef} position={[0, 0, 0.12]}>
        <mesh>
          <DetailSphere args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#111827" metalness={0.9} />
        </mesh>
        <mesh position={[0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.2, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#00f7ff" emissiveIntensity={4} />
        </mesh>
        <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.2, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#00f7ff" emissiveIntensity={4} />
        </mesh>
      </group>
    </group>
  );
}

function PlasmaShieldOverlay({health}: {health: number}) {
  const shieldRef = useRef<THREE.Group>(null);
  useSceneFrame(({clock}) => {
    const t = clock.getElapsedTime();
    if (shieldRef.current) {
      shieldRef.current.rotation.z = t * (health === 2 ? 1.5 : 3.5);
    }
  });

  const isCracked = health === 1;

  return (
    <group ref={shieldRef} position={[0, 0, 0.14]}>
      <mesh>
        <cylinderGeometry args={[0.44, 0.44, 0.26, 6]} />
        <meshStandardMaterial
          color={isCracked ? '#ff8800' : '#ffe600'}
          emissive={isCracked ? '#ff4400' : '#ffaa00'}
          emissiveIntensity={isCracked ? 3.0 : 2.0}
          transparent
          opacity={isCracked ? 0.6 : 0.85}
          wireframe
        />
      </mesh>
      <mesh>
        <DetailSphere args={[0.34, 12, 12]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={isCracked ? '#ff3300' : '#ffb700'}
          emissiveIntensity={isCracked ? 3.5 : 2.2}
          transparent
          opacity={0.45}
        />
      </mesh>
      <group position={[0, 0, 0.18]}>
        <mesh position={[-0.14, 0, 0]}>
          <DetailSphere args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#00ff66" emissiveIntensity={4} />
        </mesh>
        {health === 2 && (
          <mesh position={[0.14, 0, 0]}>
            <DetailSphere args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#00ff66" emissiveIntensity={4} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function VoidTrapOverlay({health}: {health: number}) {
  const vortexRef = useRef<THREE.Group>(null);
  useSceneFrame(({clock}) => {
    const t = clock.getElapsedTime();
    if (vortexRef.current) {
      vortexRef.current.rotation.z = -t * 4.0;
    }
  });

  return (
    <group ref={vortexRef} position={[0, 0, 0.14]}>
      <mesh>
        <DetailSphere args={[0.26, 16, 16]} />
        <meshStandardMaterial color="#050010" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh rotation={[Math.PI / 4, 0, 0]}>
        <DetailTorus args={[0.42, 0.04, 8, 24]} />
        <meshStandardMaterial color="#ffffff" emissive="#a855f7" emissiveIntensity={4.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 4, 0, 0]}>
        <DetailTorus args={[0.48, 0.03, 8, 24]} />
        <meshStandardMaterial color="#ffffff" emissive="#ff00aa" emissiveIntensity={4.0} />
      </mesh>
      <mesh position={[0, 0, 0.18]}>
        <DetailSphere args={[0.07, 8, 8]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={health === 2 ? '#a855f7' : '#ff0055'}
          emissiveIntensity={5}
        />
      </mesh>
    </group>
  );
}

function DragTetherLine({startX, startY, endX, endY}: {startX: number; startY: number; endX: number; endY: number}) {
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.05) return null;

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const angle = Math.atan2(dy, dx);

  return (
    <group position={[midX, midY, 0.35]} rotation={[0, 0, angle]}>
      <mesh>
        <boxGeometry args={[dist, 0.08, 0.03]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#00f7ff"
          emissiveIntensity={3.5}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
}

interface TileProps {
  tile: GridTile;
  isSelected: boolean;
  isDraggingThis: boolean;
  dragOffset: {x: number; y: number};
  isGlitching?: boolean;
  onTilePointerDown: (e: any, row: number, col: number) => void;
}

function CollectionPiece({tile,style}:{tile:GridTile;style:string}) {
  const ref=useRef<THREE.Group>(null),color=TOKEN_COLORS[tile.type];
  useSceneFrame((_,delta)=>{if(ref.current)ref.current.rotation.y+=delta*(style==='relics'?.35:.18);});
  return <group ref={ref} position={[0,0,.2]} rotation={[.15,0,tile.type*.18]}>
    <mesh>
      {style==='gems'?(tile.type===0?<octahedronGeometry args={[.4,0]}/>:tile.type===1?<icosahedronGeometry args={[.37,0]}/>:tile.type===2?<coneGeometry args={[.35,.65,6]}/>:tile.type===3?<dodecahedronGeometry args={[.37,0]}/>:<tetrahedronGeometry args={[.45,0]}/>):
        style==='arcade'?(tile.type===0?<boxGeometry args={[.55,.55,.3]}/>:tile.type===1?<cylinderGeometry args={[.36,.36,.24,8]}/>:tile.type===2?<coneGeometry args={[.4,.65,3]}/>:tile.type===3?<boxGeometry args={[.24,.7,.24]}/>:<torusGeometry args={[.27,.12,6,8]}/>):
        tile.type===0?<octahedronGeometry args={[.4,0]}/>:tile.type===1?<DetailTorus args={[.3,.09,8,20]}/>:tile.type===2?<DetailSphere args={[.33,16,12]}/>:tile.type===3?<icosahedronGeometry args={[.35,0]}/>:<dodecahedronGeometry args={[.35,0]}/>
      }
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={tile.locked?.08:.25} metalness={style==='gems'?.5:.25} roughness={style==='arcade'?.6:.28}/>
    </mesh>
    {style==='relics'&&<mesh rotation={[.7,tile.type*.4,.4]}><DetailTorus args={[.44,.025,6,24]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.6}/></mesh>}
    {tile.special==='lineH'&&<LaserPurgeAura isVertical={false}/>}{tile.special==='lineV'&&<LaserPurgeAura isVertical/>}{tile.special==='bomb'&&<ClusterBombAura/>}{tile.special==='overload'&&<ElectricShockAura color={color}/>}
  </group>;
}
function BoardTile({
  tile,
  isSelected,
  isDraggingThis,
  dragOffset,
  isGlitching,
  onTilePointerDown,
}: TileProps) {
  const motionStopped = React.useContext(MotionContext);
  const pieceStyle=React.useContext(PiecesContext);
  const groupRef = useRef<THREE.Group>(null);
  const currentPos = useRef(new THREE.Vector3(tile.x, tile.y, 0));
  const currentScale = useRef(new THREE.Vector3(1, 1, 1));
  const lastTargetY = useRef(tile.targetY);
  const landingSquashTime = useRef(0);

  useEffect(() => {
    if (tile.targetY !== lastTargetY.current) {
      lastTargetY.current = tile.targetY;
      landingSquashTime.current = 0.25;
    }
  }, [tile.targetY]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const glitchJitterX = isGlitching ? (Math.random() - 0.5) * 0.18 : 0;
    const glitchJitterY = isGlitching ? (Math.random() - 0.5) * 0.18 : 0;

    const targetX = tile.targetX + (isDraggingThis ? dragOffset.x : 0) + glitchJitterX;
    const targetY = tile.targetY + (isDraggingThis ? dragOffset.y : 0) + glitchJitterY;
    const targetZ = isDraggingThis ? 0.85 : isSelected ? 0.14 : 0;

    scratchVec3A.set(targetX, targetY, targetZ);
    const lerpRate = motionStopped ? 1 : Math.min(1, delta * 24);
    currentPos.current.lerp(scratchVec3A, lerpRate);
    groupRef.current.position.copy(currentPos.current);

    if (isDraggingThis) {
      groupRef.current.rotation.x = -dragOffset.y * 1.5;
      groupRef.current.rotation.y = dragOffset.x * 1.5;
    } else {
      groupRef.current.rotation.x = 0;
      groupRef.current.rotation.y = 0;
    }

    let targetScaleX = tile.scale * (isDraggingThis ? 1.25 : isSelected ? 1.04 : 1.0);
    let targetScaleY = tile.scale * (isDraggingThis ? 1.25 : isSelected ? 1.04 : 1.0);
    let targetScaleZ = tile.scale * (isDraggingThis ? 1.3 : isSelected ? 1.04 : 1.0);

    if (!motionStopped && landingSquashTime.current > 0) {
      landingSquashTime.current -= delta;
      const progress = landingSquashTime.current / 0.25;
      const squashFactor = Math.sin(progress * Math.PI) * 0.22;
      targetScaleX *= 1 + squashFactor;
      targetScaleY *= 1 - squashFactor;
    }

    scratchVec3B.set(targetScaleX, targetScaleY, targetScaleZ);
    currentScale.current.lerp(scratchVec3B, lerpRate);
    groupRef.current.scale.copy(currentScale.current);
  });

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    onTilePointerDown(e, tile.row, tile.col);
  };

  const isHighlighted = isSelected || isDraggingThis;

  return (
    <group
      ref={groupRef}
      position={[tile.x, tile.y, 0]}
      onPointerDown={handlePointerDown}>
      <mesh position={[0, 0, -0.16]}>
        <boxGeometry args={[1.02, 1.02, 0.12]} />
        <meshStandardMaterial
          color={isGlitching ? '#ff0044' : isHighlighted ? '#07212e' : '#0a1024'}
          emissive={isGlitching ? '#ff0022' : isHighlighted ? '#064552' : '#030818'}
          emissiveIntensity={isGlitching ? 2.5 : isHighlighted ? 0.3 : 0.25}
          metalness={0.9}
          roughness={0.3}
        />
      </mesh>

      {isHighlighted && (
        <group position={[0, 0, 0.2]}>
          <mesh>
            <ringGeometry args={[0.49, 0.515, 4]} />
            <meshStandardMaterial
              color="#18aabb"
              emissive="#00bacd"
              emissiveIntensity={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {pieceStyle!=='classic'?<CollectionPiece tile={tile} style={pieceStyle}/>:tile.type === 0 ? (
        <DataDiamondMesh special={tile.special} locked={tile.locked} />
      ) : tile.type === 1 ? (
        <HoloChipMesh special={tile.special} locked={tile.locked} />
      ) : tile.type === 2 ? (
        <NeuralCoinMesh special={tile.special} locked={tile.locked} />
      ) : tile.type === 3 ? (
        <CipherNodeMesh special={tile.special} locked={tile.locked} />
      ) : (
        <QuantumDieMesh special={tile.special} locked={tile.locked} />
      )}

      {tile.special==='lineCross'&&<group position={[0,0,.2]}><group position={[0,-.1,0]}><LaserPurgeAura isVertical={false}/></group><group position={[0,.1,0]}><LaserPurgeAura isVertical={false}/></group><group position={[-.1,0,0]}><LaserPurgeAura isVertical/></group><group position={[.1,0,0]}><LaserPurgeAura isVertical/></group></group>}
      {tile.locked && tile.obstacleType === 'corrupted' && <CorruptedGlitchOverlay />}
      {tile.locked && tile.obstacleType === 'lock' && <QuantumLockOverlay />}
      {tile.locked && tile.obstacleType === 'turret' && <EMPTurretOverlay />}
      {tile.locked && tile.obstacleType === 'plasma_shield' && (
        <PlasmaShieldOverlay health={tile.lockHealth} />
      )}
      {tile.locked && tile.obstacleType === 'void' && <VoidTrapOverlay health={tile.lockHealth} />}
      {tile.locked && (!tile.obstacleType || tile.obstacleType === 'ice') && (
        <IceFirewallOverlay />
      )}
    </group>
  );
}

interface CyberTower {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  color: string;
}

function ChapterAtmosphere({theme}:{theme:SceneTheme}) {
  const root=useRef<THREE.Group>(null);
  useSceneFrame(({clock},delta)=>{
    if(!root.current)return;const t=clock.getElapsedTime();
    root.current.children.forEach((g,i)=>{
      if(theme.motion==='traffic'){g.position.x=((t*1.8+i*3)%36)-18;g.position.y=(i%4-1.5)*4;}
      else if(theme.motion==='orbits'){g.rotation.z+=delta*.12*(i%2?1:-1);g.rotation.y=Math.sin(t*.2+i)*.45;}
      else if(theme.motion==='petals'){g.position.y=12-((t*.7+i*2)%24);g.position.x=Math.sin(t*.3+i)*14;g.rotation.z+=delta*.3;}
      else if(theme.motion==='streams'){g.position.y=12-((t*2+i*2)%24);}
      else if(theme.motion==='vortex'){g.rotation.z+=delta*(.08+i*.012);g.scale.setScalar(1+Math.sin(t*.4+i)*.05);}
      else {g.position.y=Math.sin(t*.5+i*.4)*3+(i-5)*1.5;g.rotation.z=Math.sin(t*.25+i)*.15;}
    });
  });
  return <group ref={root} name={`chapter-${theme.id}`} position={[0,0,-11]}>
    {Array.from({length:12},(_,i)=><mesh key={i} position={[(i%2?1:-1)*(7+i%4),i%6*3-7,0]} rotation={[0,0,i*.4]}>
      {theme.motion==='orbits'||theme.motion==='vortex'?<torusGeometry args={[7+i*.55,.025,6,48]}/>:theme.motion==='petals'?<octahedronGeometry args={[.6+i%3*.25,0]}/>:theme.motion==='streams'?<boxGeometry args={[.08,3+i%3,.06]}/>:theme.motion==='aurora'?<boxGeometry args={[28,.04,.04]}/>:<boxGeometry args={[1.2,.05,.08]}/>}
      <meshBasicMaterial color={i%2?theme.primary:theme.secondary} transparent opacity={theme.motion==='vortex'?.25:.4}/>
    </mesh>)}
  </group>;
}
function ChapterArchitecture({theme}:{theme:SceneTheme}) {
  const root=useRef<THREE.Group>(null);
  useSceneFrame(({clock})=>{if(root.current&&theme.id!=='ai')root.current.children.forEach((g,i)=>{g.position.y=(i%4)*4-6+Math.sin(clock.getElapsedTime()*.35+i)*.65;g.rotation.y=Math.sin(clock.getElapsedTime()*.2+i)*.2;});});
  return <group name={`environment-${theme.id}`} ref={root}>
    {Array.from({length:12},(_,i)=><group key={i} position={[(i%2?1:-1)*(8+(i%3)*4),(i%4)*4-6,-9-(i%3)*3]}>
      {theme.id==='quantum'?<>
        <mesh rotation={[.15,.4,.15]}><boxGeometry args={[3.4,2.5,2.5]}/><meshStandardMaterial color="#10263b" emissive={theme.primary} emissiveIntensity={.18} metalness={.8} roughness={.3}/></mesh>
        <mesh rotation={[.15,.4,.15]}><boxGeometry args={[3.5,2.6,2.6]}/><meshBasicMaterial color={theme.secondary} wireframe transparent opacity={.65}/></mesh>
        <mesh position={[0,0,1.8]}><torusGeometry args={[1.1,.06,6,6]}/><meshBasicMaterial color={theme.primary}/></mesh>
      </>:theme.id==='lotus'?<>
        {Array.from({length:6},(_,p)=><mesh key={p} position={[Math.sin(p*Math.PI/3)*1.3,Math.cos(p*Math.PI/3)*1.3,0]} rotation={[0,0,-p*Math.PI/3]} scale={[.65,1.3,.3]}><DetailSphere args={[1.3,12,8]}/><meshStandardMaterial color={p%2?theme.primary:theme.secondary} emissive={theme.primary} emissiveIntensity={.15} roughness={.65}/></mesh>)}
        <mesh><octahedronGeometry args={[.65,0]}/><meshBasicMaterial color="#f6bfda"/></mesh>
      </>:theme.id==='ai'?<>
        {Array.from({length:5},(_,p)=><group key={p} position={[0,p*2.2,0]}><mesh><boxGeometry args={[2.8,1.8,2]}/><meshStandardMaterial color="#071c14" metalness={.6}/></mesh><mesh position={[0,0,1.05]}><boxGeometry args={[2.3,.08,.05]}/><meshBasicMaterial color={p%2?theme.primary:theme.secondary}/></mesh><mesh position={[-.9,.4,1.05]}><boxGeometry args={[.2,.2,.05]}/><meshBasicMaterial color={theme.primary}/></mesh></group>)}
      </>:theme.id==='singularity'?<>
        <mesh rotation={[i,.3*i,.4]}><icosahedronGeometry args={[1.7+i%3*.5,0]}/><meshStandardMaterial color="#211430" emissive={theme.primary} emissiveIntensity={.12} roughness={.8}/></mesh>
        <mesh rotation={[i,.3*i,.4]}><icosahedronGeometry args={[1.75+i%3*.5,0]}/><meshBasicMaterial color={theme.secondary} wireframe transparent opacity={.35}/></mesh>
      </>:<>
        <mesh rotation={[Math.PI,0,0]}><coneGeometry args={[2.8,3.8,6]}/><meshStandardMaterial color="#163a43" roughness={.8}/></mesh>
        <mesh position={[0,1.9,0]}><cylinderGeometry args={[2.8,2.8,.2,6]}/><meshStandardMaterial color={theme.primary} emissive={theme.secondary} emissiveIntensity={.18}/></mesh>
        <mesh position={[0,2.8,0]}><coneGeometry args={[.7,1.8,5]}/><meshStandardMaterial color={theme.secondary} roughness={.6}/></mesh>
      </>}
    </group>)}
  </group>;
}
function CyberCasinoEnvironment({theme=themeForLevel(1)}:{theme?:SceneTheme}) {
  const towers = useMemo(() => {
    const list: CyberTower[] = [];
    for (let i = 0; i < 32; i++) {
      const spreadX = ((i - 16) / 16) * 34 + Math.sin(i * 3.7) * 2;
      const z = -8.5 - (i % 6) * 2.8 - Math.random() * 2;
      const height = 11 + (i % 5) * 3.8;
      const width = 1.5 + (i % 4) * 0.7;
      const depth = 1.5 + (i % 3) * 0.7;
      const color = i%2?theme.primary:theme.secondary;
      list.push({x: spreadX, y: -6.5 + height / 2, z, width, height, depth, color});
    }
    return list;
  }, [theme]);

  const gridRef = useRef<THREE.Group>(null);
  const searchLight1 = useRef<THREE.Group>(null);
  const searchLight2 = useRef<THREE.Group>(null);
  const fanRef1 = useRef<THREE.Mesh>(null);
  const fanRef2 = useRef<THREE.Mesh>(null);

  useSceneFrame(({clock}, delta) => {
    const t = clock.getElapsedTime();
    if (gridRef.current) {
      gridRef.current.position.y = -6.0 + Math.sin(t) * 0.08;
    }
    if (searchLight1.current) {
      searchLight1.current.rotation.z = Math.sin(t * 0.8) * 0.45 + 0.3;
      searchLight1.current.rotation.y = Math.cos(t * 0.5) * 0.3;
    }
    if (searchLight2.current) {
      searchLight2.current.rotation.z = -Math.sin(t * 0.7) * 0.45 - 0.3;
      searchLight2.current.rotation.y = -Math.cos(t * 0.6) * 0.3;
    }
    if (fanRef1.current) fanRef1.current.rotation.z += delta * 12;
    if (fanRef2.current) fanRef2.current.rotation.z += delta * 10;
  });

  return (
    <group name="city">
      <ChapterAtmosphere theme={theme}/>
      <group ref={gridRef} position={[0, -6.0, -8]} rotation={[-Math.PI / 2.3, 0, 0]}>
        <gridHelper args={[90, 45, theme.primary, '#102244']} />
      </group>

      <AnimatedBillboard position={[-8.0, 4.5, -7.5]} rotation={[0, 0.4, 0]} type="casino" size={[4.4, 2.3]} />
      <AnimatedBillboard position={[8.0, 4.8, -7.5]} rotation={[0, -0.4, 0]} type="matrix" size={[4.4, 2.3]} />
      <AnimatedBillboard position={[0, 7.2, -10.5]} rotation={[0.1, 0, 0]} type="warning" size={[5.8, 2.2]} />

      <FlyingCyberTraffic />
      <DigitalRainParticles />

      <group ref={searchLight1} position={[-9.5, -5, -9]}>
        <mesh position={[0, 6, 0]}>
          <cylinderGeometry args={[0.9, 0.05, 13, 16]} />
          <meshBasicMaterial color={theme.primary} transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group ref={searchLight2} position={[9.5, -5, -9]}>
        <mesh position={[0, 6, 0]}>
          <cylinderGeometry args={[0.9, 0.05, 13, 16]} />
          <meshBasicMaterial color={theme.secondary} transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {theme.id!=='neon'?<ChapterArchitecture key={theme.id} theme={theme}/>:<group name="environment-neon">{towers.map((t, idx) => (
        <group key={idx} position={[t.x, t.y, t.z]}>
          <mesh>
            <boxGeometry args={[t.width, t.height, t.depth]} />
            <meshStandardMaterial color="#030612" emissive="#050d24" emissiveIntensity={0.6} roughness={0.7} metalness={0.8} />
          </mesh>
          <mesh position={[0, 0, t.depth / 2 + 0.02]}>
            <planeGeometry args={[t.width * 0.85, t.height * 0.9]} />
            <meshStandardMaterial color={t.color} emissive={t.color} emissiveIntensity={1.5} wireframe transparent opacity={0.4} />
          </mesh>
          <mesh position={[0, t.height / 2 + 1.2, 0]}>
            <cylinderGeometry args={[0.04, 0.12, 2.4, 6]} />
            <meshStandardMaterial color="#ffffff" emissive={t.color} emissiveIntensity={3.2} />
          </mesh>
        </group>
      ))}</group>}

      <group position={[-6.8, -4.5, -4]} rotation={[0, 0.4, 0]}>
        <mesh>
          <cylinderGeometry args={[0.8, 0.8, 0.3, 24]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
        <mesh ref={fanRef1} position={[0, 0, 0.16]}>
          <boxGeometry args={[1.4, 0.22, 0.05]} />
          <meshStandardMaterial color="#00f7ff" emissive="#00f7ff" emissiveIntensity={2.5} />
        </mesh>
      </group>

      <group position={[6.8, -4.5, -4]} rotation={[0, -0.4, 0]}>
        <mesh>
          <cylinderGeometry args={[0.8, 0.8, 0.3, 24]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
        <mesh ref={fanRef2} position={[0, 0, 0.16]}>
          <boxGeometry args={[1.4, 0.22, 0.05]} />
          <meshStandardMaterial color="#ff0077" emissive="#ff0077" emissiveIntensity={2.5} />
        </mesh>
      </group>
    </group>
  );
}

function ShockwaveRingsOverlay({rings}: {rings: ShockwaveRing[]}) {
  return (
    <group>
      {rings.map((ring) => {
        const alpha = Math.max(0, ring.life / ring.maxLife);
        return (
          <group key={ring.id} position={[ring.x, ring.y, ring.z]}>
            <mesh>
              <ringGeometry args={[Math.max(0.05, ring.radius - 0.08), ring.radius + 0.08, 32]} />
              <meshStandardMaterial
                color={ring.color}
                emissive={ring.color}
                emissiveIntensity={4.0 * alpha}
                transparent
                opacity={alpha * 0.85}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function LaserBeamsOverlay({beams}: {beams: LaserBeam[]}) {
  return (
    <group>
      {beams.map((beam) => {
        const dx = beam.endX - beam.startX;
        const dy = beam.endY - beam.startY;
        const dist = Math.hypot(dx, dy);
        const midX = (beam.startX + beam.endX) / 2;
        const midY = (beam.startY + beam.endY) / 2;
        const angle = Math.atan2(dy, dx);
        const alpha = Math.max(0, beam.life / beam.maxLife);

        return (
          <group key={beam.id} position={[midX, midY, 0.5]} rotation={[0, 0, angle]}>
            <mesh>
              <boxGeometry args={[dist, 0.24, 0.12]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive={beam.color}
                emissiveIntensity={5.0 * alpha}
                transparent
                opacity={alpha}
              />
            </mesh>
            <mesh>
              <boxGeometry args={[dist, 0.8, 0.18]} />
              <meshStandardMaterial
                color={beam.color}
                emissive={beam.color}
                emissiveIntensity={3.5 * alpha}
                transparent
                opacity={alpha * 0.75}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function RichParticlesOverlay({particles}: {particles: RichParticle[]}) {
  return (
    <group>
      {particles.map((p) => {
        const alpha = Math.max(0, p.life / p.maxLife);
        const scale = p.size * (0.5 + 0.5 * alpha);

        if (p.type === 'firework') {
          return (
            <group key={p.id} position={[p.x, p.y, p.z]} rotation={[p.rotX || 0, p.rotY || 0, p.rotation || 0]}>
              <mesh>
                <octahedronGeometry args={[scale, 0]} />
                <meshStandardMaterial color="#ffffff" emissive={p.color} emissiveIntensity={5.0 * alpha} transparent opacity={alpha} />
              </mesh>
            </group>
          );
        } else if (p.type === 'stardust' || p.type === 'void_dust') {
          return (
            <group key={p.id} position={[p.x, p.y, p.z]} rotation={[0, 0, p.rotation || 0]}>
              <mesh>
                <boxGeometry args={[scale * 1.8, scale * 0.35, 0.05]} />
                <meshStandardMaterial color="#ffffff" emissive={p.color} emissiveIntensity={4.5 * alpha} transparent opacity={alpha * 0.9} />
              </mesh>
              <mesh>
                <boxGeometry args={[scale * 0.35, scale * 1.8, 0.05]} />
                <meshStandardMaterial color="#ffffff" emissive={p.color} emissiveIntensity={4.5 * alpha} transparent opacity={alpha * 0.9} />
              </mesh>
            </group>
          );
        } else if (p.type === 'spark' || p.type === 'emp_spark') {
          return (
            <group key={p.id} position={[p.x, p.y, p.z]} rotation={[0, 0, p.rotation || 0]}>
              <mesh>
                <boxGeometry args={[scale * 2.4, scale * 0.26, 0.04]} />
                <meshStandardMaterial color="#ffffff" emissive={p.color} emissiveIntensity={5.5 * alpha} transparent opacity={alpha} />
              </mesh>
            </group>
          );
        } else if (p.type === 'ice_shard') {
          return (
            <group key={p.id} position={[p.x, p.y, p.z]} rotation={[p.rotX || 0, p.rotY || 0, p.rotation || 0]}>
              <mesh>
                <tetrahedronGeometry args={[scale * 1.4, 0]} />
                <meshStandardMaterial color="#c8f5ff" emissive="#00f7ff" emissiveIntensity={3.0 * alpha} transparent opacity={alpha * 0.9} />
              </mesh>
            </group>
          );
        } else {
          return (
            <mesh key={p.id} position={[p.x, p.y, p.z]}>
              <DetailSphere args={[scale * 0.8, 8, 8]} />
              <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={3.2 * alpha} transparent opacity={alpha * 0.8} />
            </mesh>
          );
        }
      })}
    </group>
  );
}

function FloatingTextOverlay({texts}: {texts: FloatingText[]}) {
  return (
    <group>
      {texts.map((t) => {
        const alpha = Math.max(0, t.life / t.maxLife);
        const scale = 1 + (1 - alpha) * 0.3;
        return (
          <group key={t.id} position={[t.x, t.y, t.z]}>
            <Html center distanceFactor={14}>
              <div
                style={{
                  opacity: alpha,
                  transform: `scale(${scale})`,
                  color: t.color,
                  textShadow: `0 0 12px ${t.color}, 0 0 24px rgba(0,0,0,0.9)`,
                }}
                className="font-mono font-black text-sm md:text-base tracking-widest whitespace-nowrap pointer-events-none select-none px-2.5 py-1 bg-black/75 rounded-lg border border-cyan-500/50 backdrop-blur-md shadow-lg shadow-cyan-950/60">
                {t.text}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function Dynamic3DCameraRig({
  shake,
  cameraMode,
  pointerPos,
}: {
  shake: number;
  cameraMode: CameraMode;
  pointerPos: {x: number; y: number};
}) {
  const {camera, size} = useThree();
  const currentPos = useRef(new THREE.Vector3(0, -0.2, 13.5));
  const currentLookAt = useRef(new THREE.Vector3(0, -0.2, 0));

  useFrame((_, delta) => {
    let targetX = 0;
    let targetY = -0.2;
    let targetZ = 13.5;
    let lookTargetX = 0;
    let lookTargetY = -0.2;
    let lookTargetZ = 0;

    if (cameraMode === '3d-angled') {
      targetX = pointerPos.x * 1.8;
      targetY = -1.2 + pointerPos.y * 1.4;
      targetZ = 13.0;
      lookTargetX = pointerPos.x * 0.4;
      lookTargetY = -0.2;
    } else if (cameraMode === 'cinematic') {
      targetX = pointerPos.x * 2.4;
      targetY = -2.8 + pointerPos.y * 0.8;
      targetZ = 11.5;
      lookTargetY = 0.5;
    } else {
      targetX = 0;
      targetY = -0.2;
      targetZ = 13.5;
      lookTargetY = -0.2;
    }

    const fit=boardCameraDistance(getConfig('gridRows'),getConfig('gridCols'),size.width/Math.max(1,size.height),getConfig('fov'));
    targetZ = Math.max(targetZ,fit*(cameraMode==='cinematic'?1.12:cameraMode==='3d-angled'?1.05:1));
    // An orientation change must not leave the board cropped while the camera catches up.
    if(currentPos.current.z<targetZ)currentPos.current.z=targetZ;
    const shakeX = (Math.random() - 0.5) * shake;
    const shakeY = (Math.random() - 0.5) * shake;

    scratchVec3A.set(targetX + shakeX, targetY + shakeY, targetZ);
    scratchVec3B.set(lookTargetX, lookTargetY, lookTargetZ);

    const lerpSpeed = Math.min(1, delta * 5.0);
    currentPos.current.lerp(scratchVec3A, lerpSpeed);
    currentLookAt.current.lerp(scratchVec3B, lerpSpeed);

    camera.position.copy(currentPos.current);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}


interface GameProps {
  gameState: any; setGameState: React.Dispatch<React.SetStateAction<any>>;
  gameStateRef: React.MutableRefObject<any>; exitChat?: (payload:Record<string,unknown>)=>Promise<void>;
  currentLevel:number; onDistrictWin:(score:number)=>void; onDistrictLose:()=>void;
  comboStreak:number; setComboStreak:(combo:number)=>void;
  initialTiles?:GridTile[]|null; initialSnapshot?:Snapshot; seed?:number; tutorial?:number;
  onSaveBoardState?:(tiles:GridTile[],score:number,snapshot?:Snapshot)=>void;
  cameraMode?:CameraMode; setCameraMode?:(mode:CameraMode)=>void;
  levelScore:number; setLevelScore:React.Dispatch<React.SetStateAction<number>>;
  activeBooster:BoosterType|null; setActiveBooster:(b:BoosterType|null)=>void; onConsumeBooster:(b:BoosterType)=>void;
  glitchWipeTriggerCount?:number; isPaused?:boolean; onProcessingChange?:(busy:boolean)=>void;
  preferences?:Preferences; accent?:string; pieceStyle?:string; themeLevel?:number; onProgress?:(snapshot:Snapshot)=>void;
}
function AdaptiveResolution({quality,paused=false,onLost}:{quality:Preferences['quality'];paused?:boolean;onLost:()=>void}) {
  const {setDpr,invalidate,size,gl}=useThree();
  const budget=useRef(new RenderBudget(1,60));
  useEffect(()=>{
    budget.current=new RenderBudget(pixelDensity(quality,window.devicePixelRatio,size.width,size.height),quality==='high'?60:quality==='medium'?45:30);
    setDpr(budget.current.dpr);invalidate();
  },[quality,size.width,size.height,setDpr,invalidate]);
  useEffect(()=>{
    const lost=(e:Event)=>{e.preventDefault();onLost();};
    gl.domElement.addEventListener('webglcontextlost',lost);
    return()=>gl.domElement.removeEventListener('webglcontextlost',lost);
  },[gl,onLost]);
  useEffect(()=>{
    if(paused)return;
    let id:number;const clock=new RenderClock();
    const tick=(time:number)=>{if(!document.hidden&&clock.ready(time,budget.current.fps))invalidate();id=requestAnimationFrame(tick);};
    id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id);
  },[paused,invalidate]);
  useFrame((_,delta)=>{if(!paused&&budget.current.sample(delta))setDpr(budget.current.dpr);});return null;
}

function SceneStatus({quality,onReady,theme}:{quality:Preferences['quality'];onReady:(names:string)=>void;theme:string}) {
  const {scene,gl,invalidate}=useThree();
  const frame=useRef(0),corner=useMemo(()=>new THREE.Vector3(),[]);
  useFrame(({camera})=>{
    if(frame.current++%20)return;
    const x=getConfig('gridCols')*CELL_SIZE/2+.35,y=getConfig('gridRows')*CELL_SIZE/2+.35;
    const corners=[[-x,-y],[-x,y],[x,-y],[x,y]].map(([cx,cy])=>{corner.set(cx,cy-.2,.8).project(camera);return [corner.x,corner.y];});
    gl.domElement.dataset.boardCorners=JSON.stringify(corners);
    gl.domElement.dataset.environment=scene.getObjectByName(`environment-${theme}`)?.name||'missing';
  });
  useEffect(()=>{frame.current=0;invalidate();const timer=setTimeout(()=>{gl.domElement.dataset.environment=scene.getObjectByName(`environment-${theme}`)?.name||'missing';onReady(['city','hacker','sentinel','holograms','floor'].filter(name=>!!scene.getObjectByName(name)).join(','));invalidate();},0);return()=>clearTimeout(timer);},[scene,gl,invalidate,quality,onReady,theme]);
  return null;
}

export function Game(props:GameProps) {
  const {gameState,setGameState,currentLevel,onDistrictWin,onDistrictLose,setLevelScore,setComboStreak,
    cameraMode='3d-angled',activeBooster,setActiveBooster,onConsumeBooster,isPaused=false,onProcessingChange,
    preferences={quality:'medium',reducedMotion:false,keyboard:true,hints:true}}=props;
  const rows=getConfig('gridRows')||8,cols=getConfig('gridCols')||8;
  const theme=themeForLevel(props.themeLevel??currentLevel),pieceStyle=props.pieceStyle||'classic';
  useEffect(()=>{gameAudio.setTheme(props.themeLevel??currentLevel);},[props.themeLevel,currentLevel]);
  const [engine]=useState(()=>{
    const e=new HeistEngine(currentLevel,props.seed??crypto.getRandomValues(new Uint32Array(1))[0],rows,cols,props.initialSnapshot,props.tutorial);
    if(props.initialTiles&&!props.initialSnapshot){e.state.tiles=structuredClone(props.initialTiles);e.state.score=props.levelScore;
      e.state.turn=Math.max(0,getDistrictForLevel(currentLevel).moves-props.gameState.moves);
      e.state.legacyScore=true;e.state.mission={...e.state.mission,kind:'score',target:getDistrictForLevel(currentLevel).targetScore,label:`Score ${getDistrictForLevel(currentLevel).targetScore} points`};}
    return e;
  });
  const [tiles,setTiles]=useState(()=>engine.snapshot().tiles);
  const [busy,setBusy]=useState(false),busyRef=useRef(false);
  const [selected,setSelectedState]=useState<[number,number]|null>(null),selectedRef=useRef(selected);
  const select=(p:[number,number]|null)=>{selectedRef.current=p;setSelectedState(p);};
  const [focus,setFocus]=useState<[number,number]>([0,0]);
  const [keyboardFocus,setKeyboardFocus]=useState(false);
  const [hint,setHint]=useState<Action|undefined>();
  const [activity,setActivity]=useState(0);
  const [sceneElements,setSceneElements]=useState('');
  const [lastFeedback,setLastFeedback]=useState('');
  const [message,setMessage]=useState('');
  const [particles,setParticles]=useState<RichParticle[]>([]);
  const [shockwaves,setShockwaves]=useState<ShockwaveRing[]>([]);
  const [laserBeams,setLaserBeams]=useState<LaserBeam[]>([]);
  const [floatingTexts,setFloatingTexts]=useState<FloatingText[]>([]);
  const [cameraShake,setCameraShake]=useState(0);
  const [hackerAction,setHackerAction]=useState<HackerAction>('idle');
  const visualSerial=useRef(0);
  const [run]=useState(()=>new GameRun());run.paused=isPaused;
  const latest=useRef(props);latest.current=props;
  const [pointer,setPointer]=useState({x:0,y:0});
  const drag=useRef<{row:number;col:number;x:number;y:number}|null>(null);
  useEffect(()=>()=>run.dispose(),[run]);
  useEffect(()=>{onProcessingChange?.(busy);},[busy,onProcessingChange]);
  const finish=()=>{busyRef.current=false;setBusy(false);};
  const spawnFireworks = useCallback((x: number, y: number, color: string, count = 24) => {
    const newParts: RichParticle[] = [];
    for (let i = 0; i < count; i++) {
      const speed = 3.5 + Math.random() * 7.0;
      const angle = Math.random() * Math.PI * 2;
      const zSpeed = (Math.random() - 0.5) * 6;
      newParts.push({
        id: `fw-${Date.now()}-${Math.random()}`,
        type: 'firework',
        x,
        y,
        z: 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: zSpeed,
        color,
        size: 0.16 + Math.random() * 0.12,
        life: 0.75,
        maxLife: 0.75,
        rotSpeed: (Math.random() - 0.5) * 14,
        rotX: Math.random() * Math.PI,
        rotY: Math.random() * Math.PI,
        rotation: Math.random() * Math.PI,
      });
    }
    if(latest.current.preferences?.reducedMotion)return;
    const cap=latest.current.preferences?.quality==='low'?96:latest.current.preferences?.quality==='medium'?192:384;
    setParticles(prev=>[...prev,...newParts].slice(-cap));
  }, []);

  const spawnStardust = useCallback((x: number, y: number, color: string, count = 14) => {
    const newParts: RichParticle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.8;
      newParts.push({
        id: `sd-${Date.now()}-${Math.random()}`,
        type: 'stardust',
        x: x + (Math.random() - 0.5) * 0.6,
        y: y + (Math.random() - 0.5) * 0.6,
        z: 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 1.4,
        vz: (Math.random() - 0.5) * 2.5,
        color,
        size: 0.13 + Math.random() * 0.09,
        life: 0.95,
        maxLife: 0.95,
        rotSpeed: (Math.random() - 0.5) * 8,
        rotation: 0,
      });
    }
    if(latest.current.preferences?.reducedMotion)return;
    const cap=latest.current.preferences?.quality==='low'?96:latest.current.preferences?.quality==='medium'?192:384;
    setParticles(prev=>[...prev,...newParts].slice(-cap));
  }, []);

  const spawnSplashes = useCallback((x: number, y: number, color: string, count = 18) => {
    const newParts: RichParticle[] = [];
    for (let i = 0; i < count; i++) {
      const speed = 2.2 + Math.random() * 5.0;
      const angle = Math.random() * Math.PI * 2;
      newParts.push({
        id: `sp-${Date.now()}-${Math.random()}`,
        type: 'splash',
        x,
        y,
        z: 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        vz: (Math.random() - 0.5) * 4,
        color,
        size: 0.11 + Math.random() * 0.09,
        life: 0.6,
        maxLife: 0.6,
      });
    }
    if(latest.current.preferences?.reducedMotion)return;
    const cap=latest.current.preferences?.quality==='low'?96:latest.current.preferences?.quality==='medium'?192:384;
    setParticles(prev=>[...prev,...newParts].slice(-cap));
  }, []);

  const spawnElectricSparks = useCallback((x: number, y: number, color = '#00f7ff', count = 20) => {
    const newParts: RichParticle[] = [];
    for (let i = 0; i < count; i++) {
      const speed = 4.5 + Math.random() * 8.0;
      const angle = Math.random() * Math.PI * 2;
      newParts.push({
        id: `elk-${Date.now()}-${Math.random()}`,
        type: 'spark',
        x,
        y,
        z: 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: (Math.random() - 0.5) * 5,
        color,
        size: 0.15 + Math.random() * 0.11,
        life: 0.55,
        maxLife: 0.55,
        rotSpeed: (Math.random() - 0.5) * 22,
        rotation: Math.random() * Math.PI,
      });
    }
    if(latest.current.preferences?.reducedMotion)return;
    const cap=latest.current.preferences?.quality==='low'?96:latest.current.preferences?.quality==='medium'?192:384;
    setParticles(prev=>[...prev,...newParts].slice(-cap));
  }, []);

  const spawnIceShatterShards = useCallback((x: number, y: number, count = 24) => {
    const newParts: RichParticle[] = [];
    for (let i = 0; i < count; i++) {
      const speed = 3.0 + Math.random() * 5.5;
      const angle = Math.random() * Math.PI * 2;
      newParts.push({
        id: `ice-${Date.now()}-${Math.random()}`,
        type: 'ice_shard',
        x,
        y,
        z: 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: (Math.random() - 0.5) * 5,
        color: '#c8f5ff',
        size: 0.16 + Math.random() * 0.14,
        life: 0.7,
        maxLife: 0.7,
        rotSpeed: (Math.random() - 0.5) * 12,
        rotX: Math.random() * Math.PI,
        rotY: Math.random() * Math.PI,
        rotation: Math.random() * Math.PI,
      });
    }
    if(latest.current.preferences?.reducedMotion)return;
    const cap=latest.current.preferences?.quality==='low'?96:latest.current.preferences?.quality==='medium'?192:384;
    setParticles(prev=>[...prev,...newParts].slice(-cap));
  }, []);

  const spawnShockwave = useCallback(
    (x: number, y: number, color: string, maxRadius = 2.4, duration = 0.48) => {
      if(latest.current.preferences?.reducedMotion)return;
      setShockwaves((prev) => [
        ...prev,
        {
          id: `sw-${Date.now()}-${Math.random()}`,
          x,
          y,
          z: 0.25,
          radius: 0.2,
          maxRadius,
          color,
          life: duration,
          maxLife: duration,
        },
      ]);
    },
    [],
  );

  const addFloatingText = useCallback(
    (text: string, color: string, x: number, y: number) => {
      setFloatingTexts((prev) => [
        ...prev,
        {
          id: `txt-${Date.now()}-${Math.random()}`,
          text,
          color,
          x,
          y,
          z: 0.9,
          life: 1.15,
          maxLife: 1.15,
        },
      ]);
    },
    [],
  );

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    const effectClock=new RenderClock();

    const loop = (time: number) => {
      const fps=latest.current.preferences?.quality==='low'?30:latest.current.preferences?.quality==='high'?60:45;
      if(!effectClock.ready(time,fps)){animId=requestAnimationFrame(loop);return;}
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      if(run.paused){animId=requestAnimationFrame(loop);return;}
      setParticles((prev) => prev.length ?
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx * dt,
            y: p.y + p.vy * dt,
            z: p.z + p.vz * dt,
            rotation: (p.rotation || 0) + (p.rotSpeed || 0) * dt,
            life: p.life - dt,
          }))
          .filter((p) => p.life > 0) : prev,
      );

      setShockwaves((prev) => prev.length ?
        prev
          .map((sw) => {
            const growthRate = (sw.maxRadius - 0.2) / sw.maxLife;
            return {
              ...sw,
              radius: sw.radius + growthRate * dt,
              life: sw.life - dt,
            };
          })
          .filter((sw) => sw.life > 0) : prev,
      );

      setLaserBeams((prev) => prev.length ?
        prev
          .map((b) => ({...b, life: b.life - dt}))
          .filter((b) => b.life > 0) : prev,
      );

      setFloatingTexts((prev) => prev.length ?
        prev
          .map((t) => ({...t, y: t.y + (latest.current.preferences?.reducedMotion?0:dt * 0.95), life: t.life - dt}))
          .filter((t) => t.life > 0) : prev,
      );

      setCameraShake((prev) => Math.max(0, prev - dt * 3.0));

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);


  const presentFrame=(frame:Frame)=>{
    setLastFeedback(frame.effect||'match');
    const cleared=frame.tiles.filter(t=>frame.cleared.includes(t.id));
    const center=cleared[0]||frame.created?.[0]||frame.tiles[0];
    const x=center?.targetX||0,y=(center?.targetY||0)-.2;
    const laser=(tile:GridTile,vertical:boolean)=>{
      if(preferences.reducedMotion)return;
      const beam:LaserBeam={id:'beam-'+(++visualSerial.current),type:vertical?'col':'row',startX:vertical?tile.targetX:-cols*CELL_SIZE/2,
        startY:vertical?rows*CELL_SIZE/2:tile.targetY-.2,endX:vertical?tile.targetX:cols*CELL_SIZE/2,endY:vertical?-rows*CELL_SIZE/2:tile.targetY-.2,color:'#00f7ff',life:.55,maxLife:.55};
      setLaserBeams(prev=>[...prev,beam].slice(-24));
    };
    if(frame.effect==='swap'){gameAudio.playCrispClick();setHackerAction('typing');}
    if(frame.effect==='invalid'){gameAudio.playErrorBuzz();setMessage('No match. Try another route.');}
    if(frame.effect==='match'&&cleared.length){gameAudio.playCoinPickup();setHackerAction(frame.combo>2?'celebrate':'typing');}
    if(frame.effect==='laser'){gameAudio.playArcadeLaser();setHackerAction('blast');
      const rowsHit=[...new Set(cleared.map(t=>t.row))],colsHit=[...new Set(cleared.map(t=>t.col))];
      for(const row of rowsHit.filter(r=>cleared.filter(t=>t.row===r).length>=cols-2))laser(frame.tiles.find(t=>t.row===row)!,false);
      for(const col of colsHit.filter(c=>cleared.filter(t=>t.col===c).length>=rows-2))laser(frame.tiles.find(t=>t.col===col)!,true);
      if(!rowsHit.length&&!colsHit.length){laser(center,false);laser(center,true);}
    }
    if(frame.effect==='emp'||frame.effect==='purge'){gameAudio.playChiptuneExplosion();setHackerAction('blast');spawnShockwave(x,y,frame.effect==='purge'?'#00ff88':'#ffb700',4,.65);if(!preferences.reducedMotion)setCameraShake(.25);}
    if(frame.effect==='overload'||frame.effect==='inject'){gameAudio.playPowerupChime();gameAudio.playArcadeLaser();setHackerAction('blast');spawnShockwave(x,y,'#b026ff',5,.65);
      for(const t of cleared.slice(0,24))if(!preferences.reducedMotion)setLaserBeams(prev=>[...prev,{id:'arc-'+(++visualSerial.current),type:'lightning' as const,startX:x,startY:y,endX:t.targetX,endY:t.targetY-.2,color:TOKEN_COLORS[t.type],life:.45,maxLife:.45}].slice(-32));}
    if(frame.effect==='boss'){gameAudio.playShieldBlock();setHackerAction('tense');setMessage(frame.message||'Security lockdown!');spawnShockwave(0,0,'#ff0077',6,.7);}
    for(const special of frame.specials||[]){
      if(special.special.startsWith('line')){gameAudio.playArcadeLaser();if(special.special==='lineCross'){const lines=crossLines(special.row,special.col,rows,cols);for(const row of lines.rows)laser({...special,targetY:((rows-1)/2-row)*CELL_SIZE},false);for(const col of lines.cols)laser({...special,targetX:(col-(cols-1)/2)*CELL_SIZE},true);}else laser(special,special.special==='lineV');}
      else if(special.special==='bomb'){gameAudio.playChiptuneExplosion();spawnShockwave(special.targetX,special.targetY-.2,'#ffb700',2.5);}
      else if(special.special==='overload'){gameAudio.playPowerupChime();spawnShockwave(special.targetX,special.targetY-.2,'#b026ff',4);}
    }
    for(const t of cleared){
      const color=TOKEN_COLORS[t.type];
      if(t.type===0)spawnStardust(t.targetX,t.targetY-.2,color,8);
      else if(t.type===1)spawnElectricSparks(t.targetX,t.targetY-.2,color,8);
      else if(t.type===2)spawnFireworks(t.targetX,t.targetY-.2,color,8);
      else if(t.type===3)spawnSplashes(t.targetX,t.targetY-.2,color,8);
      else spawnElectricSparks(t.targetX,t.targetY-.2,color,8);
    }
    for(const t of frame.hazards||[]){
      gameAudio.playShieldBlock();
      if(t.obstacleType==='ice'||t.obstacleType==='plasma_shield')spawnIceShatterShards(t.targetX,t.targetY-.2,12);
      else if(t.obstacleType==='void')spawnStardust(t.targetX,t.targetY-.2,'#b026ff',12);
      else spawnElectricSparks(t.targetX,t.targetY-.2,'#00ff88',12);
      spawnShockwave(t.targetX,t.targetY-.2,'#00f7ff',1.3);
    }
    if(frame.created?.length){gameAudio.playPowerupChime();for(const t of frame.created){spawnStardust(t.targetX,t.targetY-.2,'#ffe600',14);addFloatingText(t.special==='overload'?'OVERLOAD':t.special==='bomb'?'EMP CREATED':'LASER CREATED','#ffe600',t.targetX,t.targetY-.2);}}
    if(frame.points){addFloatingText(frame.combo>1?`CASCADE x${frame.combo} · +${frame.points}`:`+${frame.points}`,'#00f7ff',x,y);if(frame.combo>2)gameAudio.playPowerupChime();}
  };

  const act=async(action:Action)=>{
    const p=latest.current;
    if(!run.active||run.paused||busyRef.current||p.gameState.status!=='PLAYING'||(p.gameState.moves<=0&&action.kind!=='booster'))return;
    if(p.tutorial&&!trainingSwap(action)){gameAudio.playErrorBuzz();setMessage('Practice safely: swap row 2, column 2 with the piece directly above it. No move was spent.');return;}
    const result=engine.action(action);
    if(!result.accepted){if(action.kind==='booster'&&action.booster==='overload_core'){gameAudio.playErrorBuzz();setMessage('Choose an unshielded token for Overload. Packets and vaults keep their objectives. Booster kept.');}return;}
    busyRef.current=true;setBusy(true);select(null);setHint(undefined);drag.current=null;
    if(result.spendsMove)setGameState((s:any)=>({...s,moves:s.moves-1+(result.bonusMoves||0)}));
    if(result.bonusMoves){gameAudio.playPowerupChime();addFloatingText('+5 MOVES','#00ff88',0,0);}
    if(action.kind==='booster'){onConsumeBooster(action.booster);setActiveBooster(null);}
    for(const frame of result.frames){
      setTiles(frame.tiles);setComboStreak(frame.combo);
      if(frame.message)setMessage(frame.message);
      if(frame.points){setLevelScore(s=>s+frame.points);setGameState((s:any)=>({...s,score:s.score+frame.points}));}
      presentFrame(frame);
      if(!(await run.wait(preferences.reducedMotion?60:frame.effect==='swap'?190:220)))return;
      if(frame.settled){setTiles(frame.settled);gameAudio.playJumpLandingThud();if(!(await run.wait(preferences.reducedMotion?40:270)))return;}
    }
    setTiles(engine.snapshot().tiles);setComboStreak(0);setHackerAction(latest.current.gameState.moves<=5?'tense':'idle');finish();
  };
  const actRef=useRef(act);actRef.current=act;
  const click=(e:any,row:number,col:number)=>{
    if(run.paused||busyRef.current||latest.current.gameState.status!=='PLAYING')return;
    setHint(undefined);setActivity(n=>n+1);
    setKeyboardFocus(false);setFocus([row,col]);const at:[number,number]=[row,col],t=engine.at(at);if(!t)return;
    const booster=latest.current.activeBooster;
    if(booster){void actRef.current({kind:'booster',booster,at});return;}
    if(t.locked){gameAudio.playErrorBuzz();setMessage(t.vault?'Vault weak point: match beside it.':`${hazardName(t)} · Shield health ${t.lockHealth}. Match beside this hazard.`);return;}
    const previous=selectedRef.current;
    if(latest.current.tutorial&&!previous&&!(col===1&&(row===0||row===1))){setMessage('Start with the cyan diamond at row 2, column 2. The outlined pair shows your practice swap.');return;}
    if(previous&&previous[0]===row&&previous[1]===col){if(t.special!=='none')void actRef.current({kind:'special',at});else select(null);return;}
    if(previous&&Math.abs(previous[0]-row)+Math.abs(previous[1]-col)===1){void actRef.current({kind:'swap',from:previous,to:at});return;}
    if(!previous&&t.special!=='none')setMessage('Tap this special again to fire, or select an adjacent special to combine them.');
    gameAudio.playHoverMicroTone();select(at);
    if(typeof e?.clientX==='number')drag.current={row,col,x:e.clientX,y:e.clientY};
  };
  const clickRef=useRef(click);clickRef.current=click;
  const dispatch=useCallback((e:any,r:number,c:number)=>clickRef.current(e,r,c),[]);
  useEffect(()=>{
    const move=(e:PointerEvent)=>{
      const d=drag.current;if(!d||busyRef.current||run.paused)return;
      const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)<24)return;
      const to:[number,number]=Math.abs(dx)>Math.abs(dy)?[d.row,d.col+Math.sign(dx)]:[d.row+Math.sign(dy),d.col];
      drag.current=null;if(to[0]>=0&&to[0]<rows&&to[1]>=0&&to[1]<cols)void actRef.current({kind:'swap',from:[d.row,d.col],to});
    };
    const up=()=>{drag.current=null;};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};
  },[run,rows,cols]);
  const lastPurge=useRef(props.glitchWipeTriggerCount??0);
  useEffect(()=>{const n=props.glitchWipeTriggerCount??0;if(n>lastPurge.current){lastPurge.current=n;void actRef.current({kind:'booster',booster:'glitch_wipe'});}},[props.glitchWipeTriggerCount]);
  useEffect(()=>{
    if(isPaused||busy||gameState.status!=='PLAYING')return;
    const s=engine.snapshot();props.onProgress?.(s);
    if(engine.complete()){onDistrictWin(engine.state.score);return;}
    if(gameState.moves<=0){onDistrictLose();return;}
    props.onSaveBoardState?.(s.tiles,engine.state.score,s);
  },[tiles,busy,isPaused,gameState.moves,gameState.status,engine,onDistrictWin,onDistrictLose,props.onSaveBoardState,props.onProgress]);
  useEffect(()=>{
    if(!preferences.hints||busy||isPaused||gameState.status!=='PLAYING')return;
    const timer=setTimeout(()=>setHint(engine.hint()),7000);return()=>clearTimeout(timer);
  },[tiles,selected,busy,isPaused,gameState.status,preferences.hints,engine,activity]);
  useEffect(()=>{if(!hint||isPaused)return;const timer=setTimeout(()=>setHint(undefined),6000);return()=>clearTimeout(timer);},[hint,isPaused]);
  const key=(e:React.KeyboardEvent)=>{
    if(!preferences.keyboard||run.paused||busyRef.current)return;
    const dirs:Record<string,[number,number]>={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
    if(!dirs[e.key]&&e.key!=='Enter'&&e.key!==' ')return;
    setKeyboardFocus(true);setHint(undefined);setActivity(n=>n+1);
    if(dirs[e.key]){
      e.preventDefault();const d=dirs[e.key],to:[number,number]=[Math.max(0,Math.min(rows-1,focus[0]+d[0])),Math.max(0,Math.min(cols-1,focus[1]+d[1]))];
      if(e.shiftKey)void actRef.current({kind:'swap',from:focus,to});setFocus(to);
    }else if(e.key==='Enter'||e.key===' '){e.preventDefault();clickRef.current({},...focus);}
  };
  const hintAt=(tile:GridTile)=>props.tutorial&&engine.state.turn===0?tile.col===1&&(tile.row===0||tile.row===1):hint?.kind==='swap'?[hint.from,hint.to].some(p=>p[0]===tile.row&&p[1]===tile.col):hint?.kind==='special'&&hint.at[0]===tile.row&&hint.at[1]===tile.col;
  const focused=engine.at(focus);
  const accent=props.accent||getDistrictForLevel(currentLevel).accentColor;
  return <div data-testid="game-board" data-theme={theme.id} data-motion={theme.motion} data-pieces={pieceStyle} data-training={!!props.tutorial} data-paused={isPaused} style={{'--chapter-primary':theme.primary,'--chapter-secondary':theme.secondary,'--chapter-sky':theme.sky} as React.CSSProperties} data-hint={tiles.filter(hintAt).map(t=>`${t.row},${t.col}`).join(';')} data-seed={engine.state.seed} data-turn={engine.state.turn} data-scene-elements={sceneElements} data-feedback={lastFeedback} data-particles={particles.length} data-beams={laserBeams.length} data-shockwaves={shockwaves.length} data-busy={busy} data-selected={selected?selected.join(','):''}
    className="w-full h-full relative select-none" onPointerLeave={()=>setPointer({x:0,y:0})} onPointerMove={e=>{if(preferences.reducedMotion||e.pointerType!=='mouse')return;const r=e.currentTarget.getBoundingClientRect();setPointer({x:2*(e.clientX-r.left)/r.width-1,y:1-2*(e.clientY-r.top)/r.height});}}
    onKeyDown={key} tabIndex={preferences.keyboard?0:-1} role="application" aria-label="Matrix board. Arrow keys move focus. Enter selects. Shift and arrow swaps.">
    <div className="matrix-stage"><SceneSurface fallback={<FlatBoard pieceStyle={pieceStyle} motion={theme.motion} tiles={tiles} rows={rows} cols={cols} selected={(selected||(keyboardFocus?focus:null))?.join(',')||''} hints={tiles.filter(hintAt).map(t=>`${t.row},${t.col}`)} onTile={dispatch} particles={particles} rings={shockwaves} texts={floatingTexts} beams={laserBeams}/>}>
    {onLost=><MotionContext.Provider value={isPaused||preferences.reducedMotion}><DetailContext.Provider value={preferences.quality}><PiecesContext.Provider value={pieceStyle}>
    <Canvas key={preferences.quality} frameloop="demand" dpr={[.5,preferences.quality==='high'?1.75:preferences.quality==='medium'?1.25:1]} gl={{antialias:preferences.quality==='high',powerPreference:'high-performance'}}
      camera={{position:[0,-.2,13.5],fov:getConfig('fov')||48}} className="w-full h-full block">
      <color attach="background" args={[theme.sky]}/>
      <AdaptiveResolution quality={preferences.quality} paused={isPaused} onLost={onLost}/><SceneStatus theme={theme.id} quality={preferences.quality} onReady={setSceneElements}/>
      <hemisphereLight color={theme.secondary} groundColor="#0b132b" intensity={1.1}/>
      <directionalLight position={[7,12,9]} intensity={3.6} color={accent}/>
      <directionalLight position={[-7,-9,7]} intensity={2} color={theme.secondary}/><ambientLight color="#151c38" intensity={1.8}/>
      <Dynamic3DCameraRig shake={preferences.reducedMotion?0:cameraShake} cameraMode={preferences.reducedMotion?'top-down':cameraMode} pointerPos={isPaused?{x:0,y:0}:pointer}/>
      <CyberCasinoEnvironment theme={theme}/>
      <SecuritySentinelDrone comboStreak={props.comboStreak}/><FloatingHoloDisplays district={{...getDistrictForLevel(currentLevel),accentColor:theme.primary}}/><HolographicFloorPlatform accentColor={theme.primary}/>
      <CyberHackerCharacter accent={accent} hackerAction={hackerAction} speechText={message}/>
        {/* Matrix Board Frame & Glowing Outer Border (No wireframe diagonal artifacts) */}
        <group position={[0, -0.2, -0.2]}>
          {/* Solid backboard */}
          <mesh>
            <boxGeometry args={[cols * CELL_SIZE + 0.6, rows * CELL_SIZE + 0.6, 0.24]} />
            <meshStandardMaterial
              color="#02040c"
              emissive="#060c22"
              emissiveIntensity={0.7}
              metalness={0.92}
              roughness={0.18}
            />
          </mesh>

          {/* Clean 4-Edge Glowing Perimeter Border */}
          <group position={[0, 0, 0.13]}>
            {Array.from({length:cols-1},(_,i)=><mesh key={`grid-v-${i}`} position={[(i+1-cols/2)*CELL_SIZE,0,0]}><boxGeometry args={[.01,rows*CELL_SIZE,.005]}/><meshStandardMaterial color="#172033" emissive="#07101c" emissiveIntensity={.1} roughness={.9}/></mesh>)}
            {Array.from({length:rows-1},(_,i)=><mesh key={`grid-h-${i}`} position={[0,(rows/2-i-1)*CELL_SIZE,0]}><boxGeometry args={[cols*CELL_SIZE,.01,.005]}/><meshStandardMaterial color="#172033" emissive="#07101c" emissiveIntensity={.1} roughness={.9}/></mesh>)}
            {/* Top border */}
            <mesh position={[0, (rows * CELL_SIZE + 0.4) / 2, 0]}>
              <boxGeometry args={[cols * CELL_SIZE + 0.44, 0.08, 0.04]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive={accent}
                emissiveIntensity={3.2}
              />
            </mesh>
            {/* Bottom border */}
            <mesh position={[0, -(rows * CELL_SIZE + 0.4) / 2, 0]}>
              <boxGeometry args={[cols * CELL_SIZE + 0.44, 0.08, 0.04]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive={accent}
                emissiveIntensity={3.2}
              />
            </mesh>
            {/* Left border */}
            <mesh position={[-(cols * CELL_SIZE + 0.4) / 2, 0, 0]}>
              <boxGeometry args={[0.08, rows * CELL_SIZE + 0.44, 0.04]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive={accent}
                emissiveIntensity={3.2}
              />
            </mesh>
            {/* Right border */}
            <mesh position={[(cols * CELL_SIZE + 0.4) / 2, 0, 0]}>
              <boxGeometry args={[0.08, rows * CELL_SIZE + 0.44, 0.04]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive={accent}
                emissiveIntensity={3.2}
              />
            </mesh>

            {/* Corner cyber nodes */}
            {[
              [-(cols * CELL_SIZE + 0.4) / 2, (rows * CELL_SIZE + 0.4) / 2],
              [(cols * CELL_SIZE + 0.4) / 2, (rows * CELL_SIZE + 0.4) / 2],
              [-(cols * CELL_SIZE + 0.4) / 2, -(rows * CELL_SIZE + 0.4) / 2],
              [(cols * CELL_SIZE + 0.4) / 2, -(rows * CELL_SIZE + 0.4) / 2],
            ].map(([cx, cy], idx) => (
              <mesh key={idx} position={[cx, cy, 0.02]}>
                <boxGeometry args={[0.22, 0.22, 0.06]} />
                <meshStandardMaterial
                  color="#ffffff"
                  emissive={accent}
                  emissiveIntensity={4.0}
                />
              </mesh>
            ))}
          </group>
        </group>


      <group position={[0,-.2,0]}>
        {tiles.map(t=><React.Fragment key={t.id}>
          <BoardTile tile={t} isSelected={!!hintAt(t)||(keyboardFocus&&focus[0]===t.row&&focus[1]===t.col)||selected?.[0]===t.row&&selected?.[1]===t.col} isDraggingThis={false} dragOffset={{x:0,y:0}} isGlitching={false} onTilePointerDown={dispatch}/>
          {(t.locked||t.packet||t.vault)&&<Html position={[t.targetX,t.targetY-.32,.9]} center style={{pointerEvents:'none'}}>
            <span className="tile-symbol" aria-hidden="true">{t.packet?'▤ ↓':t.vault?`VAULT ${Math.max(0,engine.state.mission.target-engine.state.progress.vault)}`:t.obstacleType==='lock'?`LOCK ${t.lockHealth}`:`▰ ${t.lockHealth}`}</span>
          </Html>}
        </React.Fragment>)}
      </group>
      <ShockwaveRingsOverlay rings={shockwaves}/><LaserBeamsOverlay beams={laserBeams}/><RichParticlesOverlay particles={particles}/><FloatingTextOverlay texts={floatingTexts}/>
    </Canvas></PiecesContext.Provider></DetailContext.Provider></MotionContext.Provider>}
    </SceneSurface></div>
    <div className="mission-strip" data-testid="mission-progress" aria-live="polite">
      <span>{engine.state.mission.label} · {Math.min(engine.progressValue(),engine.state.mission.target)}/{engine.state.mission.target}</span>
      {engine.state.mission.boss&&<span className="text-amber-300" data-testid="boss-warning">{engine.bossWarning()}</span>}
      {!props.tutorial&&<span className="chapter-name">{theme.name} · chapter {Math.floor(((props.themeLevel??currentLevel)-1)/10)+1}</span>}
    </div>
    {!!props.tutorial&&<aside className="training-coach" aria-label="Training guide" data-testid="training-guide"><strong>LESSON {props.tutorial}/3 · {lesson(props.tutorial).title}</strong><p>{lesson(props.tutorial).goal}</p><p className="training-step" aria-live="polite">{busy?'Watch the match clear, then the pieces fall.':selected?.[0]===1&&selected?.[1]===1?'2 · Now select the chip directly above it at row 1, column 2.':'1 · Select the cyan diamond at row 2, column 2 (outlined).'}</p><small>Tap the two pieces, or drag upward. Keyboard: arrows to R2 C2, then Shift + ↑. Practice mistakes cost no moves.</small></aside>}
    <div className="board-tools">
      <button className="cyber-button" disabled={busy||isPaused} onClick={()=>{gameAudio.playCrispClick();setHint(engine.hint());}}>HINT</button>
      {preferences.keyboard&&<span className="keyboard-readout" role="status">R{focus[0]+1} C{focus[1]+1}: {focused?.packet?'Data packet':focused?.vault?'Vault':TOKEN_NAMES[focused?.type??0]}{focused?.special==='lineCross'?' · Cross Laser':''}{focused?.locked?` · ${hazardName(focused)} · shield ${focused.lockHealth}`:''}. Arrows · Enter · Shift+arrow</span>}
    </div>
    {message&&<p className="board-message" role="status">{message}</p>}
  </div>;
}

export function MainMenuScene({preferences,accent='#00f7ff',isPaused=false,level=1}:{preferences:Preferences;accent?:string;isPaused?:boolean;level?:number}) {
  const theme=themeForLevel(level);
  return <div className="main-menu-scene" data-testid="main-menu-scene" data-theme={theme.id} style={{'--chapter-primary':theme.primary,'--chapter-secondary':theme.secondary,'--chapter-sky':theme.sky} as React.CSSProperties} aria-hidden="true">
    <SceneSurface decorative fallback={<div className="menu-city-fallback"/>}>{onLost=><MotionContext.Provider value={preferences.reducedMotion||isPaused}><DetailContext.Provider value={preferences.quality}><Canvas key={preferences.quality} frameloop="demand" camera={{position:[0,-.2,18],fov:48}} dpr={[.5,preferences.quality==='low'?1:preferences.quality==='medium'?1.25:1.75]} gl={{antialias:preferences.quality==='high'}}>
      <AdaptiveResolution quality={preferences.quality} paused={isPaused} onLost={onLost}/>
      <color attach="background" args={[theme.sky]}/>
      <hemisphereLight color={theme.secondary} groundColor="#0b132b" intensity={1.1}/>
      <directionalLight position={[7,12,9]} intensity={3.6} color={accent}/>
      <directionalLight position={[-7,-9,7]} intensity={2} color={theme.secondary}/>
      <ambientLight color="#151c38" intensity={1.8}/>
      <CyberCasinoEnvironment theme={theme}/><SecuritySentinelDrone comboStreak={0}/><HolographicFloorPlatform accentColor={accent}/>
      <FloatingHoloDisplays district={getDistrictForLevel(1)}/>
      <CyberHackerCharacter accent={accent} hackerAction="idle" speechText="Choose your next heist."/>
    </Canvas></DetailContext.Provider></MotionContext.Provider>}</SceneSurface>
  </div>;
}
