import React from 'react';
import { ArrowLeft, Play, Heart, Mic, Edit3, Trash2 } from 'lucide-react';

export default function SongDetailsModal({ 
  song, 
  onClose, 
  onPlay, 
  onToggleLike, 
  onEdit, 
  onDelete, 
  t 
}) {
  if (!song) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        
        {/* Header Bar with Back Arrow & Actions */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
          <div className="flex items-center gap-2 min-w-0">
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full transition-colors active:scale-95 shrink-0"
              title={t.back}
            >
              <ArrowLeft size={22} />
            </button>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
              {song.title}
            </h3>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Edit Button */}
            <button
              onClick={() => onEdit(song)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
              title={t.edit}
            >
              <Edit3 size={20} />
            </button>
            {/* Delete Button */}
            <button
              onClick={() => onDelete(song.id)}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-colors"
              title={t.delete}
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        {/* Song Lyrics Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-slate-700 dark:text-slate-300">
          {song.singer && (
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
              <Mic size={16} /> <span>{song.singer}</span>
            </div>
          )}

          {song.lyrics ? (
            <div className="whitespace-pre-line text-lg sm:text-xl leading-relaxed sm:leading-loose font-serif bg-amber-50/60 dark:bg-slate-800/40 p-5 sm:p-7 rounded-2xl border border-amber-100 dark:border-slate-800 select-text">
              {song.lyrics}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              {t.noLyrics}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <button 
            onClick={() => onToggleLike(song.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm sm:text-base font-medium transition-colors ${
              song.liked 
                ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900' 
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Heart size={18} className={song.liked ? 'fill-rose-600 text-rose-600' : ''} />
            {song.liked ? '❤️' : '🤍'}
          </button>

          <button 
            onClick={() => {
              onPlay(song);
              onClose();
            }} 
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-medium text-sm sm:text-base rounded-xl shadow-md transition-colors active:scale-95"
          >
            <Play size={18} className="fill-white" /> {t.listenSong}
          </button>
        </div>
      </div>
    </div>
  );
}