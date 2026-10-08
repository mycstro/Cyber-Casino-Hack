import React, {useCallback, useEffect, useRef, useState} from 'react';
import {MusicTrack} from './helper';

/**
 * Properties for the BackgroundMusic component.
 */
export interface BackgroundMusicProps {
  /** The URL of a single audio track to play (optional if tracks is provided). */
  readonly url?: string;
  /** Playlist of audio tracks (e.g. 6 songs) to play in random/shuffle order. */
  readonly tracks?: readonly (MusicTrack | string)[];
  /** Whether playback is currently active. */
  readonly isPlaying: boolean;
  /** Whether the audio output is muted. Defaults to false. */
  readonly isMuted?: boolean;
  /** Master volume level between 0.0 (silent) and 1.0 (full). Defaults to 0.2. */
  readonly volume?: number;
  /** Whether to play the playlist in randomized shuffle order. Defaults to true. */
  readonly shuffle?: boolean;
  /** Callback fired whenever the current playing track changes. */
  readonly onTrackChange?: (track: MusicTrack | string, index: number) => void;
  /** Optional manual track index override */
  readonly currentTrackIndex?: number;
}

const DEFAULT_VOLUME = 0.25;

/** Helper to extract track URL */
function getTrackUrl(item: MusicTrack | string | undefined): string {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return item.url || '';
}

/** Helper to generate a shuffled index order */
function generateShuffledIndices(count: number, avoidFirstIndex = -1): number[] {
  if (count <= 0) return [];
  const indices = Array.from({length: count}, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  if (count > 1 && avoidFirstIndex >= 0 && indices[0] === avoidFirstIndex) {
    const swapTarget = Math.floor(Math.random() * (count - 1)) + 1;
    [indices[0], indices[swapTarget]] = [indices[swapTarget], indices[0]];
  }
  return indices;
}

/**
 * Resilient, reliable Background Music player supporting HTML5 audio and Web Audio decoding.
 * Provides instant sound with zero loop gaps, autoplay unlocking, and robust shuffle.
 */
export function BackgroundMusic({
  url,
  tracks,
  isPlaying,
  isMuted = false,
  volume = DEFAULT_VOLUME,
  shuffle = true,
  onTrackChange,
  currentTrackIndex: explicitTrackIndex,
}: BackgroundMusicProps): React.ReactElement | null {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onTrackChangeRef = useRef(onTrackChange);
  onTrackChangeRef.current = onTrackChange;

  const [platformMuted, setPlatformMuted] = useState(false);
  const effectiveMuted = isMuted || platformMuted;

  const hasPlaylist = Array.isArray(tracks) && tracks.length > 0;
  const trackCount = hasPlaylist ? tracks.length : 0;

  const [playlistIndex, setPlaylistIndex] = useState<number>(() => {
    if (typeof explicitTrackIndex === 'number' && explicitTrackIndex >= 0 && explicitTrackIndex < trackCount) {
      return explicitTrackIndex;
    }
    return 0;
  });

  const shuffleQueueRef = useRef<number[]>([]);
  const queuePointerRef = useRef<number>(0);

  // Initialize shuffle queue once on mount or track count change
  useEffect(() => {
    if (hasPlaylist) {
      if (shuffle) {
        shuffleQueueRef.current = generateShuffledIndices(trackCount);
        queuePointerRef.current = 0;
        const initialIdx = shuffleQueueRef.current[0] ?? 0;
        setPlaylistIndex(initialIdx);
      } else {
        shuffleQueueRef.current = Array.from({length: trackCount}, (_, i) => i);
        queuePointerRef.current = 0;
        setPlaylistIndex(0);
      }
    }
  }, [hasPlaylist, trackCount, shuffle]);

  // Sync explicit track index override from user selections
  const prevExplicitIndexRef = useRef<number | undefined>(explicitTrackIndex);
  useEffect(() => {
    if (
      typeof explicitTrackIndex === 'number' &&
      explicitTrackIndex >= 0 &&
      explicitTrackIndex < trackCount &&
      explicitTrackIndex !== prevExplicitIndexRef.current
    ) {
      prevExplicitIndexRef.current = explicitTrackIndex;
      setPlaylistIndex(explicitTrackIndex);
    }
  }, [explicitTrackIndex, trackCount]);

  // Determine current active track and URL
  const currentItem = hasPlaylist ? tracks[playlistIndex] : undefined;
  const currentUrl = hasPlaylist ? getTrackUrl(currentItem) : url || '';

  // Notify parent of track change using ref to avoid re-triggering effects
  useEffect(() => {
    if (hasPlaylist && currentItem && onTrackChangeRef.current) {
      onTrackChangeRef.current(currentItem, playlistIndex);
    }
  }, [hasPlaylist, currentItem, playlistIndex]);

  // Synchronize with Playground platform mute events
  useEffect(() => {
    const handlePlatformMute = (e: Event) => {
      const customEvent = e as CustomEvent<{muted: boolean}>;
      if (typeof customEvent.detail?.muted === 'boolean') {
        setPlatformMuted(customEvent.detail.muted);
      }
    };
    window.addEventListener('playground-mute', handlePlatformMute);
    return () => {
      window.removeEventListener('playground-mute', handlePlatformMute);
    };
  }, []);

  // Advance to next random or sequential track
  const advanceToNextTrack = useCallback(() => {
    if (!hasPlaylist || trackCount <= 1) return;

    if (shuffle) {
      let nextPtr = queuePointerRef.current + 1;
      if (nextPtr >= shuffleQueueRef.current.length) {
        const lastIndex = shuffleQueueRef.current[shuffleQueueRef.current.length - 1];
        shuffleQueueRef.current = generateShuffledIndices(trackCount, lastIndex);
        nextPtr = 0;
      }
      queuePointerRef.current = nextPtr;
      const nextIdx = shuffleQueueRef.current[nextPtr];
      setPlaylistIndex(nextIdx);
    } else {
      setPlaylistIndex((prev) => (prev + 1) % trackCount);
    }
  }, [hasPlaylist, trackCount, shuffle]);

  // Autoplay unlocker: immediately plays on first user interaction if blocked
  useEffect(() => {
    const unlockAndPlay = () => {
      const audio = audioRef.current;
      if (audio && isPlaying && !effectiveMuted) {
        audio.play().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', unlockAndPlay, {passive: true});
    window.addEventListener('keydown', unlockAndPlay, {passive: true});
    window.addEventListener('touchstart', unlockAndPlay, {passive: true});
    window.addEventListener('click', unlockAndPlay, {passive: true});

    return () => {
      window.removeEventListener('pointerdown', unlockAndPlay);
      window.removeEventListener('keydown', unlockAndPlay);
      window.removeEventListener('touchstart', unlockAndPlay);
      window.removeEventListener('click', unlockAndPlay);
    };
  }, [isPlaying, effectiveMuted]);

  // Handle Play/Pause and track change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentUrl) return;

    audio.volume = effectiveMuted ? 0 : Math.max(0, Math.min(1, volume));
    audio.muted = effectiveMuted;

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Autoplay was prevented; unlock listener will trigger on interaction
          console.debug('[BackgroundMusic] Autoplay waiting for interaction:', err);
        });
      }
    } else {
      audio.pause();
    }
  }, [currentUrl, isPlaying, effectiveMuted, volume]);

  // Handle Volume & Mute dynamically
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = effectiveMuted;
    audio.volume = effectiveMuted ? 0 : Math.max(0, Math.min(1, volume));
  }, [effectiveMuted, volume]);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibility = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (document.hidden) {
        audio.pause();
      } else if (isPlaying && !effectiveMuted) {
        audio.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isPlaying, effectiveMuted]);

  if (!currentUrl) {
    return null;
  }

  return (
    <audio
      ref={audioRef}
      key={currentUrl}
      src={currentUrl}
      preload="auto"
      loop={!hasPlaylist || trackCount <= 1}
      onEnded={() => {
        if (hasPlaylist && trackCount > 1) {
          advanceToNextTrack();
        }
      }}
      style={{display: 'none'}}
    />
  );
}

// tslint:disable-next-line:no-default-export
export default BackgroundMusic;
