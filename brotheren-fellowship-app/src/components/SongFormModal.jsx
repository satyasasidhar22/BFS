import React, { useState } from 'react';
import { ArrowLeft, Upload, Check, Loader2 } from 'lucide-react';
import { ALL_TELUGU_LETTERS, extractStartingTeluguLetter } from '../db/indexedDB';

export default function SongFormModal({ initialData = null, onClose, onSave, t }) {
  const isEditing = Boolean(initialData);

  const [title, setTitle] = useState(initialData?.title || '');
  const [startingLetter, setStartingLetter] = useState(
    initialData?.startingLetter || (initialData?.title ? extractStartingTeluguLetter(initialData.title) : 'అ')
  );
  const [lyrics, setLyrics] = useState(initialData?.lyrics || '');
  const [singer, setSinger] = useState(initialData?.singer || '');
  const [audioFile, setAudioFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val);
    if (!isEditing || !startingLetter) {
      const detected = extractStartingTeluguLetter(val);
      if (detected) setStartingLetter(detected);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        setError('Please select a valid audio file (MP3, WAV, OGG, M4A).');
        return;
      }
      setError('');
      setAudioFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t.songTitle + ' is required.');
      return;
    }

    const payload = {
      title: title.trim(),
      startingLetter,
      lyrics: lyrics.trim(),
      singer: singer.trim(),
    };

    // If new audio was picked, attach file. If editing, preserve existing audio link.
    if (audioFile) {
      payload.audioBlob = audioFile;
    } else if (isEditing && (initialData.audioUrl || initialData.audioBlob)) {
      payload.audioUrl = initialData.audioUrl || initialData.audioBlob;
      payload.audioBlob = initialData.audioBlob;
    } else {
      payload.audioBlob = null;
      payload.audioUrl = null;
    }

    try {
      setIsSubmitting(true);
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save song. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasExistingAudio = Boolean(initialData?.audioUrl || initialData?.audioBlob);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header with Back Arrow */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
          <button 
            type="button"
            onClick={onClose} 
            disabled={isSubmitting}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full transition-colors active:scale-95 disabled:opacity-50"
            title={t.back}
          >
            <ArrowLeft size={22} />
          </button>
          <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 truncate">
            {isEditing ? t.editSongTitle : t.addNewSong}
          </h3>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.songTitle} *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={handleTitleChange}
              placeholder="ఉదా: అందమైన యేసయ్య"
              className="w-full px-4 py-2.5 sm:py-3 border border-slate-300 rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.startingLetter}
            </label>
            <select
              value={startingLetter}
              onChange={(e) => setStartingLetter(e.target.value)}
              className="w-full px-4 py-2.5 sm:py-3 border border-slate-300 rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none text-base"
            >
              {ALL_TELUGU_LETTERS.map((char) => (
                <option key={char} value={char}>{char}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.singerOptional}
            </label>
            <input
              type="text"
              value={singer}
              onChange={(e) => setSinger(e.target.value)}
              placeholder="Brotheren Fellowship"
              className="w-full px-4 py-2.5 sm:py-3 border border-slate-300 rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.audioUpload}
            </label>
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center hover:border-blue-500 transition-colors">
              <input 
                type="file" 
                accept="audio/*" 
                id="audio-file" 
                className="hidden" 
                onChange={handleFileChange} 
              />
              <label htmlFor="audio-file" className="cursor-pointer flex flex-col items-center gap-1.5">
                <Upload size={24} className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {audioFile 
                    ? audioFile.name 
                    : (isEditing && hasExistingAudio 
                        ? t.keepExistingAudio 
                        : t.chooseAudio)}
                </span>
                <span className="text-xs text-slate-400">{t.audioNote}</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.lyrics}
            </label>
            <textarea
              rows={6}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder={t.lyricsPlaceholder}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none text-base leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-medium rounded-xl shadow-md transition-colors flex items-center gap-2 active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check size={18} /> {isEditing ? t.saveChanges : t.save}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}