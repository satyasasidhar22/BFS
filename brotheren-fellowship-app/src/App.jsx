import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Heart, Search, PlusCircle, Settings, Play, Music, Download, Upload, Trash2, 
  BookOpen, Globe, ArrowLeft, Edit3
} from 'lucide-react';
import { 
  TELUGU_VOWELS, 
  TELUGU_CONSONANTS, 
  getAllSongs, 
  addSong, 
  updateSong,
  toggleLikeSong, 
  deleteSong, 
  clearAllSongs,
  exportDataAsJSON,
  importDataFromJSON 
} from './db/indexedDB';
import { translations } from './utils/translations';
import { useWakeLock } from './hooks/useWakeLock';
import AudioPlayer from './components/AudioPlayer';
import SongDetailsModal from './components/SongDetailsModal';
import SongFormModal from './components/SongFormModal';

export default function App() {
  const [songs, setSongs] = useState([]);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [activeSong, setActiveSong] = useState(null);
  const [detailSong, setDetailSong] = useState(null);
  
  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [songToEdit, setSongToEdit] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const [lang, setLang] = useState(() => localStorage.getItem('app_lang') || 'te');
  const fileInputRef = useRef(null);

  const t = translations[lang] || translations.te;
  const { requestWakeLock, releaseWakeLock } = useWakeLock();

  const handleLanguageChange = (newLang) => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  const reloadSongs = async () => {
    const list = await getAllSongs();
    setSongs(list);
  };

  useEffect(() => {
    reloadSongs();
  }, []);

  const isFiltered = Boolean(selectedLetter || showLikedOnly || searchQuery.trim());

  const resetFilters = () => {
    setSelectedLetter(null);
    setShowLikedOnly(false);
    setSearchQuery('');
  };

  const filteredSongs = useMemo(() => {
    let result = songs;

    if (showLikedOnly) {
      result = result.filter(s => s.liked);
    } else if (selectedLetter) {
      result = result.filter(s => s.startingLetter === selectedLetter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(s => 
        s.title.toLowerCase().includes(q) || 
        (s.lyrics && s.lyrics.toLowerCase().includes(q))
      );
    }

    return result;
  }, [songs, showLikedOnly, selectedLetter, searchQuery]);

  // Audio Player Next / Prev
  const handleNextSong = () => {
    if (!activeSong || filteredSongs.length === 0) return;
    const currentIndex = filteredSongs.findIndex(s => s.id === activeSong.id);
    if (currentIndex !== -1 && currentIndex < filteredSongs.length - 1) {
      setActiveSong(filteredSongs[currentIndex + 1]);
    }
  };

  const handlePrevSong = () => {
    if (!activeSong || filteredSongs.length === 0) return;
    const currentIndex = filteredSongs.findIndex(s => s.id === activeSong.id);
    if (currentIndex > 0) {
      setActiveSong(filteredSongs[currentIndex - 1]);
    }
  };

  // Like Toggle
  const handleToggleLike = async (id) => {
    await toggleLikeSong(id);
    await reloadSongs();
    if (detailSong && detailSong.id === id) {
      setDetailSong(prev => ({ ...prev, liked: !prev.liked }));
    }
  };

  // Save / Update Song
  const handleSaveSong = async (formData) => {
    if (songToEdit) {
      await updateSong(songToEdit.id, formData);
      setSongToEdit(null);
    } else {
      await addSong(formData);
    }
    await reloadSongs();
  };

  // Open Edit Dialog
  const handleOpenEdit = (song) => {
    setDetailSong(null);
    setSongToEdit(song);
    setShowFormModal(true);
  };

  // Delete Song
  const handleDeleteSong = async (id) => {
    if (window.confirm(t.confirmDelete)) {
      await deleteSong(id);
      if (activeSong?.id === id) setActiveSong(null);
      if (detailSong?.id === id) setDetailSong(null);
      await reloadSongs();
    }
  };

  // Backup & Restore
  const handleExport = async () => {
    const jsonStr = await exportDataAsJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brotheren-songs-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        await importDataFromJSON(event.target.result);
        await reloadSongs();
        alert(t.importSuccess);
      } catch (err) {
        alert(t.importFailed + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = async () => {
    if (window.confirm(t.confirmClearAll)) {
      await clearAllSongs();
      setActiveSong(null);
      setDetailSong(null);
      await reloadSongs();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-blue-800 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2">
          
          {/* Back button or App Logo */}
          <div className="flex items-center gap-2 min-w-0">
            {isFiltered ? (
              <button
                onClick={resetFilters}
                className="p-1.5 hover:bg-blue-700 rounded-full transition-colors text-white active:scale-95 shrink-0"
                title={t.back}
              >
                <ArrowLeft size={22} />
              </button>
            ) : (
              <BookOpen className="text-amber-300 shrink-0" size={24} />
            )}
            <h1 className="text-base sm:text-xl font-bold tracking-tight truncate">
              {t.appName}
            </h1>
          </div>

          {/* Controls: Language Pill, Add, Settings */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Language Selector */}
            <div className="flex items-center bg-blue-900/70 border border-blue-700 rounded-lg p-0.5 text-xs font-semibold">
              <Globe size={13} className="ml-1 mr-0.5 text-blue-300 hidden md:inline" />
              {['te', 'en', 'hi'].map((code) => (
                <button
                  key={code}
                  onClick={() => handleLanguageChange(code)}
                  className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded transition-colors ${
                    lang === code ? 'bg-amber-400 text-blue-950 shadow-sm' : 'text-blue-200 hover:text-white'
                  }`}
                >
                  {code === 'te' ? 'తెలుగు' : code === 'en' ? 'Eng' : 'हिंदी'}
                </button>
              ))}
            </div>

            {/* Add Song */}
            <button 
              onClick={() => {
                setSongToEdit(null);
                setShowFormModal(true);
              }} 
              className="p-2 hover:bg-blue-700 rounded-full text-white active:scale-95 transition-transform" 
              title={t.addSong}
            >
              <PlusCircle size={22} />
            </button>

            {/* Settings */}
            <button 
              onClick={() => setShowSettings(!showSettings)} 
              className="p-2 hover:bg-blue-700 rounded-full text-white active:scale-95 transition-transform" 
              title={t.settings}
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-inner text-base"
            />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 pb-32 space-y-6">
        
        {/* Settings Drawer */}
        {showSettings && (
          <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Settings size={18} /> {t.dataManagement}
              </h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                {t.cancel}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button 
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
              >
                <Download size={16} /> {t.exportSongs}
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
              >
                <Upload size={16} /> {t.importSongs}
              </button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
              <button 
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 dark:bg-rose-950/40 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900"
              >
                <Trash2 size={16} /> {t.deleteAll}
              </button>
            </div>
          </div>
        )}

        {/* Quick Filter Navigation Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {isFiltered && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 rounded-xl text-sm font-semibold border border-blue-200 dark:border-slate-700 shrink-0 active:scale-95"
            >
              <ArrowLeft size={16} /> {t.showAll}
            </button>
          )}

          <button
            onClick={() => {
              setShowLikedOnly(!showLikedOnly);
              setSelectedLetter(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm shrink-0 ${
              showLikedOnly 
                ? 'bg-rose-600 text-white' 
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Heart size={16} className={showLikedOnly ? 'fill-white' : 'text-rose-500'} />
            {t.likedSongs} ({songs.filter(s => s.liked).length})
          </button>
        </div>

        {/* Responsive Alphabet Grid */}
        {!showLikedOnly && (
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            <h2 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              {t.alphabetTitle}
            </h2>

            {/* Vowels */}
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 gap-1.5 sm:gap-2">
              {TELUGU_VOWELS.map((letter) => (
                <button
                  key={letter}
                  onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
                  className={`h-11 sm:h-12 rounded-xl text-lg sm:text-xl font-bold flex items-center justify-center transition-all ${
                    selectedLetter === letter
                      ? 'bg-blue-700 text-white shadow-md scale-105'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>

            {/* Consonants */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 gap-1.5 sm:gap-2">
              {TELUGU_CONSONANTS.map((letter) => (
                <button
                  key={letter}
                  onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
                  className={`h-11 sm:h-12 rounded-xl text-base sm:text-lg font-bold flex items-center justify-center transition-all ${
                    selectedLetter === letter
                      ? 'bg-blue-700 text-white shadow-md scale-105'
                      : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section Title */}
        <div className="flex items-center justify-between text-sm sm:text-base font-medium text-slate-600 dark:text-slate-400 px-1">
          <span>
            {showLikedOnly 
              ? t.likedSongs 
              : selectedLetter 
                ? t.songsStartingWith.replace('{letter}', selectedLetter)
                : t.allSongs} ({filteredSongs.length})
          </span>
        </div>

        {/* Responsive Grid for Songs: 1-col on mobile, 2-col on tablet, 3-col on desktop */}
        {filteredSongs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredSongs.map((song) => (
              <div
                key={song.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm hover:border-blue-400 transition-all hover:shadow"
              >
                <div 
                  className="flex-1 cursor-pointer truncate"
                  onClick={() => setDetailSong(song)}
                >
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 truncate">
                    🎵 {song.title}
                  </h3>
                  {song.singer && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{song.singer}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {/* Quick Edit */}
                  <button
                    onClick={() => handleOpenEdit(song)}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 active:scale-90"
                    title={t.edit}
                  >
                    <Edit3 size={17} />
                  </button>

                  {/* Like Button */}
                  <button
                    onClick={() => handleToggleLike(song.id)}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90"
                    aria-label="Like"
                  >
                    <Heart
                      size={19}
                      className={song.liked ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}
                    />
                  </button>

                  {/* Play Button */}
                  <button
                    onClick={() => setActiveSong(song)}
                    className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-full active:scale-95"
                    aria-label="Play"
                  >
                    <Play size={18} className="fill-current ml-0.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
            <Music size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">{t.noSongs}</p>
            <p className="text-xs text-slate-400 mt-1">{t.addHint}</p>
          </div>
        )}
      </main>

      {/* Add / Edit Modal */}
      {showFormModal && (
        <SongFormModal 
          initialData={songToEdit}
          onClose={() => {
            setShowFormModal(false);
            setSongToEdit(null);
          }} 
          onSave={handleSaveSong}
          t={t}
        />
      )}

      {/* Song Details Modal */}
      {detailSong && (
        <SongDetailsModal
          song={detailSong}
          onClose={() => setDetailSong(null)}
          onPlay={(s) => setActiveSong(s)}
          onToggleLike={handleToggleLike}
          onEdit={handleOpenEdit}
          onDelete={handleDeleteSong}
          t={t}
        />
      )}

      {/* Persistent Audio Player */}
      <AudioPlayer
        currentSong={activeSong}
        onNext={handleNextSong}
        onPrev={handlePrevSong}
        onClose={() => setActiveSong(null)}
        requestWakeLock={requestWakeLock}
        releaseWakeLock={releaseWakeLock}
      />
    </div>
  );
}