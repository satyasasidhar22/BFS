import React from 'react';
import { ArrowLeft, Play, Heart, Mic, Edit3, Trash2, DownloadCloud, Check, Loader2 } from 'lucide-react';

export default function SongDetailsModal({ 
  song, 
  onClose, 
  onPlay, 
  onToggleLike, 
  onEdit, 
  onDelete, 
  onDownload,
  isDownloaded,
  isDownloading,
  t 
}) {
  if (!song) return null;

  const hasAudio = Boolean(song.audioUrl || (typeof song.audioBlob === 'string' && song.audioBlob.startsWith('http')));

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 flex flex-col justify-between">
      <div className="bg-white dark:bg-slate-950 w-full h-full flex flex-col overflow-hidden">
        
        {/* Top App Header with Back button */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-blue-800 text-white shadow-sm shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button 
              onClick={onClose} 
              className="p-1.5 hover:bg-blue-700 text-white rounded-full transition-colors active:scale-95 shrink-0"
              title={t.back}
            >
              <ArrowLeft size={22} />
            </button>
            <h3 className="text-base sm:text-lg font-bold truncate">
              {song.title}
            </h3>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Offline Download Button */}
            {hasAudio && (
              <button
                onClick={(e) => onDownload && onDownload(e, song)}
                disabled={isDownloaded || isDownloading}
                className={`p-2 rounded-full transition-colors active:scale-90 ${
                  isDownloaded 
                    ? 'text-emerald-300 cursor-default' 
                    : 'text-blue-100 hover:text-white hover:bg-blue-700'
                }`}
                title={isDownloaded ? 'Downloaded Offline' : 'Download for Offline'}
              >
                {isDownloading ? (
                  <Loader2 size={19} className="animate-spin text-amber-300" />
                ) : isDownloaded ? (
                  <Check size={19} />
                ) : (
                  <DownloadCloud size={19} />
                )}
              </button>
            )}

            {/* Like Button */}
            <button
              onClick={() => onToggleLike(song.id)}
              className="p-2 hover:bg-blue-700 text-white rounded-full transition-colors active:scale-90"
              title="Like"
            >
              <Heart 
                size={20} 
                className={song.liked ? 'fill-rose-400 text-rose-400' : 'text-white'} 
              />
            </button>

            {/* Quick Edit */}
            <button
              onClick={() => onEdit(song)}
              className="p-2 text-blue-100 hover:text-white hover:bg-blue-700 rounded-full transition-colors"
              title={t.edit}
            >
              <Edit3 size={19} />
            </button>

            {/* Delete */}
            <button
              onClick={() => onDelete(song.id)}
              className="p-2 text-rose-300 hover:text-rose-100 hover:bg-blue-700 rounded-full transition-colors"
              title={t.delete}
            >
              <Trash2 size={19} />
            </button>
          </div>
        </div>

        {/* Scrollable Song Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-slate-800 dark:text-slate-200 pb-44 max-w-3xl mx-auto w-full">
          {song.singer && (
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 font-medium">
              <div className="flex items-center gap-2">
                <Mic size={16} /> <span>{song.singer}</span>
              </div>
              {isDownloaded && (
                <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-700/50 px-2 py-0.5 rounded-full font-sans">
                  ✓ Saved Offline
                </span>
              )}
            </div>
          )}

          {song.lyrics ? (
            <div className="whitespace-pre-line text-lg sm:text-xl leading-relaxed sm:leading-loose font-serif bg-slate-50 dark:bg-slate-900/70 p-5 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 select-text shadow-inner">
              {song.lyrics}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">
              {t.noLyrics}
            </div>
          )}

          {/* Explicit Play Button Inside Lyrics Screen */}
          <div className="pt-2 flex justify-center">
            <button 
              onClick={() => onPlay(song)} 
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base rounded-full shadow-lg transition-transform active:scale-95"
            >
              <Play size={18} className="fill-white ml-0.5" /> {t.listenSong}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
