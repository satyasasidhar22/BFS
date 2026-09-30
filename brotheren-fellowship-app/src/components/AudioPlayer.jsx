import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, CheckCircle2 } from 'lucide-react';
import { getCachedAudioBlob, saveAudioBlobToCache } from '../db/indexedDB';

// Convert Blob to Base64 Data URI (Bypasses Chrome Range request failures offline)
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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
  const [audioUrl, setAudioUrl] = useState(null);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadAudio() {
      setLoadError(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);

      if (!currentSong) {
        setAudioUrl(null);
        return;
      }

      // 1. Check local IndexedDB offline storage first
      try {
        const cachedBlob = await getCachedAudioBlob(currentSong.id);
        if (cachedBlob && cachedBlob.size > 0) {
          const dataUri = await blobToDataUrl(cachedBlob);
          if (!isCancelled) {
            setAudioUrl(dataUri);
            setIsOfflineReady(true);
            return;
          }
        }
      } catch (err) {
        console.warn('Error reading cached blob from IndexedDB:', err);
      }

      // 2. Direct Blob / File upload
      if (currentSong.audioBlob instanceof Blob) {
        try {
          const dataUri = await blobToDataUrl(currentSong.audioBlob);
          if (!isCancelled) {
            setAudioUrl(dataUri);
            setIsOfflineReady(true);
            return;
          }
        } catch (err) {
          console.warn('Error reading direct audio blob:', err);
        }
      }

      // 3. Fallback to Cloud URL (when online)
      const remoteUrl = currentSong.audioUrl || (typeof currentSong.audioBlob === 'string' ? currentSong.audioBlob : null);

      if (remoteUrl && typeof remoteUrl === 'string' && remoteUrl.startsWith('http')) {
        if (!navigator.onLine) {
          if (!isCancelled) {
            setAudioUrl(null);
            setLoadError(true);
          }
          return;
        }

        setAudioUrl(remoteUrl);
        setIsOfflineReady(false);

        // Pre-cache in background while online
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
      } else {
        setAudioUrl(null);
        setLoadError(true);
      }
    }

    loadAudio();

    return () => {
      isCancelled = true;
    };
  }, [currentSong]);

  useEffect(() => {
    if (isPlaying) requestWakeLock?.();
    else releaseWakeLock?.();
    return () => releaseWakeLock?.();
  }, [isPlaying, requestWakeLock, releaseWakeLock]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error('Playback error:', err);
          setIsPlaying(false);
          setLoadError(true);
        });
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (!isNaN(d) && d > 0) setDuration(d);

      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
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
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={onNext}
          onError={() => {
            setIsPlaying(false);
            setLoadError(true);
          }}
        />
      )}

      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 truncate pr-4">
            <h4 className="font-semibold text-base sm:text-lg text-emerald-400 truncate flex items-center gap-1.5">
              <span>🎵 {currentSong.title}</span>
              {isOfflineReady && (
                <span className="flex items-center gap-0.5 text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-1.5 py-0.5 rounded font-normal">
                  <CheckCircle2 size={10} /> Offline Ready
                </span>
              )}
            </h4>
            {loadError ? (
              <p className="text-xs text-rose-400 font-medium">
                ⚠️ ఆడియో అందుబాటులో లేదు (Please download while online first)
              </p>
            ) : currentSong.singer ? (
              <p className="text-xs text-slate-400 truncate">{currentSong.singer}</p>
            ) : null}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full text-slate-400">
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
            onChange={(e) => {
              const t = Number(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = t;
              setCurrentTime(t);
            }}
            disabled={!audioUrl}
            className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
          />
          <span className="text-xs text-slate-400 w-10">{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 mt-1">
          <button onClick={onPrev} className="p-2 hover:bg-slate-800 rounded-full active:scale-95">
            <SkipBack size={24} />
          </button>
          
          <button 
            onClick={togglePlay} 
            disabled={!audioUrl}
            className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-full shadow-lg active:scale-95 transition-transform"
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