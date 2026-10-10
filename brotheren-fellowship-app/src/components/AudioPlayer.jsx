import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { getCachedAudioBlob, saveAudioBlobToCache } from '../db/indexedDB';

export default function AudioPlayer({ 
  currentSong, 
  onNext, 
  onPrev, 
  onClose, 
  requestWakeLock, 
  releaseWakeLock 
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const currentObjectUrlRef = useRef(null);

  // Helper to resolve blob from IndexedDB trying both string and number ID types
  const retrieveBlobSafely = async (songId) => {
    try {
      let b = await getCachedAudioBlob(songId);
      if (!b && typeof songId === 'string' && !isNaN(Number(songId))) {
        b = await getCachedAudioBlob(Number(songId));
      }
      if (!b && typeof songId === 'number') {
        b = await getCachedAudioBlob(String(songId));
      }
      return b;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let isCancelled = false;
    const audio = audioRef.current;

    // Reset player state
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }

    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setErrorMessage('');

    if (!currentSong) return;

    async function setupAudio() {
      setIsLoading(true);

      let playableUrl = null;

      // 1. Check local IndexedDB cache
      const cachedBlob = await retrieveBlobSafely(currentSong.id);
      if (cachedBlob && cachedBlob.size > 0) {
        // Enforce audio/mpeg type if missing so mobile decoders don't reject it
        const normalizedBlob = cachedBlob.type ? cachedBlob : new Blob([cachedBlob], { type: 'audio/mpeg' });
        const objUrl = URL.createObjectURL(normalizedBlob);
        currentObjectUrlRef.current = objUrl;
        playableUrl = objUrl;
        if (!isCancelled) setIsOfflineReady(true);
      }

      // 2. Direct Blob/File fallback
      if (!playableUrl && currentSong.audioBlob instanceof Blob) {
        const objUrl = URL.createObjectURL(currentSong.audioBlob);
        currentObjectUrlRef.current = objUrl;
        playableUrl = objUrl;
        if (!isCancelled) setIsOfflineReady(true);
      }

      // 3. Remote URL fallback
      const remoteUrl = currentSong.audioUrl || (typeof currentSong.audioBlob === 'string' ? currentSong.audioBlob : null);

      if (!playableUrl && remoteUrl && typeof remoteUrl === 'string' && remoteUrl.startsWith('http')) {
        if (!navigator.onLine) {
          if (!isCancelled) {
            setIsLoading(false);
            setErrorMessage('ఈ పాట ఆఫ్‌లైన్‌లో సేవ్ కాలేదు. దయచేసి నెట్ ఉన్నప్పుడు డౌన్‌లోడ్ చేయండి.');
          }
          return;
        }

        playableUrl = remoteUrl;
        if (!isCancelled) setIsOfflineReady(false);

        // Auto-download to cache in background for next time
        fetch(remoteUrl)
          .then(res => res.ok ? res.blob() : null)
          .then(blob => {
            if (!isCancelled && blob && blob.size > 0) {
              const mp3Blob = blob.type ? blob : new Blob([blob], { type: 'audio/mpeg' });
              saveAudioBlobToCache(currentSong.id, mp3Blob);
              setIsOfflineReady(true);
            }
          })
          .catch(() => {});
      }

      if (!playableUrl) {
        if (!isCancelled) {
          setIsLoading(false);
          setErrorMessage('ఆడియో ఫైల్ లేదు (No audio source found)');
        }
        return;
      }

      if (isCancelled || !audioRef.current) return;

      const currentAudio = audioRef.current;
      currentAudio.src = playableUrl;
      currentAudio.load();

      currentAudio.play()
        .then(() => {
          if (!isCancelled) {
            setIsPlaying(true);
            setIsLoading(false);
          }
        })
        .catch(err => {
          console.warn('Playback gesture requirement or decode delay:', err);
          if (!isCancelled) {
            setIsPlaying(false);
            setIsLoading(false);
          }
        });
    }

    setupAudio();

    return () => {
      isCancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
      }
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }
    };
  }, [currentSong]);

  // Keep screen awake while playing
  useEffect(() => {
    if (isPlaying) requestWakeLock?.();
    else releaseWakeLock?.();
    return () => releaseWakeLock?.();
  }, [isPlaying, requestWakeLock, releaseWakeLock]);

  const togglePlay = () => {
    const audio = audioRef.current;
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
    const audio = audioRef.current;
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
      {/* Declarative HTML5 Audio Element */}
      <audio
        ref={audioRef}
        preload="auto"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (!isNaN(d) && d > 0) setDuration(d);
          setIsLoading(false);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setIsPlaying(false);
          onNext?.();
        }}
        onError={() => {
          setIsLoading(false);
          setIsPlaying(false);
          if (!errorMessage) {
            setErrorMessage('ఆడియో ప్లే చేయడం విఫలమైంది (Audio play error)');
          }
        }}
      />

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
              if (audioRef.current) audioRef.current.pause();
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
            {isLoading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={24} />
            ) : (
              <Play size={24} className="ml-0.5" />
            )}
          </button>
          
          <button onClick={onNext} className="p-2 hover:bg-slate-800 rounded-full active:scale-95" aria-label="Next">
            <SkipForward size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
