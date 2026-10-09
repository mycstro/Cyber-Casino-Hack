// tslint:disable
/* eslint-disable */
import {
  Activity,
  Award,
  Eye,
  HelpCircle,
  Music,
  Play,
  RotateCw,
  Settings,
  Shield,
  Shuffle,
  SkipForward,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AVAILABLE_MUSIC_TRACKS, getConfig} from './constants';
import type {CameraMode} from './Game';
import {getDistrictForLevel, dailyChallenge} from './game/campaign';
import {COSMETICS, PIECE_STYLES, canEquipPieces, readCareer, recordCompletion, type Career} from './game/progression';
import {themeForLevel} from './game/themes';
import {lesson,LESSONS} from './game/training';
import {readTraining,recordTraining,readPendingTraining,pendingTrainingPerformance,TrainingQueueSync,trainingQueueKey} from './game/training-progress';
import {TrainingAcademy} from './components/TrainingAcademy';
import {readPreferences} from './game/preferences';
import {displayLayout} from './game/display';
import {createRequestId} from './game/id';
import {useOnline,onlineApi,type Room,type Profile} from './game/online';
import {OnlinePanel} from './components/OnlinePanel';
import {HeistHub, PreferencesPanel} from './components/HeistHub';
import type {Snapshot,Action} from './game/engine';
import {readStorage, writeStorage} from './game/storage';
import {loadScene} from './game/scene-loader';
import {activeHazards} from './game/hazards';
import {BonusRound} from './components/BonusRound';
import {BONUS_KEY,createBonus,claimBonus,recoverBonus,readBonus,type BonusRound as BonusData} from './game/bonus';
import type {ExperienceReward} from './game/experience';
const Game = React.lazy(() => loadScene().then(m=>({default:m.Game})));
const MainMenuScene = React.lazy(() => loadScene().then(m=>({default:m.MainMenuScene})));
import {BoosterInventory, BoosterType, GridTile} from './types';
import BackgroundMusic from './utils/BackgroundMusic';
import {
  gameAudio,
  GameState,
  MenuOverlay,
  MusicTrack,
  useAutoFocus,
  useIsMobile,
} from './utils/helper';
import {
  usePlayground,
  usePlaygroundGameLifecycle,
  useRpc,
} from './utils/usePlayground';

import {parseSavedGame, parseBoosters, type SavedGameData} from './game/persistence';

interface AudioSettings {
  sfxMuted: boolean;
  sfxVolume: number;
  bgmMuted: boolean;
  bgmVolume: number;
}

const SAVE_STORAGE_KEY = 'cyber_casino_save_v5';
const SETTINGS_STORAGE_KEY = 'cyber_casino_settings_v5';
const BOOSTERS_STORAGE_KEY = 'cyber_casino_boosters_v5';

const DEFAULT_BOOSTERS: BoosterInventory = {
  emp_bomb: 2,
  line_laser: 2,
  overload_core: 1,
  overclock_moves: 2,
  glitch_wipe: 1,
};
type RunOptions={mode?:'campaign'|'daily'|'tutorial'|'multiplayer';tutorial?:number;seed?:number;snapshot?:Snapshot};
type DeferredRun=[number,GridTile[]|null,number|undefined,number|undefined,number|undefined,RunOptions|undefined];

export default function App() {
  const {sdk} = usePlayground();
  const [exitChat] = useRpc<Record<string, unknown>, void>('ExitChat');
  const isMobile = useIsMobile();

  const [currentLevel, setCurrentLevel] = useState(1);
  const [levelScore, setLevelScore] = useState(0);
  const [comboStreak, setComboStreak] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const currentRunKey=useRef(gameKey);currentRunKey.current=gameKey;
  const [initialTiles, setInitialTiles] = useState<GridTile[] | null>(null);

  const [mode,setMode] = useState<'campaign'|'daily'|'tutorial'|'multiplayer'>('campaign');
  const modeRef=useRef(mode);modeRef.current=mode;
  const [tutorial,setTutorial]=useState(0);
  const [academyOpen,setAcademyOpen]=useState(false);
  const [trainingPerformance,setTrainingPerformance]=useState(()=>readTraining(readStorage('cyber_casino_training_v2'),LESSONS.length));
  const [trainingQueueRevision,setTrainingQueueRevision]=useState(0);
  const trainingSync=useRef(new TrainingQueueSync<Profile>());
  const trainingRun=useRef<{lesson:number;finished:boolean;mistakes:number;accountId?:string}>();
  const trainingRecorder=useRef<(completed:boolean)=>void>(()=>{});
  const [seed,setSeed]=useState<number|undefined>();
  const [initialSnapshot,setInitialSnapshot]=useState<Snapshot|undefined>();
  const [snapshot,setSnapshot]=useState<Snapshot|undefined>();
  const boostersUsed=useRef(0);
  const soloReceipt=useRef<{key:number;id:string;sequence:number;pending?:{action:string;requestId:string}}>();
  const accountInventory=useRef(false);
  const localCampaign=useRef(false);
  const accountProfile=useRef<ReturnType<typeof useOnline>['user']>(null);
  const onlineBonusId=useRef<string>();
  const latestSnapshot=useRef<Snapshot>();
  const handleProgress=useCallback((s:Snapshot)=>{latestSnapshot.current=s;setSnapshot(s);},[]);
  const [lastExperience,setLastExperience]=useState<ExperienceReward|null>(null);
  const [bonus,setBonus]=useState<BonusData|null>(()=>{try{return recoverBonus(localStorage);}catch{return readBonus(readStorage(BONUS_KEY));}});
  const bonusRef=useRef(bonus);bonusRef.current=bonus;
  const [bonusOpen,setBonusOpen]=useState(!!bonus);
  const deferredRun=useRef<DeferredRun>();
  const [career,setCareer]=useState<Career>(()=>readCareer(readStorage('cyber_casino_career_v1')));
  const careerRef=useRef(career);careerRef.current=career;
  const [preferences,setPreferences]=useState(()=>readPreferences(readStorage('cyber_casino_preferences_v1')));
  const [viewport,setViewport]=useState(()=>({width:window.innerWidth,height:window.innerHeight}));
  useEffect(()=>{const resized=()=>setViewport({width:window.innerWidth,height:window.innerHeight});window.addEventListener('resize',resized);return()=>window.removeEventListener('resize',resized);},[]);
  const display=displayLayout(viewport.width,viewport.height,preferences.resolution);
  const [hubOpen,setHubOpen]=useState(false);
  const [dailyBest,setDailyBest]=useState<number>(()=>{try {const v=JSON.parse(localStorage.getItem('cyber_casino_daily_v1')||'{}');return v.day===dailyChallenge().day&&Number.isFinite(v.score)&&v.score>=0?v.score:0;}catch{return 0;}});
  const dailyRun=useRef(dailyChallenge());
  const [lastStars,setLastStars]=useState(0);
  const [piecesWon,setPiecesWon]=useState<string[]>([]);
  const [runBoosters,setRunBoosters]=useState<BoosterInventory>({...DEFAULT_BOOSTERS});
  useEffect(()=>{writeStorage('cyber_casino_career_v1',career);},[career]);
  useEffect(()=>{writeStorage('cyber_casino_preferences_v1',preferences);},[preferences]);
  // Booster and power-up state
  const [careerBoosters, setCareerBoosters] = useState<BoosterInventory>(() => {
    try {
      return parseBoosters(localStorage.getItem(BOOSTERS_STORAGE_KEY), DEFAULT_BOOSTERS);
    } catch (_) {}
    return DEFAULT_BOOSTERS;
  });

  const boosters = mode==='campaign'&&!localCampaign.current?careerBoosters:runBoosters;
  const setBoosters=useCallback((update:React.SetStateAction<BoosterInventory>)=>{
    if(modeRef.current==='campaign'&&!localCampaign.current)setCareerBoosters(update);else setRunBoosters(update);
  },[]);
  const [isBoardBusy, setIsBoardBusy] = useState(false);
  const completedRunRef = useRef(false);
  const [activeBooster, setActiveBooster] = useState<BoosterType | null>(null);
  const [glitchWipeTriggerCount, setGlitchWipeTriggerCount] = useState(0);
  const [lastLevelRewards, setLastLevelRewards] = useState<Partial<BoosterInventory> | null>(null);
  const [boosterNotification, setBoosterNotification] = useState<string | null>(null);
  const notificationTimeoutRef = useRef<any>(null);

  const [cameraMode, setCameraMode] = useState<CameraMode>(() => {
    try {
      const stored = localStorage.getItem('cyber_casino_camera_mode');
      if (stored === '3d-angled' || stored === 'cinematic' || stored === 'top-down') {
        return stored;
      }
    } catch (_) {}
    return '3d-angled';
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(() =>
    Math.floor(Math.random() * AVAILABLE_MUSIC_TRACKS.length),
  );
  const [currentTrack, setCurrentTrack] = useState<MusicTrack>(
    AVAILABLE_MUSIC_TRACKS[0],
  );
  const [isShuffleActive, setIsShuffleActive] = useState<boolean>(true);

  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          sfxMuted: !!parsed.sfxMuted,
          sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : 0.7,
          bgmMuted: !!parsed.bgmMuted,
          bgmVolume: typeof parsed.bgmVolume === 'number' ? parsed.bgmVolume : 0.4,
        };
      }
    } catch (_) {}
    return {
      sfxMuted: false,
      sfxVolume: 0.7,
      bgmMuted: false,
      bgmVolume: 0.4,
    };
  });

  const [savedGame, setSavedGame] = useState<SavedGameData | null>(() => {
    try {
      return parseSavedGame(localStorage.getItem(SAVE_STORAGE_KEY), getConfig('gridRows'), getConfig('gridCols'), getDistrictForLevel);
    } catch (_) {}
    return null;
  });

  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSource, setSettingsSource] = useState<'START' | 'MENU'>('START');
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [howToPlaySource, setHowToPlaySource] = useState<'START' | 'MENU'>('START');

  const currentDistrict = useMemo(() => getDistrictForLevel(currentLevel), [currentLevel]);

  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    score: 0,
    level: 1,
    moves: currentDistrict.moves,
  });

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Persist booster inventory
  useEffect(() => {
    try {
      if(!accountInventory.current)localStorage.setItem(BOOSTERS_STORAGE_KEY, JSON.stringify(careerBoosters));
    } catch (_) {}
  }, [careerBoosters]);

  useEffect(() => {
    gameAudio.setVolume(audioSettings.sfxVolume);
    gameAudio.setMuted(audioSettings.sfxMuted);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(audioSettings));
    } catch (_) {}
  }, [audioSettings]);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).canHandleBackKey = [
      'PLAYING',
      'PAUSED',
    ].includes(gameState.status);
  }, [gameState.status]);

  const startButtonRef = useAutoFocus<HTMLButtonElement>(
    gameState.status === 'START' && !savedGame && !bonusOpen,
  );
  const continueButtonRef = useAutoFocus<HTMLButtonElement>(
    gameState.status === 'START' && !!savedGame && !bonusOpen,
  );
  const restartButtonRef = useAutoFocus<HTMLButtonElement>(
    gameState.status === 'GAME_OVER' || gameState.status === 'VICTORY',
  );

  const showNotification = useCallback((msg: string) => {
    setBoosterNotification(msg);
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => {
      setBoosterNotification(null);
    }, 2500);
  }, []);

  const handleSaveBoardState = useCallback(
    (tiles: GridTile[], currentLvlScore: number, runSnapshot?:Snapshot) => {
      if (gameState.status !== 'PLAYING' || mode !== 'campaign') return;
      const data: SavedGameData = {
        level: currentLevel,
        score: gameState.score,
        levelScore: currentLvlScore,
        moves: gameState.moves || 0,
        tiles,
        timestamp: Date.now(),
        snapshot:runSnapshot?{...runSnapshot,progress:{...runSnapshot.progress,boosters:boostersUsed.current}}:undefined,
      };
      setSavedGame(data);
      try {
        localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
      } catch (_) {}
    },
    [gameState.status, gameState.score, gameState.moves, currentLevel, mode],
  );

  const clearSaveGame = useCallback(() => {
    setSavedGame(null);
    try {
      localStorage.removeItem(SAVE_STORAGE_KEY);
    } catch (_) {}
  }, []);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeBooster) {
          setActiveBooster(null);
          gameAudio.playCrispClick();
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else if (isHowToPlayOpen) {
          setIsHowToPlayOpen(false);
        } else if (gameState.status === 'PLAYING') {
          setIsGameMenuOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.status, isHowToPlayOpen, isSettingsOpen, activeBooster]);

  const initGame = useCallback(
    (
      lvl = 1,
      resumeTiles: GridTile[] | null = null,
      resumeTotalScore?: number,
      resumeLevelScore?: number,
      resumeMoves?: number,
      options?:RunOptions,
    ) => {
      const nextMode=options?.mode||'campaign';
      if(nextMode==='campaign'&&bonusRef.current){deferredRun.current=[lvl,resumeTiles,resumeTotalScore,resumeLevelScore,resumeMoves,options];setHubOpen(false);setBonusOpen(true);return;}
      if(trainingRun.current&&!trainingRun.current.finished)trainingRecorder.current(false);
      trainingRun.current=nextMode==='tutorial'?{lesson:options?.tutorial||1,finished:false,mistakes:0,accountId:accountProfile.current?.id}:undefined;
      localCampaign.current=nextMode==='campaign'&&accountInventory.current&&!!(resumeTiles||options?.snapshot);
      if(localCampaign.current)setRunBoosters(parseBoosters(readStorage(BOOSTERS_STORAGE_KEY),DEFAULT_BOOSTERS));
      setAcademyOpen(false);
      modeRef.current=nextMode;setMode(nextMode);setTutorial(options?.tutorial||0);setSeed(options?.seed);
      setInitialSnapshot(options?.snapshot);setSnapshot(undefined);boostersUsed.current=options?.snapshot?.progress.boosters||0;
      latestSnapshot.current=options?.snapshot;setLastExperience(null);
      if(nextMode==='daily'){
        dailyRun.current=dailyChallenge();setRunBoosters({...dailyRun.current.boosters});
        try{const record=JSON.parse(readStorage('cyber_casino_daily_v1')||'{}');setDailyBest(record.day===dailyRun.current.day&&Number.isFinite(record.score)&&record.score>=0?record.score:0);}catch{setDailyBest(0);}
      }
      if(nextMode==='tutorial')setRunBoosters({emp_bomb:0,line_laser:0,overload_core:0,overclock_moves:0,glitch_wipe:0});
      setHubOpen(false);
      completedRunRef.current = false;
      setIsBoardBusy(false);
      setCurrentLevel(lvl);
      const district = getDistrictForLevel(lvl);
      const startTotalScore =
        resumeTotalScore !== undefined
          ? resumeTotalScore
          : lvl === 1
          ? 0
          : gameStateRef.current.score;
      const startLevelScore = resumeLevelScore !== undefined ? resumeLevelScore : 0;
      const startMoves = resumeMoves !== undefined ? resumeMoves : district.moves;

      setLevelScore(startLevelScore);
      setInitialTiles(resumeTiles);
      setGameState({
        status: 'PLAYING',
        score: startTotalScore,
        level: lvl,
        moves: startMoves,
      });
      setComboStreak(0);
      setActiveBooster(null);
      setIsGameMenuOpen(false);
      setIsSettingsOpen(false);
      setIsHowToPlayOpen(false);
      setGameKey((prev) => prev + 1);

      if (lvl === 1 && !resumeTiles && sdk) {
        sdk.startGame();
      }
    },
    [sdk],
  );

  const online=useOnline({
    onRaceStart:(room:Room)=>{setRunBoosters({emp_bomb:0,line_laser:0,overload_core:0,overclock_moves:0,glitch_wipe:0});initGame(room.level,null,room.snapshot.score,room.snapshot.score,room.moves,{mode:'multiplayer',seed:room.seed,snapshot:room.snapshot});},
    onSolo:level=>initGame(level,null,0,0,undefined,{mode:'campaign'}),
    onMenu:()=>{modeRef.current='campaign';setMode('campaign');setGameState(s=>({...s,status:'START'}));setIsSettingsOpen(false);setIsGameMenuOpen(false);},
  });
  const onlineUserId=online.user?.id;
  accountProfile.current=online.user;
  const onlineIdentity=useRef(onlineUserId);onlineIdentity.current=onlineUserId;
  const trainingDevice=viewport.width<600?'mobile':viewport.width<1100?'tablet':'desktop';
  const trainingControl=online.user?.controls?.[trainingDevice]??(isMobile?'touch':'pointer');
  useEffect(()=>{if(online.user?.controls)setPreferences(p=>({...p,keyboard:online.user!.controls!.keyboardEnabled}));},[onlineUserId,online.user?.controls?.keyboardEnabled]);
  const flushTraining=useCallback(async()=>{
    if(!onlineUserId)return;
    try{await trainingSync.current.flush(onlineUserId,{
      count:LESSONS.length,read:readStorage,write:writeStorage,
      post:async r=>(await onlineApi.training(r.lesson,r.moves,r.completed,r.requestId,r.mistakes)).user,
      isCurrent:id=>onlineIdentity.current===id,
      onProfile:profile=>online.setUser(profile),
      onQueueChanged:()=>setTrainingQueueRevision(n=>n+1),
    });}catch{showNotification('Training saved on this device. Profile sync will retry when you reconnect.');}
  },[onlineUserId]);
  useEffect(()=>{void flushTraining();},[flushTraining]);
  useEffect(()=>{const reconnect=()=>{void flushTraining();};window.addEventListener('online',reconnect);return()=>window.removeEventListener('online',reconnect);},[flushTraining]);
  const academyPerformance=useMemo(()=>online.user?pendingTrainingPerformance(online.user.training??readTraining(null,LESSONS.length),readPendingTraining(readStorage(trainingQueueKey(online.user.id)),LESSONS.length)):trainingPerformance,[online.user,trainingPerformance,trainingQueueRevision]);
  trainingRecorder.current=(completed:boolean)=>{
    const run=trainingRun.current;if(!run||run.finished)return;run.finished=true;
    const moves=latestSnapshot.current?.turn||0;
    if(!run.accountId)setTrainingPerformance(p=>{const next=recordTraining(p,run.lesson,moves,completed,run.mistakes);writeStorage('cyber_casino_training_v2',next);return next;});
    else {const key=trainingQueueKey(run.accountId),queue=readPendingTraining(readStorage(key),LESSONS.length);queue.push({lesson:run.lesson,moves,completed,mistakes:run.mistakes,requestId:createRequestId()});if(!writeStorage(key,queue))showNotification('Training could not be saved. Browser storage is unavailable.');setTrainingQueueRevision(n=>n+1);if(run.accountId===onlineUserId)void flushTraining();}
  };
  useEffect(()=>{if(gameState.status==='START')trainingRecorder.current(false);},[gameState.status]);
  const previousAccount=useRef<string>();
  const guestInventory=useRef<BoosterInventory>();
  useEffect(()=>{
    const pending=online.pendingBonus;
    if(!onlineUserId||!pending)return;
    const round:BonusData={id:pending.id,level:pending.level,booster:pending.booster,claimed:false,applied:false};
    onlineBonusId.current=pending.id;bonusRef.current=round;setBonus(round);
  },[onlineUserId,online.pendingBonus?.id]);
  useEffect(()=>{
    soloReceipt.current=undefined;
    accountInventory.current=!!onlineUserId;
    if(onlineUserId&&previousAccount.current!==onlineUserId){if(!previousAccount.current)guestInventory.current={...careerBoosters};if(online.user?.inventory)setCareerBoosters(online.user.inventory);}
    if(!onlineUserId&&previousAccount.current&&guestInventory.current)setCareerBoosters(guestInventory.current);
    if(previousAccount.current!==onlineUserId){
      if((modeRef.current==='campaign'||modeRef.current==='multiplayer')&&gameStateRef.current.status!=='START'){setActiveBooster(null);setIsGameMenuOpen(false);setIsSettingsOpen(false);setGameState(s=>({...s,status:'START'}));localCampaign.current=false;}
      const pending=onlineUserId?online.pendingBonus:null;
      const round:BonusData|null=pending?{id:pending.id,level:pending.level,booster:pending.booster,claimed:false,applied:false}:onlineUserId?null:readBonus(readStorage(BONUS_KEY));
      onlineBonusId.current=pending?.id;bonusRef.current=round;setBonus(round);setBonusOpen(false);
    }
    previousAccount.current=onlineUserId;
  },[onlineUserId]);
  useEffect(()=>{if(online.user?.inventory)setCareerBoosters(online.user.inventory);},[online.user?.inventory]);
  useEffect(()=>{if(localCampaign.current){writeStorage(BOOSTERS_STORAGE_KEY,runBoosters);guestInventory.current={...runBoosters};}},[runBoosters]);
  useEffect(()=>{
    if(modeRef.current==='multiplayer'&&online.room?.status==='results'){setActiveBooster(null);setGameState(s=>({...s,status:'LEVEL_COMPLETE'}));}
    if(modeRef.current==='multiplayer'&&online.user===null){modeRef.current='campaign';setMode('campaign');setGameState(s=>({...s,status:'START'}));}
  },[online.room?.status,online.user]);
  const sendOnlineAction=async(action:Action,s:Snapshot):Promise<boolean>=>{
    const identity=onlineIdentity.current;
    if(modeRef.current==='multiplayer')return !!await online.submitAction(action,s);
    if(!online.user||modeRef.current!=='campaign'||initialTiles||initialSnapshot)return true;
    if(!soloReceipt.current||soloReceipt.current.key!==gameKey){const run=await onlineApi.soloStart(currentLevel,s.seed);soloReceipt.current={key:gameKey,id:run.runId,sequence:run.sequence};}
    const receipt=soloReceipt.current;
    const actionKey=JSON.stringify(action);
    if(receipt.pending&&receipt.pending.action!==actionKey)throw new Error('Retry the interrupted move before making a different move.');
    receipt.pending??={action:actionKey,requestId:createRequestId()};
    const result=await onlineApi.soloAction(receipt.id,receipt.sequence,action,receipt.pending.requestId,s);
    if(onlineIdentity.current!==identity||result.user.id!==identity||currentRunKey.current!==gameKey)return false;
    receipt.pending=undefined;
    receipt.sequence=result.sequence;
    if(result.user)online.setUser(result.user);
    if(result.bonus){const pending=result.bonus;const round:BonusData={id:pending.id,level:pending.level,booster:pending.booster,claimed:false,applied:false};onlineBonusId.current=pending.id;bonusRef.current=round;setBonus(round);online.setPendingBonus(pending);}
    if(result.complete)await online.refresh().catch(()=>showNotification('Heist verified. Refresh your profile when the connection returns.'));
    return onlineIdentity.current===identity&&currentRunKey.current===gameKey&&result.accepted;
  };

  const handleContinueGame = useCallback(() => {
    if (!savedGame) {
      initGame(1);
      return;
    }
    gameAudio.playConfirmSelect();
    initGame(
      savedGame.level,
      savedGame.tiles,
      savedGame.score,
      savedGame.levelScore,
      savedGame.moves,
      {snapshot:savedGame.snapshot},
    );
  }, [savedGame, initGame]);

  // Booster consumption callback
  const handleConsumeBooster = useCallback((b: BoosterType) => {
    boostersUsed.current++;
    if(accountProfile.current&&modeRef.current==='campaign'&&!localCampaign.current)return;
    setBoosters((prev) => ({
      ...prev,
      [b]: Math.max(0, prev[b] - 1),
    }));
  }, []);

  // Booster activation from toolbar
  const handleBoosterButtonClick = useCallback(
    async (b: BoosterType) => {
      if (gameState.status !== 'PLAYING' || isBoardBusy || modeRef.current==='tutorial') return;

      const availableCount = boosters[b] || 0;
      if (availableCount <= 0) {
        gameAudio.playErrorBuzz();
        showNotification(`No ${b.replace('_', ' ').toUpperCase()} available! Clear levels to earn more.`);
        return;
      }

      // Instant activation boosters
      if (b === 'overclock_moves') {
        if(online.user&&latestSnapshot.current){setIsBoardBusy(true);try{if(!await sendOnlineAction({kind:'booster',booster:b},latestSnapshot.current))return;}catch{showNotification('Cannot reach the account server. No booster was spent.');return;}finally{setIsBoardBusy(false);}}
        boostersUsed.current++;
        gameAudio.playPowerupChime();
        if(!(accountProfile.current&&modeRef.current==='campaign'&&!localCampaign.current))setBoosters((prev) => ({
          ...prev,
          overclock_moves: Math.max(0, prev.overclock_moves - 1),
        }));
        setGameState((prev) => ({
          ...prev,
          moves: (prev.moves || 0) + 5,
        }));
        showNotification('⚡ SUBNET OVERCLOCK: +5 MOVES INJECTED!');
        return;
      }

      if (b === 'glitch_wipe') {
        if(latestSnapshot.current&&!latestSnapshot.current.tiles.some(t=>t.locked)){showNotification('No hazards to purge. Booster kept.');return;}
        gameAudio.playArcadeLaser();

        setGlitchWipeTriggerCount((prev) => prev + 1);
        showNotification('🛡️ QUANTUM PURGE: VAPORIZING GRID HAZARDS!');
        return;
      }

      // Targeted activation boosters (emp_bomb, line_laser, overload_core)
      if (activeBooster === b) {
        setActiveBooster(null);
        gameAudio.playCrispClick();
        showNotification('Targeting mode cancelled.');
      } else {
        setActiveBooster(b);
        gameAudio.playConfirmSelect();
        const names: Record<string, string> = {
          emp_bomb: 'EMP BLAST (3x3)',
          line_laser: 'DUAL CROSS LASER',
          overload_core: 'OVERLOAD CORE INJECTOR',
        };
        showNotification(`🎯 SELECT ANY GRID TILE TO DEPLOY ${names[b]}!`);
      }
    },
    [boosters, activeBooster, gameState.status, isBoardBusy, showNotification,online.user,gameKey,currentLevel,initialTiles,initialSnapshot],
  );

  // District Victory Handler: Award leftover move bonuses and grant reward pack
  const handleDistrictWin = useCallback(() => {
    if (completedRunRef.current || gameStateRef.current.status !== 'PLAYING') return;
    completedRunRef.current = true;
    gameAudio.playVictoryFanfare();
    const remainingMoves = gameStateRef.current.moves || 0;
    const moveBonus = remainingMoves * 200;
    if(modeRef.current==='multiplayer'){setGameState(s=>({...s,status:'LEVEL_COMPLETE'}));return;}
    if(modeRef.current!=='campaign') {
      if(modeRef.current==='tutorial')trainingRecorder.current(true);
      setLastLevelRewards(null);setLastStars(0);setPiecesWon([]);
      if(modeRef.current==='daily') {
        const score=gameStateRef.current.score+moveBonus;
        setDailyBest(previous=>{const best=Math.max(previous,score);writeStorage('cyber_casino_daily_v1',{day:dailyRun.current.day,seed:dailyRun.current.seed,score:best});return best;});
      }
      setGameState(prev=>({...prev,score:prev.score+moveBonus,status:'LEVEL_COMPLETE'}));return;
    }
    const result=recordCompletion(careerRef.current,currentLevel,gameStateRef.current.score+moveBonus,remainingMoves,boostersUsed.current,latestSnapshot.current?.turn);
    setCareer(result.career);setLastStars(result.stars);setPiecesWon(result.piecesWon);
    setLastExperience(result.experience);
    // Fix the outcome before showing the machine so reloads cannot reroll it.
    if(currentLevel%10===0){const ranked=accountProfile.current&&!localCampaign.current;const round=onlineBonusId.current&&bonusRef.current?.level===currentLevel?bonusRef.current:ranked?null:createBonus(currentLevel);if(round){bonusRef.current=round;setBonus(round);if(onlineBonusId.current!==round.id)writeStorage(BONUS_KEY,round);}}

    // Calculate level completion loot rewards
    const isBossSector = currentLevel % 10 === 0 || currentLevel % 50 === 0;
    const isMiniBoss = currentLevel % 5 === 0 && !isBossSector;

    const rewardPack: Partial<BoosterInventory> = {
      emp_bomb: isBossSector ? 2 : 1,
      overclock_moves: isBossSector ? 2 : isMiniBoss ? 2 : 1,
    };

    if (currentLevel % 3 === 0 || isBossSector) {
      rewardPack.line_laser = (rewardPack.line_laser || 0) + (isBossSector ? 2 : 1);
    }
    if (isBossSector || isMiniBoss || currentLevel % 4 === 0) {
      rewardPack.glitch_wipe = (rewardPack.glitch_wipe || 0) + 1;
    }
    if (isBossSector || isMiniBoss || currentLevel % 8 === 0) {
      rewardPack.overload_core = (rewardPack.overload_core || 0) + 1;
    }

    // Each completed run earns loot; the run guard above prevents duplicate payouts.
    setLastLevelRewards(rewardPack);

    // Apply booster rewards to inventory
    if(!(accountProfile.current&&!localCampaign.current))setBoosters((prev) => ({
      emp_bomb: prev.emp_bomb + (rewardPack.emp_bomb || 0),
      line_laser: prev.line_laser + (rewardPack.line_laser || 0),
      overload_core: prev.overload_core + (rewardPack.overload_core || 0),
      overclock_moves: prev.overclock_moves + (rewardPack.overclock_moves || 0),
      glitch_wipe: prev.glitch_wipe + (rewardPack.glitch_wipe || 0),
    }));

    setGameState((prev) => ({
      ...prev,
      score: prev.score + moveBonus,
      status: 'LEVEL_COMPLETE',
    }));
    const nextLevel = currentLevel + 1;
    const checkpoint: SavedGameData = {
      level: nextLevel, score: gameStateRef.current.score + moveBonus, levelScore: 0,
      moves: getDistrictForLevel(nextLevel).moves, tiles: null, timestamp: Date.now(),
    };
    setSavedGame(checkpoint);
    try {localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(checkpoint));} catch (_) {}
  }, [currentLevel]);

  const handleDistrictLose = useCallback(() => {
    if(modeRef.current==='tutorial')trainingRecorder.current(false);
    gameAudio.playDefeatMotif();
    if(modeRef.current==='campaign')clearSaveGame();
    if(modeRef.current==='daily')setDailyBest(previous=>{const best=Math.max(previous,gameStateRef.current.score);writeStorage('cyber_casino_daily_v1',{day:dailyRun.current.day,seed:dailyRun.current.seed,score:best});return best;});
    setActiveBooster(null);
    setGameState((prev) => ({...prev, status: 'GAME_OVER'}));
  }, [clearSaveGame]);

  const advanceLevel = useCallback(() => {
    if(mode==='campaign'&&bonusRef.current){setBonusOpen(true);return;}
    if(mode==='daily'||(mode==='tutorial'&&tutorial===LESSONS.length)) {
      if(mode==='tutorial'&&academyPerformance.completedLessons===LESSONS.length)setCareer(c=>({...c,achievements:[...new Set([...c.achievements,'Hacker Academy'])]}));
      setGameState(s=>({...s,status:'START'}));if(mode==='tutorial')setAcademyOpen(true);else setHubOpen(true);return;
    }
    if(mode==='tutorial'){initGame(1,null,0,0,22,{mode:'tutorial',tutorial:tutorial+1,seed:100+tutorial+1});return;}
    const nextLvl = currentLevel + 1;
    initGame(nextLvl, null, undefined, 0, undefined);
  }, [currentLevel, initGame, mode, tutorial,academyPerformance.completedLessons]);

  const spinBonus=async()=>{
    const round=bonusRef.current;if(!round)return false;
    if(online.user&&onlineBonusId.current===round.id){
      const identity=onlineIdentity.current;
      try{const result=await onlineApi.claimBonus(round.id);if(onlineIdentity.current!==identity||result.user.id!==identity)return false;const paid={...round,claimed:true,applied:true,inventoryAfter:result.user.inventory};bonusRef.current=paid;setBonus(paid);setCareerBoosters(result.user.inventory);online.setUser(result.user);online.setPendingBonus(null);return true;}
      catch{showNotification('Cannot reach the account server. Your free spin is kept.');return false;}
    }
    if(online.user&&!localCampaign.current){showNotification('Reconnect to claim your saved account bonus.');return false;}
    try{if(!localStorage.getItem(BONUS_KEY))localStorage.setItem(BONUS_KEY,JSON.stringify(round));const paid=claimBonus(localStorage,round,boosters);bonusRef.current=paid;setBonus(paid);setBoosters(paid.inventoryAfter!);return true;}
    catch{showNotification('Your spin is saved. Reload to recover it if browser storage is full.');return false;}
  };
  const continueBonus=()=>{
    let round=bonusRef.current;if(!round?.claimed)return false;
    try{if(!round.applied){round=recoverBonus(localStorage);if(!round?.applied)return false;setBoosters(round.inventoryAfter!);}if(onlineBonusId.current!==round.id)localStorage.removeItem(BONUS_KEY);}catch{showNotification('Cannot save bonus completion. Free browser storage, then try again.');return false;}
    bonusRef.current=null;setBonus(null);setBonusOpen(false);
    onlineBonusId.current=undefined;
    const queued=deferredRun.current;deferredRun.current=undefined;
    if(queued)initGame(...queued);else initGame(round.level+1,null,savedGame?.score??gameStateRef.current.score,0);
    return true;
  };

  const [pageHidden,setPageHidden]=useState(()=>document.hidden);
  useEffect(()=>{gameAudio.setTheme(gameState.status==='START'?(savedGame?.level||currentLevel):currentLevel+(mode==='campaign'&&gameState.status==='LEVEL_COMPLETE'?1:0));},[currentLevel,mode,gameState.status,savedGame?.level]);
  useEffect(()=>{const changed=()=>setPageHidden(document.hidden);document.addEventListener('visibilitychange',changed);return()=>document.removeEventListener('visibilitychange',changed);},[]);
  const isPaused = gameState.status === 'PLAYING' && (pageHidden || isGameMenuOpen || isSettingsOpen || isHowToPlayOpen || hubOpen || academyOpen || bonusOpen || online.open);
  usePlaygroundGameLifecycle({...gameState, status: isPaused ? 'PAUSED' : gameState.status}, sdk);
  useEffect(() => () => clearTimeout(notificationTimeoutRef.current), []);

  // Breach progress strictly reflects the current level's goal
  const progressPercent = Math.min(
    100,
    Math.round(snapshot ? ((snapshot.mission.kind==='score'?snapshot.score:snapshot.progress[snapshot.mission.kind]) / snapshot.mission.target)*100 : (levelScore / currentDistrict.targetScore)*100),
  );

  // Background music plays continuously across screens when not muted
  const isMusicPlaying = !audioSettings.bgmMuted;

  const activeObstacles = useMemo(() => {
    return activeHazards(snapshot?.tiles||[]);
  }, [snapshot]);

  const isTierMilestone = currentLevel % 50 === 0;

  const handleNextTrack = useCallback(() => {
    gameAudio.playCrispClick();
    if (isShuffleActive) {
      let nextIdx = Math.floor(Math.random() * AVAILABLE_MUSIC_TRACKS.length);
      if (nextIdx === currentTrackIndex && AVAILABLE_MUSIC_TRACKS.length > 1) {
        nextIdx = (nextIdx + 1) % AVAILABLE_MUSIC_TRACKS.length;
      }
      setCurrentTrackIndex(nextIdx);
      setCurrentTrack(AVAILABLE_MUSIC_TRACKS[nextIdx]);
    } else {
      const nextIdx = (currentTrackIndex + 1) % AVAILABLE_MUSIC_TRACKS.length;
      setCurrentTrackIndex(nextIdx);
      setCurrentTrack(AVAILABLE_MUSIC_TRACKS[nextIdx]);
    }
  }, [currentTrackIndex, isShuffleActive]);

  return (
    <div
      data-reduced-motion={preferences.reducedMotion}
      data-resolution={preferences.resolution||'1080p'}
      style={{width:display.width,height:display.height,transform:`scale(${display.scale})`,transformOrigin:'top left','--logical-height':`${display.height}px`} as React.CSSProperties}
      onContextMenu={(e) => e.preventDefault()}
      className="game-shell fixed inset-0 overflow-hidden touch-none flex flex-col bg-zinc-950 text-white font-sans select-none">
      <BackgroundMusic
        tracks={AVAILABLE_MUSIC_TRACKS}
        isPlaying={isMusicPlaying}
        isMuted={audioSettings.bgmMuted}
        volume={audioSettings.bgmVolume}
        shuffle={isShuffleActive}
        currentTrackIndex={currentTrackIndex}
        onTrackChange={(t, idx) => {
          if (typeof t === 'object' && t !== null) {
            setCurrentTrack(t as MusicTrack);
          } else if (typeof t === 'string') {
            const found = AVAILABLE_MUSIC_TRACKS.find((trk) => trk.url === t);
            if (found) setCurrentTrack(found);
          }
          setCurrentTrackIndex(idx);
        }}
      />

      {gameState.status==='START'&&<div className="main-menu-background"><div className="menu-city-fallback"/><React.Suspense fallback={null}><MainMenuScene level={savedGame?.level||currentLevel} preferences={preferences} isPaused={pageHidden||isSettingsOpen||hubOpen||isHowToPlayOpen} accent={COSMETICS.find(c=>c.id===career.cosmetic)?.color}/></React.Suspense></div>}
      {/* TOP HUD BAR */}
      {gameState.status === 'PLAYING' && (
        <div className="game-hud w-full h-16 bg-slate-950/90 border-b border-cyan-500/30 px-3 py-2 flex items-center justify-between z-20 shrink-0 backdrop-blur-md">
          {/* Left: Level, Tier & Level Score Goal */}
          <div className="hud-summary flex items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950/90 border border-cyan-500/60 rounded text-cyan-300 font-mono font-black tracking-wider">
                  LVL {currentLevel}
                </span>
                <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider font-bold truncate max-w-[150px] sm:max-w-xs">
                  {currentDistrict.subtitle}
                </span>
              </div>
              <div className="hud-score flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-400 font-mono">SECTOR PTS:</span>
                <span className="text-sm font-black font-mono text-cyan-300">
                  {levelScore.toLocaleString()}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {(!snapshot || snapshot.mission.kind==='score') ? `/ ${(snapshot?.mission.target||currentDistrict.targetScore).toLocaleString()}` : 'POINTS'}
                </span>
                <span className="hidden md:inline-block text-[10px] text-zinc-500 font-mono pl-1 border-l border-zinc-700">
                  TOTAL: {gameState.score.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Firewall Breach Progress Meter */}
            <div className="hidden sm:flex flex-col w-28 md:w-40">
              <div className="flex justify-between text-[9px] text-zinc-400 font-mono mb-0.5">
                <span>BREACH PROGRESS</span>
                <span className="text-cyan-400 font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-cyan-500/40">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-yellow-400 transition-all duration-300"
                  style={{width: `${progressPercent}%`}}
                />
              </div>
            </div>
          </div>

          {/* Center: Moves Remaining */}
          <div className="hud-moves flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-cyan-500/30">
            <Activity
              size={16}
              className={
                (gameState.moves || 0) <= 5
                  ? 'text-red-500 animate-pulse'
                  : 'text-amber-400'
              }
            />
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-zinc-400 font-mono">
                MOVES LEFT
              </span>
              <span
                className={`text-sm font-black font-mono ${
                  (gameState.moves || 0) <= 5
                    ? 'text-red-400 animate-bounce'
                    : 'text-amber-300'
                }`}>
                {gameState.moves}
              </span>
            </div>
          </div>

          {/* Right: Music Track Pill + Combo Streak + Quick Settings + Menu Button */}
          <div className="hud-actions flex items-center gap-2">
            {/* Quick BGM Track Pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/90 border border-fuchsia-500/40 rounded-lg text-fuchsia-300 text-[11px] font-mono shadow-sm">
              <Music size={13} className={audioSettings.bgmMuted ? 'text-zinc-500' : 'text-fuchsia-400'} />
              <span className="font-bold truncate max-w-[110px]" title={currentTrack.description}>
                {audioSettings.bgmMuted ? 'MUTED' : currentTrack.name}
              </span>
              {!audioSettings.bgmMuted && (
                <button
                  onClick={handleNextTrack}
                  className="p-0.5 hover:text-cyan-300 transition-colors"
                  title="Skip to next random song">
                  <SkipForward size={13} />
                </button>
              )}
            </div>

            {comboStreak > 1 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-fuchsia-950/80 border border-fuchsia-500/50 rounded text-fuchsia-300 text-xs font-mono font-bold animate-pulse">
                <Zap size={13} className="text-yellow-400" />
                <span>x{comboStreak} STREAK</span>
              </div>
            )}

            <button
              onClick={() => {
                gameAudio.playCrispClick();
                setSettingsSource('MENU');
                setIsSettingsOpen(true);
              }}
              className="min-w-[40px] min-h-[40px] p-2 bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/40 rounded-lg text-cyan-300 transition-colors flex items-center justify-center shadow-md shadow-cyan-950/40 active:scale-95"
              aria-label="Settings and View"
              title="Settings & View Options">
              <Settings size={17} />
            </button>

            <button
              onClick={() => {
                gameAudio.playCrispClick();
                setIsGameMenuOpen(true);
              }}
              className="min-w-[48px] min-h-[48px] px-3 py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/60 rounded-lg text-cyan-300 text-xs font-mono font-bold transition-colors flex items-center justify-center gap-1 shadow-lg shadow-cyan-950/50 active:scale-95"
              aria-label="Game Menu">
              ≡ MENU
            </button>
          </div>
        </div>
      )}

      {/* 3D WebGL Canvas Container */}
      <div className="game-stage flex-1 w-full min-h-0 relative flex items-center justify-center bg-slate-950 overflow-hidden">
        {mode==='multiplayer'&&online.room&&<div className="race-live-status" aria-live="polite"><span>RACE {online.room.code} · {online.room.players.filter(p=>p.complete).length}/{online.room.players.length} finished</span><button className="cyber-button" onClick={()=>online.show('race')}>{online.room.status==='results'?'MATCH RESULTS':'RACE LOBBY'}</button></div>}
        {mode==='campaign'&&online.user&&(initialTiles||initialSnapshot)&&<span className="local-run-note">Resumed local heist · not ranked. New heists record account stats.</span>}
        {gameState.status!=='START'&&<React.Suspense fallback={<p className="text-cyan-300">Loading matrix…</p>}><Game
          preferences={preferences}
          onAction={mode==='multiplayer'||online.user&&mode==='campaign'&&!initialTiles&&!initialSnapshot?sendOnlineAction:undefined}
          seed={seed}
          tutorial={tutorial}
          trainingControl={trainingControl}
          onTrainingMistake={()=>{if(trainingRun.current&&!trainingRun.current.finished)trainingRun.current.mistakes=Math.min(10000,trainingRun.current.mistakes+1);}}
          themeLevel={currentLevel+(mode==='campaign'&&gameState.status==='LEVEL_COMPLETE'?1:0)}
          pieceStyle={mode==='tutorial'?'classic':career.pieceStyle}
          initialSnapshot={initialSnapshot}
          onProgress={handleProgress}
          accent={COSMETICS.find(c=>c.id===career.cosmetic)?.color}
          key={gameKey}
          isPaused={isPaused || gameState.status !== 'PLAYING'}
          onProcessingChange={setIsBoardBusy}
          gameState={gameState}
          setGameState={setGameState}
          exitChat={exitChat}
          gameStateRef={gameStateRef}
          currentLevel={currentLevel}
          onDistrictWin={handleDistrictWin}
          onDistrictLose={handleDistrictLose}
          comboStreak={comboStreak}
          setComboStreak={setComboStreak}
          initialTiles={initialTiles}
          onSaveBoardState={handleSaveBoardState}
          cameraMode={cameraMode}
          setCameraMode={setCameraMode}
          levelScore={levelScore}
          setLevelScore={setLevelScore}
          activeBooster={activeBooster}
          setActiveBooster={setActiveBooster}
          onConsumeBooster={handleConsumeBooster}
          glitchWipeTriggerCount={glitchWipeTriggerCount}
        /></React.Suspense>}

        {/* NOTIFICATION TOAST */}
        {boosterNotification && (
          <div className="absolute top-3 inset-x-0 flex justify-center z-30 pointer-events-none px-4">
            <div className="bg-slate-950/95 border-2 border-cyan-400 text-cyan-300 px-4 py-2 rounded-xl shadow-2xl shadow-cyan-950/80 font-mono text-xs font-black tracking-wider flex items-center gap-2 animate-bounce backdrop-blur-md">
              <Zap size={16} className="text-yellow-400 shrink-0" />
              <span>{boosterNotification}</span>
            </div>
          </div>
        )}

        {/* ACTIVE BOOSTER TARGETING BANNER */}
        {activeBooster && gameState.status === 'PLAYING' && (
          <div className="targeting-banner absolute top-14 inset-x-0 flex justify-center z-25 pointer-events-auto px-4">
            <div className="bg-amber-950/90 border-2 border-yellow-400 text-yellow-300 px-4 py-1.5 rounded-full shadow-lg font-mono text-xs font-bold flex items-center gap-3 animate-pulse backdrop-blur-md">
              <span>
                🎯 TARGETING:{' '}
                {activeBooster === 'emp_bomb'
                  ? 'CLICK ANY TILE TO BLAST 3x3 AREA'
                  : activeBooster === 'line_laser'
                  ? 'CLICK ANY TILE TO FIRE DUAL CROSS LASER'
                  : 'CLICK ANY TILE TO INJECT OVERLOAD CORE'}
              </span>
              <button
                onClick={() => {
                  setActiveBooster(null);
                  gameAudio.playCrispClick();
                  showNotification('Targeting cancelled.');
                }}
                className="bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors">
                CANCEL
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE HAZARDS INDICATOR */}
        {gameState.status === 'PLAYING' && (
          <div className="hazards-indicator absolute bottom-20 inset-x-0 flex flex-col items-center gap-1 pointer-events-none z-10 px-4">
            {activeObstacles.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <span className="text-[10px] font-mono text-zinc-400 bg-black/80 px-2 py-0.5 rounded border border-cyan-500/40">
                  ACTIVE HAZARDS:
                </span>
                {activeObstacles.map((obs, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900/90 border border-fuchsia-500/40 text-fuchsia-300 shadow-sm">
                    {obs}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM CYBER BOOSTER TRAY / ACTION DOCK */}
      {gameState.status === 'PLAYING' && (
        <div className="booster-tray w-full bg-slate-950/95 border-t border-cyan-500/30 px-3 py-2 z-20 shrink-0 backdrop-blur-md flex items-center justify-between gap-2 overflow-x-auto">
          <div className="hidden lg:flex flex-col">
            <span className="text-[10px] text-cyan-400 font-mono font-black tracking-wider flex items-center gap-1">
              <Zap size={12} className="text-yellow-400" /> MATRIX BOOSTERS
            </span>
            <span className="text-[9px] text-zinc-400 font-mono">
              Earned on sector clear
            </span>
          </div>

          <div className="booster-actions flex items-center gap-1.5 sm:gap-2.5 mx-auto">
            {/* 1. EMP Bomb Booster */}
            <button
              disabled={isBoardBusy || boosters['emp_bomb'] <= 0}
              onClick={() => handleBoosterButtonClick('emp_bomb')}
              className={`min-h-[46px] px-2.5 sm:px-3.5 py-1.5 rounded-xl border flex items-center gap-2 font-mono text-xs font-bold transition-all active:scale-95 ${
                activeBooster === 'emp_bomb'
                  ? 'bg-amber-500 text-slate-950 border-yellow-300 ring-2 ring-yellow-400 shadow-lg shadow-amber-500/50 scale-105'
                  : boosters.emp_bomb > 0
                  ? 'bg-slate-900/90 hover:bg-slate-800 text-amber-300 border-amber-500/40 shadow-md shadow-amber-950/30'
                  : 'bg-slate-950/60 text-zinc-600 border-zinc-800 cursor-not-allowed'
              }`}
              title="EMP Bomb: Blasts a 3x3 area, destroying obstacles and chips">
              <span className="text-base">💣</span>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] sm:text-[11px] font-black">EMP BLAST</span>
                <span className="text-[9px] opacity-80">3x3 Zone</span>
              </div>
              <span
                className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                  boosters.emp_bomb > 0
                    ? 'bg-amber-950/80 text-amber-300 border border-amber-500/50'
                    : 'bg-zinc-800 text-zinc-500'
                }`}>
                x{boosters.emp_bomb}
              </span>
            </button>

            {/* 2. Line Laser Booster */}
            <button
              disabled={isBoardBusy || boosters['line_laser'] <= 0}
              onClick={() => handleBoosterButtonClick('line_laser')}
              className={`min-h-[46px] px-2.5 sm:px-3.5 py-1.5 rounded-xl border flex items-center gap-2 font-mono text-xs font-bold transition-all active:scale-95 ${
                activeBooster === 'line_laser'
                  ? 'bg-cyan-400 text-slate-950 border-cyan-200 ring-2 ring-cyan-300 shadow-lg shadow-cyan-500/50 scale-105'
                  : boosters.line_laser > 0
                  ? 'bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border-cyan-500/40 shadow-md shadow-cyan-950/30'
                  : 'bg-slate-950/60 text-zinc-600 border-zinc-800 cursor-not-allowed'
              }`}
              title="Cross Laser: Clears two rows and two columns">
              <Zap size={15} className={boosters.line_laser > 0 ? 'text-cyan-400' : 'text-zinc-600'} />
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] sm:text-[11px] font-black">CROSS LASER</span>
                <span className="text-[9px] opacity-80">Double cross</span>
              </div>
              <span
                className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                  boosters.line_laser > 0
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50'
                    : 'bg-zinc-800 text-zinc-500'
                }`}>
                x{boosters.line_laser}
              </span>
            </button>

            {/* 3. Overload Core Booster */}
            <button
              disabled={isBoardBusy || boosters['overload_core'] <= 0}
              onClick={() => handleBoosterButtonClick('overload_core')}
              className={`min-h-[46px] px-2.5 sm:px-3.5 py-1.5 rounded-xl border flex items-center gap-2 font-mono text-xs font-bold transition-all active:scale-95 ${
                activeBooster === 'overload_core'
                  ? 'bg-fuchsia-500 text-slate-950 border-fuchsia-200 ring-2 ring-fuchsia-300 shadow-lg shadow-fuchsia-500/50 scale-105'
                  : boosters.overload_core > 0
                  ? 'bg-slate-900/90 hover:bg-slate-800 text-fuchsia-300 border-fuchsia-500/40 shadow-md shadow-fuchsia-950/30'
                  : 'bg-slate-950/60 text-zinc-600 border-zinc-800 cursor-not-allowed'
              }`}
              title="Overload Core: Inject into an unshielded token, then activate it to fire every board special">
              <span className="text-base">🌀</span>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] sm:text-[11px] font-black">OVERLOAD</span>
                <span className="text-[9px] opacity-80">Chain all</span>
              </div>
              <span
                className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                  boosters.overload_core > 0
                    ? 'bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-500/50'
                    : 'bg-zinc-800 text-zinc-500'
                }`}>
                x{boosters.overload_core}
              </span>
            </button>

            {/* 4. Subnet Overclock (+5 Moves) */}
            <button
              disabled={isBoardBusy || boosters['overclock_moves'] <= 0}
              onClick={() => handleBoosterButtonClick('overclock_moves')}
              className={`min-h-[46px] px-2.5 sm:px-3.5 py-1.5 rounded-xl border flex items-center gap-2 font-mono text-xs font-bold transition-all active:scale-95 ${
                boosters.overclock_moves > 0
                  ? 'bg-slate-900/90 hover:bg-slate-800 text-emerald-300 border-emerald-500/40 shadow-md shadow-emerald-950/30'
                  : 'bg-slate-950/60 text-zinc-600 border-zinc-800 cursor-not-allowed'
              }`}
              title="+5 Moves: Instantly adds 5 extra moves to your current sector">
              <RotateCw size={15} className={boosters.overclock_moves > 0 ? 'text-emerald-400' : 'text-zinc-600'} />
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] sm:text-[11px] font-black">+5 MOVES</span>
                <span className="text-[9px] opacity-80">Instant Add</span>
              </div>
              <span
                className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                  boosters.overclock_moves > 0
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50'
                    : 'bg-zinc-800 text-zinc-500'
                }`}>
                x{boosters.overclock_moves}
              </span>
            </button>

            {/* 5. Quantum Glitch Wipe */}
            <button
              disabled={isBoardBusy || boosters['glitch_wipe'] <= 0}
              onClick={() => handleBoosterButtonClick('glitch_wipe')}
              className={`min-h-[46px] px-2.5 sm:px-3.5 py-1.5 rounded-xl border flex items-center gap-2 font-mono text-xs font-bold transition-all active:scale-95 ${
                boosters.glitch_wipe > 0
                  ? 'bg-slate-900/90 hover:bg-slate-800 text-purple-300 border-purple-500/40 shadow-md shadow-purple-950/30'
                  : 'bg-slate-950/60 text-zinc-600 border-zinc-800 cursor-not-allowed'
              }`}
              title="Quantum Wipe: Removes every hazard, shield layer and vault from the board">
              <Shield size={15} className={boosters.glitch_wipe > 0 ? 'text-purple-400' : 'text-zinc-600'} />
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] sm:text-[11px] font-black">PURGE HAZARD</span>
                <span className="text-[9px] opacity-80">All hazards</span>
              </div>
              <span
                className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                  boosters.glitch_wipe > 0
                    ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50'
                    : 'bg-zinc-800 text-zinc-500'
                }`}>
                x{boosters.glitch_wipe}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* START SCREEN */}
      {gameState.status === 'START' && !hubOpen && !isSettingsOpen && !isHowToPlayOpen && (
        <main className="main-menu-screen" aria-label="Cyber Casino main menu"><div className="main-menu-content">
          <div className="w-full max-w-md bg-slate-950/80 border border-cyan-500/60 rounded-2xl p-6 shadow-2xl shadow-cyan-950/50 flex flex-col items-center backdrop-blur-xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-fuchsia-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-cyan-500/40 mb-3 animate-pulse">
              <Zap size={32} className="text-white" />
            </div>

            <h1 className="text-2xl md:text-3xl font-black font-mono text-center tracking-wider bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-yellow-400 bg-clip-text text-transparent mb-1">
              CYBER CASINO HACK
            </h1>
            <p className="text-xs text-cyan-400/80 font-mono tracking-widest text-center mb-4">
              CAMPAIGN · DAILY HEISTS · MASTERY STARS
            </p>

            <div className="w-full bg-slate-900/80 border border-cyan-500/20 rounded-xl p-3.5 mb-4 text-xs text-zinc-300 space-y-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold font-mono">
                <Shield size={15} />
                <span>HEIST REWARDS & BOOSTERS:</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Clear casino subnets to earn powerful matrix boosters: <b>EMP Bombs (3x3)</b>, <b>Cross Lasers</b>, <b>Overload Cores</b>, <b>+5 Move Injections</b>, and <b>Hazard Glitch Purges</b>!
              </p>
            </div>

          <div className="w-full flex flex-col gap-2.5">
              <button className="cyber-button" onClick={()=>online.show(online.user?'race':'account')}>{online.user?`${online.user.displayName} · PROFILE & MULTIPLAYER`:'ACCOUNT · MULTIPLAYER · LEADERBOARD'}</button>
              <button className="cyber-button primary" onClick={()=>setHubOpen(true)}>CAMPAIGN MAP & DAILY HEIST</button>
              <button className="cyber-button" onClick={()=>setAcademyOpen(true)}>HACKER TRAINING</button>
              {savedGame && (
                <button
                  ref={continueButtonRef}
                  autoFocus
                  onClick={handleContinueGame}
                  className="w-full min-h-[50px] bg-gradient-to-r from-emerald-500 hover:from-emerald-400 to-cyan-500 hover:to-cyan-400 text-slate-950 py-3 px-6 rounded-xl font-mono font-black text-sm tracking-wider shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all active:scale-95">
                  <Play size={18} />
                  CONTINUE HEIST (LVL {savedGame.level} · {savedGame.score.toLocaleString()} PTS)
                </button>
              )}

              <button
                ref={startButtonRef}
                autoFocus={!savedGame}
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  clearSaveGame();
                  initGame(1);
                }}
                className={`w-full min-h-[48px] ${
                  savedGame
                    ? 'bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300'
                    : 'bg-gradient-to-r from-cyan-500 hover:from-cyan-400 to-fuchsia-600 hover:to-fuchsia-500 text-white shadow-lg shadow-cyan-500/30'
                } py-3 px-6 rounded-xl font-mono font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95`}>
                <RotateCw size={18} />
                {savedGame ? 'NEW HEIST (RESET TO LVL 1)' : 'INITIALIZE HACK (LEVEL 1)'}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    gameAudio.playCrispClick();
                    setSettingsSource('START');
                    setIsSettingsOpen(true);
                  }}
                  className="min-h-[48px] bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 py-2 px-3 rounded-xl font-mono font-bold text-xs flex items-center justify-center gap-2 transition-colors">
                  <Settings size={16} />
                  SETTINGS
                </button>

                <button
                  onClick={() => {
                    gameAudio.playCrispClick();
                    setHowToPlaySource('START');
                    setIsHowToPlayOpen(true);
                  }}
                  className="min-h-[48px] bg-slate-900 hover:bg-slate-800 border border-fuchsia-500/30 text-fuchsia-300 py-2 px-3 rounded-xl font-mono font-bold text-xs flex items-center justify-center gap-2 transition-colors">
                  <HelpCircle size={16} />
                  HOW TO PLAY
                </button>
              </div>
            </div>
          </div>
        </div></main>
      )}

      {hubOpen&&<MenuOverlay tone="neutral" zIndex={80} wide><HeistHub career={career} dailyBest={dailyBest} onClose={()=>setHubOpen(false)}
        onLevel={level=>initGame(level,null,0,0)} onDaily={()=>{const d=dailyChallenge();initGame(d.level,null,0,0,undefined,{mode:'daily',seed:d.seed});}}
        onTutorial={()=>{setHubOpen(false);setAcademyOpen(true);}}
        onCosmetic={cosmetic=>setCareer(c=>({...c,cosmetic}))}
        onPieceStyle={pieceStyle=>setCareer(c=>canEquipPieces(c,pieceStyle)?{...c,pieceStyle}:c)}/></MenuOverlay>}
      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <MenuOverlay tone="neutral" zIndex={75}>
          <div className="settings-window w-full max-w-sm bg-slate-950 border-2 border-cyan-500/80 rounded-2xl shadow-2xl shadow-cyan-950/60 backdrop-blur-xl">
            <button className="settings-close" aria-label="Close settings" onClick={()=>{gameAudio.playCrispClick();setIsSettingsOpen(false);if(settingsSource==='START')setIsGameMenuOpen(false);}}>×</button>
            <div className="settings-scroll p-5 flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-400 mb-2 shrink-0">
              <Settings size={24} />
            </div>

            <h2 className="text-xl font-black font-mono text-cyan-300 tracking-wider mb-0.5 text-center">
              SYSTEM & VIEW SETTINGS
            </h2>
            <p className="text-[11px] text-zinc-400 font-mono mb-4 text-center">
              PERSPECTIVE, AUDIO AND INTERFACE OPTIONS
            </p>
            <PreferencesPanel value={preferences} onChange={value=>{gameAudio.playCrispClick();setPreferences(value);}}/>
            <button className="cyber-button w-full mb-4" onClick={()=>{setIsSettingsOpen(false);online.show(online.user?'race':'account');}}>ACCOUNT & HOST MULTIPLAYER</button>

            <div className="w-full bg-slate-900/90 border border-cyan-500/30 rounded-xl p-3.5 mb-3 space-y-2">
              <div className="flex items-center gap-2 text-cyan-300 font-mono font-bold text-xs">
                <Eye size={16} />
                <span>3D CAMERA PERSPECTIVE VIEW</span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono">
                Choose your preferred viewport angle for the Matrix grid:
              </p>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {(
                  [
                    {id: '3d-angled', label: '3D ANGLED', desc: 'Dynamic'},
                    {id: 'cinematic', label: 'CINEMATIC', desc: 'Low-Angle'},
                    {id: 'top-down', label: 'TOP-DOWN', desc: 'Tactical'},
                  ] as const
                ).map((mode) => {
                  const isCurrent = cameraMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => {
                        gameAudio.playConfirmSelect();
                        setCameraMode(mode.id);
                        try {
                          localStorage.setItem('cyber_casino_camera_mode', mode.id);
                        } catch (_) {}
                      }}
                      className={`min-h-[44px] px-2 py-1.5 rounded-lg font-mono text-[11px] font-bold border transition-all flex flex-col items-center justify-center ${
                        isCurrent
                          ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-md shadow-cyan-500/40 font-black'
                          : 'bg-slate-950 hover:bg-slate-800 text-zinc-300 border-cyan-500/20'
                      }`}>
                      <span>{mode.label}</span>
                      <span className={`text-[9px] ${isCurrent ? 'text-slate-900 font-medium' : 'text-zinc-500'}`}>{mode.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-full bg-slate-900/90 border border-cyan-500/30 rounded-xl p-3.5 mb-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-300 font-mono font-bold text-xs">
                  {audioSettings.sfxMuted ? <VolumeX size={17} className="text-red-400" /> : <Volume2 size={17} />}
                  <span>SOUND EFFECTS (SFX)</span>
                </div>
                <button
                  onClick={() => {
                    setAudioSettings((prev) => {
                      const nextMuted = !prev.sfxMuted;
                      gameAudio.setMuted(nextMuted);
                      if (!nextMuted) gameAudio.playConfirmSelect();
                      return {...prev, sfxMuted: nextMuted};
                    });
                  }}
                  aria-label="Toggle sound effects"
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold border transition-colors ${
                    audioSettings.sfxMuted
                      ? 'bg-red-950/80 text-red-400 border-red-500/50'
                      : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
                  }`}>
                  {audioSettings.sfxMuted ? 'MUTED' : 'ACTIVE'}
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                  <span>SFX VOLUME</span>
                  <span className="text-cyan-300 font-bold">
                    {Math.round(audioSettings.sfxVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={audioSettings.sfxVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setAudioSettings((prev) => ({...prev, sfxVolume: val}));
                    gameAudio.setVolume(val);
                  }}
                  className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-cyan-500/30"
                />
              </div>
            </div>

            {/* 6-Track Music Playlist Section */}
            <div className="w-full bg-slate-900/90 border border-fuchsia-500/30 rounded-xl p-3.5 mb-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-fuchsia-300 font-mono font-bold text-xs">
                  {audioSettings.bgmMuted ? <VolumeX size={17} className="text-red-400" /> : <Music size={17} />}
                  <span>MUSIC SOUNDTRACK (6 TRACKS)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      gameAudio.playCrispClick();
                      setIsShuffleActive((prev) => !prev);
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-mono font-bold border flex items-center gap-1 transition-colors ${
                      isShuffleActive
                        ? 'bg-fuchsia-950/90 text-fuchsia-300 border-fuchsia-500/60'
                        : 'bg-slate-950 text-zinc-400 border-zinc-700'
                    }`}
                    title="Toggle Random Shuffle Mode">
                    <Shuffle size={12} />
                    <span>{isShuffleActive ? 'RANDOM' : 'ORDERED'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setAudioSettings((prev) => ({
                        ...prev,
                        bgmMuted: !prev.bgmMuted,
                      }));
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition-colors ${
                      audioSettings.bgmMuted
                        ? 'bg-red-950/80 text-red-400 border-red-500/50'
                        : 'bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-500/50'
                    }`}>
                    {audioSettings.bgmMuted ? 'MUTED' : 'ACTIVE'}
                  </button>
                </div>
              </div>

              {/* Volume Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                  <span>VOLUME</span>
                  <span className="text-fuchsia-300 font-bold">
                    {Math.round(audioSettings.bgmVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={audioSettings.bgmVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setAudioSettings((prev) => ({...prev, bgmVolume: val}));
                  }}
                  className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-fuchsia-400 border border-fuchsia-500/30"
                />
              </div>

              {/* 6 Tracks Playlist List */}
              <div className="pt-1 space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 mb-1">
                  <span>TRACKLIST ({AVAILABLE_MUSIC_TRACKS.length} SONGS · SHUFFLE QUEUE)</span>
                  <button
                    onClick={handleNextTrack}
                    className="text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 font-bold">
                    <SkipForward size={11} /> NEXT RANDOM
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto pr-1">
                  {AVAILABLE_MUSIC_TRACKS.map((track, idx) => {
                    const isSelected = currentTrackIndex === idx;
                    return (
                      <button
                        key={track.name}
                        onClick={() => {
                          gameAudio.playConfirmSelect();
                          setCurrentTrackIndex(idx);
                          setCurrentTrack(track);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-fuchsia-950/80 border-fuchsia-400 text-fuchsia-200 shadow-sm'
                            : 'bg-slate-950/80 hover:bg-slate-800 border-zinc-800 text-zinc-400'
                        }`}>
                        <div className="flex items-center gap-2 truncate">
                          <span className={`text-[10px] font-black ${isSelected ? 'text-fuchsia-400' : 'text-zinc-600'}`}>
                            0{idx + 1}
                          </span>
                          <div className="flex flex-col truncate">
                            <span className={`font-bold truncate ${isSelected ? 'text-fuchsia-200' : 'text-zinc-300'}`}>
                              {track.name}
                            </span>
                            <span className="text-[9px] text-zinc-500 truncate">
                              {track.description}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-fuchsia-500 text-slate-950 font-black shrink-0 ml-1">
                            {audioSettings.bgmMuted ? 'SELECTED' : 'PLAYING'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                gameAudio.playCrispClick();
                setIsSettingsOpen(false);
              }}
              className="w-full min-h-[48px] bg-cyan-500 hover:bg-cyan-400 text-slate-950 py-3 rounded-xl font-mono font-bold text-sm tracking-wider shadow-lg shadow-cyan-500/30 shrink-0">
              SAVE & RETURN TO {settingsSource === 'START' ? 'MAIN MENU' : 'TERMINAL'}
            </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* GAME MENU / PAUSE SCREEN */}
      {isGameMenuOpen && !isHowToPlayOpen && !isSettingsOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-sm bg-slate-950 border-2 border-cyan-500/60 rounded-2xl p-6 shadow-2xl shadow-cyan-950/50 flex flex-col items-center">
            <h2 className="text-xl font-black font-mono text-cyan-300 tracking-wider mb-1">
              CASINO TERMINAL MENU
            </h2>
            <p className="text-[11px] text-zinc-400 font-mono mb-4">
              HACK IN PROGRESS · LEVEL {currentLevel} PAUSED
            </p>

            <div className="w-full space-y-2 mb-5">
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setSettingsSource('MENU');
                  setIsSettingsOpen(true);
                }}
                className="w-full min-h-[48px] bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 rounded-xl p-2 text-xs font-mono font-bold flex items-center justify-center gap-2">
                <Settings size={16} />
                SETTINGS & VIEW OPTIONS
              </button>

              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setHowToPlaySource('MENU');
                  setIsHowToPlayOpen(true);
                }}
                className="w-full min-h-[48px] bg-slate-900 hover:bg-slate-800 border border-zinc-700 text-zinc-200 rounded-xl p-2 text-xs font-mono font-bold flex items-center justify-center gap-2">
                <HelpCircle size={16} />
                HOW TO PLAY & BOOSTER GUIDE
              </button>

              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  initGame(currentLevel,null,0,0,undefined,{mode,tutorial,seed});
                }}
                className="w-full min-h-[48px] bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 rounded-xl p-2 text-xs font-mono font-bold flex items-center justify-center gap-2">
                <RotateCw size={16} />
                RETRY LEVEL {currentLevel}
              </button>
            </div>

            <div className="w-full space-y-2">
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsGameMenuOpen(false);
                }}
                className="w-full min-h-[48px] bg-cyan-500 hover:bg-cyan-400 text-slate-950 py-3 rounded-xl font-mono font-black text-sm tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30">
                <Play size={18} />
                RESUME HACK
              </button>

              <button disabled={isBoardBusy}
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsGameMenuOpen(false);
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                className="w-full min-h-[48px] bg-slate-900 hover:bg-slate-800 border border-red-500/40 text-red-400 py-2.5 rounded-xl font-mono font-bold text-xs flex items-center justify-center gap-2">
                {isBoardBusy ? 'RESUME TO FINISH CURRENT MOVE' : 'SAVE & QUIT TO MAIN MENU'}
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* HOW TO PLAY & BOOSTER GUIDE OVERLAY */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={70}>
          <div className="w-full max-w-md bg-slate-950 border-2 border-cyan-500/80 rounded-2xl p-5 shadow-2xl flex flex-col items-center max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black font-mono text-cyan-300 mb-2 tracking-wider flex items-center gap-2">
              <HelpCircle size={20} />
              TACTICAL BOOSTERS & HAZARD GUIDE
            </h2>

            <div className="w-full space-y-2.5 text-xs text-zinc-300 mb-4">
              <div className="bg-slate-900/90 p-3 rounded-xl border border-cyan-500/30">
                <span className="font-bold text-cyan-400 font-mono block mb-1">
                  1. MATRIX POWER-UPS & REWARDS
                </span>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Every campaign clear rewards boosters and XP, including replays. Clear without boosters for a move-efficiency and difficulty XP multiplier. Every tenth node unlocks a free booster slot round. Deploy boosters through the bottom action tray:
                </p>
                <div className="mt-2 space-y-1 text-[10.5px]">
                  <p>• <b>💣 EMP Blast</b>: Target any tile to detonate a 3x3 blast radius and crush barriers.</p>
                  <p>• <b>⚡ Cross Laser</b>: Two matched lines create a Cross Laser on the board. Activate it twice to clear two rows and two columns. Rewarded lasers use the same double cross.</p>
                  <p>• <b>🌀 Overload Core</b>: Inject into an unshielded token. Activate it to fire every active laser, bomb and core on the board, once each. Protected objective tiles keep their shields and packets.</p>
                  <p>• <b>⏱️ +5 Moves</b>: Instantly grants 5 extra moves when firewall traces get tight.</p>
                  <p>• <b>🛡️ Purge Hazard</b>: Removes all hazards and shield layers, including boss locks and vaults. An empty board keeps your booster.</p>
                  <p>• <b>Match bonuses</b>: Two matched lines, including a T/L, create one Cross Laser. Three or more matched lines cleared by one swap, including cascades, grant +5 moves once. Overload, EMP and Purge are reward-only boosters.</p>
                  <p>• <b>Mission objectives</b>: Collect the named token, clear hazards, drop packets to the bottom, or hit beside the vault. On boss nodes, the core locks a telegraphed row every fourth move.</p>
                </div>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-xl border border-amber-500/30">
                <span className="font-bold text-amber-400 font-mono block mb-1">
                  2. DIVERSE GRID OBSTACLES & MISSIONS
                </span>
                <div className="space-y-1.5 text-[10.5px] text-zinc-300 leading-relaxed">
                  <p>• <b className="text-cyan-300">ICE Firewall (1-Hit)</b>: Shatters on adjacent match or laser blast.</p>
                  <p>• <b className="text-red-400">Glitch Virus Node (1-Hit)</b>: Corrupted node granting +250 bonus points when purged.</p>
                  <p>• <b className="text-yellow-300">Quantum Cipher Lock (1-Hit)</b>: Encrypted padlock shattered by adjacent token combination.</p>
                  <p>• <b className="text-cyan-400">EMP Sentinel Turret (1-Hit)</b>: Dismantling triggers an EMP lightning arc that zaps adjacent tiles!</p>
                  <p>• <b className="text-amber-400">Plasma Shield Core (2-Hit)</b>: Reinforced forcefield requiring 2 hits to crack and shatter.</p>
                  <p>• <b className="text-purple-400">Void Singularity (2-Hit)</b>: Gravitational anomaly that implodes for +600 points when breached.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                gameAudio.playCrispClick();
                setIsHowToPlayOpen(false);
              }}
              className="w-full min-h-[48px] bg-cyan-500 hover:bg-cyan-400 text-slate-950 py-3 rounded-xl font-mono font-bold text-sm tracking-wider shrink-0">
              RETURN TO {howToPlaySource === 'START' ? 'MAIN MENU' : 'TERMINAL'}
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* LEVEL COMPLETE OVERLAY WITH LEVEL REWARDS & BOOSTERS */}
      {gameState.status === 'LEVEL_COMPLETE' && mode!=='multiplayer' && !bonusOpen && (
        <MenuOverlay tone="victory" zIndex={50}>
          <div className="completion-card w-full max-w-sm bg-slate-950 border-2 border-emerald-500/80 rounded-2xl p-6 shadow-2xl shadow-emerald-950/50 flex flex-col items-center" role="dialog" aria-modal="true" aria-label="Level completion and rewards" tabIndex={-1} ref={e=>{if(e&&!e.contains(document.activeElement))e.focus({preventScroll:true});}}>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 mb-3 animate-bounce">
              <Award size={32} />
            </div>

            <h2 className="text-xl font-black font-mono text-emerald-400 tracking-wider mb-1 text-center">
              {mode==='daily'?'DAILY HEIST COMPLETE':mode==='tutorial'?`LESSON ${tutorial} COMPLETE`:'FIREWALL BREACHED!'}
            </h2>
            <p className="text-xs text-zinc-400 font-mono mb-3 text-center">
              {isTierMilestone
                ? `TIER ${Math.floor(currentLevel / 50)} COMPLETED · UNLOCKING NEXT PROTOCOL TIER`
                : `LEVEL ${currentLevel} COMPROMISED · ADVANCING TO NEXT SECTOR`}
            </p>

            <div className="w-full bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3 mb-3 space-y-1 text-center">
              <span className="text-[10px] text-zinc-400 font-mono block">
                RUN HEIST SCORE
              </span>
              <span className="text-xl font-black font-mono text-emerald-300">
                {gameState.score.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-400 font-mono block pt-1 border-t border-slate-800">
                SECTOR SCORE: {levelScore.toLocaleString()} PTS ({gameState.moves} MOVES REMAINING BONUS)
              </span>
            </div>

            {mode==='campaign'&&<p className="stars" data-testid="completion-stars">{'★'.repeat(lastStars)}{'☆'.repeat(3-lastStars)} · {boostersUsed.current===0?'No boosters used':'Boosters used: '+boostersUsed.current}</p>}
            {mode==='campaign'&&lastExperience&&<div className="experience-reward" data-testid="completion-xp"><strong>+{lastExperience.total} XP · {lastExperience.multiplier.toFixed(2)}×</strong><span>{lastExperience.boosterFree?'BOOSTER-FREE CLEAR':'BASE XP · BOOSTER USED'}</span><p>{lastExperience.movesTaken} moves taken / {lastExperience.moveBudget} move budget · difficulty {lastExperience.difficulty}/6{currentLevel%10===0?' · security core':''}</p><p>{lastExperience.base} base + {lastExperience.bonus} bonus XP · Career total: {career.xp.toLocaleString()}</p></div>}
            {mode==='daily'&&<p className="text-cyan-300">Personal best: {dailyBest.toLocaleString()}</p>}
            {mode==='tutorial'&&<p className="lesson-result">{lesson(tutorial).result}</p>}
            {mode==='campaign'&&piecesWon.map(id=><div className="piece-reward" key={id} data-testid="piece-reward"><strong>PIECE SET WON · {PIECE_STYLES.find(p=>p.id===id)?.name}</strong><button className="cyber-button" onClick={()=>setCareer(c=>({...c,pieceStyle:id}))}>EQUIP NEW PIECES</button></div>)}
            {mode==='campaign'&&currentLevel%10===0&&<p className="lesson-result">Next chapter: {themeForLevel(currentLevel+1).name} · new scenery, animations and sound effects.</p>}
            {/* SECTOR LOOT & BOOSTER REWARD CLAIM PANEL */}
            {lastLevelRewards && (
              <div data-testid="completion-loot" className="w-full bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-3 mb-4 flex flex-col items-center">
                <span className="text-[10px] font-mono font-black text-yellow-400 tracking-widest uppercase flex items-center gap-1 mb-2">
                  <Trophy size={13} /> SECTOR LOOT REWARDS CLAIMED:
                </span>
                <div className="grid grid-cols-2 gap-1.5 w-full">
                  {(lastLevelRewards.emp_bomb || 0) > 0 && (
                    <div className="bg-slate-950/80 border border-amber-500/50 px-2 py-1 rounded-lg flex items-center justify-between text-xs font-mono font-bold text-amber-300">
                      <span>💣 EMP Blast</span>
                      <span className="text-yellow-400 font-black">+{lastLevelRewards.emp_bomb}</span>
                    </div>
                  )}
                  {(lastLevelRewards.overclock_moves || 0) > 0 && (
                    <div className="bg-slate-950/80 border border-emerald-500/50 px-2 py-1 rounded-lg flex items-center justify-between text-xs font-mono font-bold text-emerald-300">
                      <span>⏱️ +5 Moves</span>
                      <span className="text-emerald-400 font-black">+{lastLevelRewards.overclock_moves}</span>
                    </div>
                  )}
                  {(lastLevelRewards.line_laser || 0) > 0 && (
                    <div className="bg-slate-950/80 border border-cyan-500/50 px-2 py-1 rounded-lg flex items-center justify-between text-xs font-mono font-bold text-cyan-300">
                      <span>⚡ Dual Laser</span>
                      <span className="text-cyan-400 font-black">+{lastLevelRewards.line_laser}</span>
                    </div>
                  )}
                  {(lastLevelRewards.overload_core || 0) > 0 && (
                    <div className="bg-slate-950/80 border border-fuchsia-500/50 px-2 py-1 rounded-lg flex items-center justify-between text-xs font-mono font-bold text-fuchsia-300">
                      <span>🌀 Overload</span>
                      <span className="text-fuchsia-400 font-black">+{lastLevelRewards.overload_core}</span>
                    </div>
                  )}
                  {(lastLevelRewards.glitch_wipe || 0) > 0 && (
                    <div className="bg-slate-950/80 border border-purple-500/50 px-2 py-1 rounded-lg flex items-center justify-between text-xs font-mono font-bold text-purple-300">
                      <span>🛡️ Purge Wipe</span>
                      <span className="text-purple-400 font-black">+{lastLevelRewards.glitch_wipe}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <button className="cyber-button" onClick={()=>{setGameState(s=>({...s,status:'START'}));setHubOpen(true);}}>RETURN TO HEIST HUB</button>

            <button
              onClick={() => {
                gameAudio.playConfirmSelect();
                advanceLevel();
              }}
              className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-3 rounded-xl font-mono font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 active:scale-95">
              <Play size={18} />
              {mode==='daily'?'RETURN TO DAILY HEISTS':mode==='tutorial'?(tutorial===LESSONS.length?'TRAINING COMPLETE':`NEXT LESSON ${tutorial+1}`):bonus?'PLAY BONUS SLOT ROUND':`BREACH LEVEL ${currentLevel + 1}`}
            </button>
          </div>
        </MenuOverlay>
      )}

      {academyOpen&&<MenuOverlay wide zIndex={80}><TrainingAcademy performance={academyPerformance} onClose={()=>setAcademyOpen(false)} onStart={n=>initGame(1,null,0,0,22,{mode:'tutorial',tutorial:n,seed:100+n})}/></MenuOverlay>}
      {bonusOpen&&bonus&&<BonusRound key={bonus.id} round={bonus} reducedMotion={preferences.reducedMotion} onSpin={spinBonus} onContinue={continueBonus}/>}

      {/* CONNECTION LOST / GAME OVER */}
      {gameState.status === 'GAME_OVER' && mode!=='multiplayer' && (
        <MenuOverlay tone="danger" zIndex={50}>
          <div className="w-full max-w-sm bg-slate-950 border-2 border-red-500/80 rounded-2xl p-6 shadow-2xl shadow-red-950/50 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-400 flex items-center justify-center text-red-400 mb-3 animate-pulse">
              <Shield size={32} />
            </div>
            <h2 className="text-xl font-black font-mono text-red-500 tracking-wider mb-1">
              CONNECTION TRACED!
            </h2>
            <p className="text-xs text-zinc-400 font-mono mb-4">
              INTRUSION TERMINATED AT LEVEL {currentLevel}
            </p>

            <div className="w-full bg-slate-900/90 border border-red-500/30 rounded-xl p-3.5 mb-5 text-center">
              <span className="text-[11px] text-zinc-400 font-mono block">
                FINAL HEIST SCORE
              </span>
              <span className="text-2xl font-black font-mono text-red-300">
                {gameState.score.toLocaleString()}
              </span>
            </div>

            <div className="w-full space-y-2.5">
              <button
                ref={restartButtonRef}
                autoFocus
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  clearSaveGame();
                  initGame(1);
                }}
                className="w-full min-h-[48px] bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-mono font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-600/30">
                <RotateCw size={18} />
                RESTART DIGITAL HEIST (LEVEL 1)
              </button>

              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                className="w-full min-h-[48px] bg-slate-900 hover:bg-slate-800 border border-zinc-700 text-zinc-300 py-2.5 rounded-xl font-mono font-bold text-xs flex items-center justify-center">
                RETURN TO MAIN MENU
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}
      <OnlinePanel online={online} currentLevel={currentLevel}/>
    </div>
  );
}
