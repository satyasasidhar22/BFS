import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, X } from 'lucide-react';

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

  // Generate object URL for Blob audio
  useEffect(() => {
    if (currentSong?.audioBlob) {
      const url = URL.createObjectURL(currentSong.audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [currentSong]);

  // Keep screen awake while playing
  useEffect(() => {
    if (isPlaying) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => {
      releaseWakeLock();
    };
  }, [isPlaying, requestWakeLock, releaseWakeLock]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
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
    if (isNaN(timeInSeconds)) return '00:00';
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
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={onNext}
        />
      )}

      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 truncate pr-4">
            <h4 className="font-semibold text-base sm:text-lg text-emerald-400 truncate">
              🎵 {currentSong.title}
            </h4>
            {currentSong.singer && (
              <p className="text-xs text-slate-400 truncate">{currentSong.singer}</p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-slate-800 rounded-full text-slate-400"
            aria-label="Close Player"
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
            className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
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
            className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg active:scale-95 transition-transform"
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