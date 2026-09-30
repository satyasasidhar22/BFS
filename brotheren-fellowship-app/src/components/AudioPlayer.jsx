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
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    let objectUrl = null;
    let isCancelled = false;

    async function prepareAudio() {
      // Reset state on song change
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setAudioUrl(null);
      setStatusMessage('ఆడియో లోడ్ అవుతోంది... (Loading audio...)');

      if (!currentSong) return;

      const songId = currentSong.id;

      // 1. First Priority: Check IndexedDB offline storage
      try {
        const cachedBlob = await getCachedAudioBlob(songId);
        if (cachedBlob && cachedBlob.size > 0) {
          objectUrl = URL.createObjectURL(cachedBlob);
          if (!isCancelled) {
            setAudioUrl(objectUrl);
            setIsOfflineReady(true);
            setStatusMessage('');
          }
          return;
        }
      } catch (err) {
        console.warn('Error reading from IndexedDB:', err);
      }

      // 2. Direct Blob / File
      if (currentSong.audioBlob instanceof Blob) {
        objectUrl = URL.createObjectURL(currentSong.audioBlob);
        if (!isCancelled) {
          setAudioUrl(objectUrl);
          setIsOfflineReady(true);
          setStatusMessage('');
        }
        return;
      }

      // 3. Cloud URL (Supabase)
      const remoteUrl = currentSong.audioUrl || (typeof currentSong.audioBlob === 'string' ? currentSong.audioBlob : null);

      if (remoteUrl && typeof remoteUrl === 'string' && remoteUrl.startsWith('http')) {
        // If offline and NOT cached in IndexedDB
        if (!navigator.onLine) {
          if (!isCancelled) {
            setAudioUrl(null);
            setIsOfflineReady(false);
            setStatusMessage('ఈ పాట ఆఫ్‌లైన్‌లో సేవ్ కాలేదు. దయచేసి ఇంటర్నెట్ ఉన్నప్పుడు డౌన్‌లోడ్ చేయండి.');
          }
          return;
        }

        // Online: use remote URL and silently cache to IndexedDB
        if (!isCancelled) {
          setAudioUrl(remoteUrl);
          setIsOfflineReady(false);
          setStatusMessage('');
        }

        fetch(remoteUrl)
          .then((res) => {
            if (!res.ok) throw new Error('Fetch failed');
            return res.blob();
          })
          .then((blob) => {
            if (!isCancelled && blob.size > 0) {
              saveAudioBlobToCache(songId, blob);
              setIsOfflineReady(true);
            }
          })
          .catch(() => {});
      } else {
        if (!isCancelled) {
          setAudioUrl(null);
          setStatusMessage('ఈ పాటకు ఆడియో ఫైల్ లేదు (No audio file attached)');
        }
      }
    }

    prepareAudio();

    return () => {
      isCancelled = true;
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
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Play prevented:', err);
          setIsPlaying(false);
        });
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (!isNaN(d) && d > 0) setDuration(d);
      
      // Auto-play safely once audio element metadata is fully ready
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
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
      {/* ONLY render audio element when audioUrl is valid */}
      {audioUrl && (
        <audio
          key={audioUrl}
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={onNext}
          onError={(e) => {
            console.error('Audio tag error:', e);
            setIsPlaying(false);
          }}
        />
      )}

      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 truncate pr-4">
            <h4 className="font-semibold text-base sm:text-lg text-emerald-400 truncate flex items-center gap-2">
              <span>🎵 {currentSong.title}</span>
              {isOfflineReady && (
                <span className="flex items-center gap-1 text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded font-normal shrink-0">
                  <CheckCircle2 size={12} /> Offline
                </span>
              )}
            </h4>
            {statusMessage ? (
              <p className="text-xs text-amber-400 font-medium flex items-center gap-1 mt-0.5">
                <AlertCircle size={13} className="shrink-0" />
                <span className="truncate">{statusMessage}</span>
              </p>
            ) : currentSong.singer ? (
              <p className="text-xs text-slate-400 truncate">{currentSong.singer}</p>
            ) : null}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full text-slate-400" aria-label="Close">
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
            disabled={!audioUrl}
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
            disabled={!audioUrl}
            className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-full shadow-lg active:scale-95 transition-transform"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
          </button>
          
          <button onClick={onNext} className="p-2 hover:bg-slate-800 rounded-full active:scale-95" aria-label="Next">
            <SkipForward size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}