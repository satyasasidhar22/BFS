import React, { useState } from 'react';
import { X, Upload, Check } from 'lucide-react';
import { ALL_TELUGU_LETTERS, extractStartingTeluguLetter } from '../db/indexedDB';

export default function AddSongModal({ onClose, onSave, t }) {
  const [title, setTitle] = useState('');
  const [startingLetter, setStartingLetter] = useState('అ');
  const [lyrics, setLyrics] = useState('');
  const [singer, setSinger] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [error, setError] = useState('');

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val);
    const detected = extractStartingTeluguLetter(val);
    if (detected) setStartingLetter(detected);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t.songTitle + ' is required.');
      return;
    }

    onSave({
      title: title.trim(),
      startingLetter,
      lyrics: lyrics.trim(),
      singer: singer.trim(),
      audioBlob: audioFile || null
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t.addNewSong}</h3>
          <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
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
              placeholder="e.g. అందమైన యేసయ్య"
              className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.startingLetter}
            </label>
            <select
              value={startingLetter}
              onChange={(e) => setStartingLetter(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
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
              className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
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
              <label htmlFor="audio-file" className="cursor-pointer flex flex-col items-center gap-1">
                <Upload size={24} className="text-slate-400" />
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {audioFile ? audioFile.name : t.chooseAudio}
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
              rows={5}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder={t.lyricsPlaceholder}
              className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-xl shadow transition-colors flex items-center gap-2"
            >
              <Check size={18} /> {t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}