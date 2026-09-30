import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { getCachedAudioBlob, saveAudioBlobToCache } from '../db/indexedDB';

export default function AudioPlayer({ 
  currentSong, 
  onNext, 
  onPrev, 
  onClose, 
  requestWakeLock, 
  releaseWakeLock 
}) {
  const audioInstanceRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    let isCancelled = false;

    // Stop and clean up any previously playing audio
    if (audioInstanceRef.current) {
      audioInstanceRef.current.pause();
      audioInstanceRef.current.src = '';
      audioInstanceRef.current = null;
    }

    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setErrorMessage('');

    if (!currentSong) return;

    async function loadAudio() {
      setIsLoading(true);

      let playableSource = null;

      // 1. Check local IndexedDB offline storage
      try {
        const blob = await getCachedAudioBlob(currentSong.id);
        if (blob && blob.size > 0) {
          objectUrl = URL.createObjectURL(blob);
          playableSource = objectUrl;
          if (!isCancelled) setIsOfflineReady(true);
        }
      } catch (err) {
        console.warn('Error fetching from IndexedDB:', err);
      }

      // 2. Direct Blob / File
      if (!playableSource && currentSong.audioBlob instanceof Blob) {
        objectUrl = URL.createObjectURL(currentSong.audioBlob);
        playableSource = objectUrl;
        if (!isCancelled) setIsOfflineReady(true);
      }

      // 3. Fallback to Cloud URL
      const remoteUrl = currentSong.audioUrl || (typeof currentSong.audioBlob === 'string' ? currentSong.audioBlob : null);

      if (!playableSource && remoteUrl && typeof remoteUrl === 'string' && remoteUrl.startsWith('http')) {
        if (!navigator.onLine) {
          if (!isCancelled) {
            setIsLoading(false);
            setErrorMessage('ఈ పాట ఆఫ్‌లైన్‌లో సేవ్ కాలేదు. దయచేసి నెట్ ఉన్నప్పుడు డౌన్‌లోడ్ చేయండి.');
          }
          return;
        }

        playableSource = remoteUrl;
        if (!isCancelled) setIsOfflineReady(false);

        // Download in background for future offline use
        fetch(remoteUrl)
          .then(res => {
            if (!res.ok) throw new Error('Fetch failed');
            return res.blob();
          })
          .then(blob => {
            if (!isCancelled && blob.size > 0) {
              saveAudioBlobToCache(currentSong.id, blob);
              setIsOfflineReady(true);
            }
          })
          .catch(() => {});
      }

      if (!playableSource) {
        if (!isCancelled) {
          setIsLoading(false);
          setErrorMessage('ఆడియో ఫైల్ లేదు (No audio source found)');
        }
        return;
      }

      if (isCancelled) return;

      // Create audio element cleanly with verified source
      const audio = new Audio();
      audio.preload = 'auto';
      audioInstanceRef.current = audio;

      audio.onloadedmetadata = () => {
        if (isCancelled) return;
        const d = audio.duration;
        if (!isNaN(d) && d > 0) setDuration(d);
        setIsLoading(false);
        audio.play()
          .then(() => {
            if (!isCancelled) setIsPlaying(true);
          })
          .catch(e => {
            console.warn('Playback prevented by browser policy:', e);
            if (!isCancelled) setIsPlaying(false);
          });
      };

      audio.ontimeupdate = () => {
        if (!isCancelled && audio) setCurrentTime(audio.currentTime);
      };

      audio.onended = () => {
        if (!isCancelled) {
          setIsPlaying(false);
          onNext?.();
        }
      };

      audio.onerror = (e) => {
        if (isCancelled) return;
        console.error('Audio playback error:', e);
        setIsLoading(false);
        setIsPlaying(false);
        setErrorMessage('ఆడియో ప్లే చేయడం విఫలమైంది');
      };

      // Set the src only after all listeners are registered
      audio.src = playableSource;
    }

    loadAudio();

    return () => {
      isCancelled = true;
      if (audioInstanceRef.current) {
        audioInstanceRef.current.pause();
        audioInstanceRef.current.src = '';
        audioInstanceRef.current = null;
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [currentSong]);

  // Keep screen awake
  useEffect(() => {
    if (isPlaying) requestWakeLock?.();
    else releaseWakeLock?.();
    return () => releaseWakeLock?.();
  }, [isPlaying, requestWakeLock, releaseWakeLock]);

  const togglePlay = () => {
    const audio = audioInstanceRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.warn('Play error:', err);
          setIsPlaying(false);
        });
    }
  };

  const handleSeek = (e) => {
    const time = Number(e.target.value);
    const audio = audioInstanceRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds) || timeInSeconds <= 0) return '00:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentSong) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 text-white p-3 z-50 shadow-2xl safe-area-bottom">
      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 truncate pr-4">
            <h4 className="font-semibold text-base sm:text-lg text-emerald-400 truncate flex items-center gap-2">
              <span>🎵 {currentSong.title}</span>
              {isOfflineReady && (
                <span className="flex items-center gap-1 text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded font-normal shrink-0">
                  <CheckCircle2 size={12} /> Offline Ready
                </span>
              )}
            </h4>
            {errorMessage ? (
              <p className="text-xs text-amber-400 font-medium flex items-center gap-1 mt-0.5">
                <AlertCircle size={13} className="shrink-0" />
                <span className="truncate">{errorMessage}</span>
              </p>
            ) : currentSong.singer ? (
              <p className="text-xs text-slate-400 truncate">{currentSong.singer}</p>
            ) : null}
          </div>
          <button 
            onClick={() => {
              if (audioInstanceRef.current) {
                audioInstanceRef.current.pause();
              }
              onClose?.();
            }} 
            className="p-1 hover:bg-slate-800 rounded-full text-slate-400"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrubber */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-10 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={!duration || Boolean(errorMessage)}
            className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
          />
          <span className="text-xs text-slate-400 w-10">{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 mt-1">
          <button onClick={onPrev} className="p-2 hover:bg-slate-800 rounded-full active:scale-95" aria-label="Previous">
            <SkipBack size={24} />
          </button>
          
          <button 
            onClick={togglePlay} 
            disabled={Boolean(errorMessage) || isLoading}
            className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-full shadow-lg active:scale-95 transition-transform"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
          </button>
          
          <button onClick={onNext} className="p-2 hover:bg-slate-800 rounded-full active:scale-95">
            <SkipForward size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}