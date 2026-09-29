import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Heart, Search, PlusCircle, Settings, Play, Music, Download, Upload, Trash2, 
  BookOpen, Globe, ArrowLeft, Edit3, WifiOff
} from 'lucide-react';
import { 
  TELUGU_VOWELS, 
  TELUGU_CONSONANTS, 
  saveSongsOfflineCache, 
  getOfflineSongsCache 
} from './db/indexedDB';
import { supabase } from './supabaseClient';
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
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

  // Online / Offline monitor
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      reloadSongs();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch songs with automatic offline IndexedDB fallback
  const reloadSongs = async () => {
    if (!navigator.onLine) {
      const cached = await getOfflineSongsCache();
      if (cached && cached.length > 0) setSongs(cached);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;

      if (data) {
        const normalizedSongs = data.map(item => ({
          id: item.id,
          title: item.title,
          startingLetter: item.starting_letter,
          lyrics: item.lyrics,
          singer: item.singer,
          audioBlob: item.audio_url,
          audioUrl: item.audio_url,
          liked: item.liked || false
        }));

        setSongs(normalizedSongs);
        await saveSongsOfflineCache(normalizedSongs);
      }
    } catch (err) {
      console.warn('Network issue or Supabase fetch failed. Falling back to local offline cache:', err);
      const cached = await getOfflineSongsCache();
      if (cached && cached.length > 0) setSongs(cached);
    }
  };

  // Real-time synchronization when online
  useEffect(() => {
    reloadSongs();

    if (!navigator.onLine) return;

    const channel = supabase
      .channel('realtime_songs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'songs' },
        () => {
          reloadSongs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Check if viewing a letter subpage, search results, or liked list
  const isViewingSubpage = Boolean(selectedLetter || showLikedOnly || searchQuery.trim());

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
      const next = filteredSongs[currentIndex + 1];
      setActiveSong(next);
      if (detailSong) setDetailSong(next);
    }
  };

  const handlePrevSong = () => {
    if (!activeSong || filteredSongs.length === 0) return;
    const currentIndex = filteredSongs.findIndex(s => s.id === activeSong.id);
    if (currentIndex > 0) {
      const prev = filteredSongs[currentIndex - 1];
      setActiveSong(prev);
      if (detailSong) setDetailSong(prev);
    }
  };

  // Click Song Card: ONLY open lyrics modal / view
  const handleSelectSong = (song) => {
    setDetailSong(song);
  };

  // Click Play Button: Explicitly starts audio playback
  const handlePlaySong = (e, song) => {
    e.stopPropagation();
    setActiveSong(song);
  };

  // Like Toggle in Cloud & Local Cache
  const handleToggleLike = async (id) => {
    const target = songs.find(s => s.id === id);
    if (!target) return;
    const newLikedStatus = !target.liked;

    const updatedSongs = songs.map(s => s.id === id ? { ...s, liked: newLikedStatus } : s);
    setSongs(updatedSongs);
    await saveSongsOfflineCache(updatedSongs);

    if (detailSong && detailSong.id === id) {
      setDetailSong(prev => ({ ...prev, liked: newLikedStatus }));
    }

    if (navigator.onLine) {
      await supabase
        .from('songs')
        .update({ liked: newLikedStatus })
        .eq('id', id);
    }
  };

  // Helper: Upload Audio file to Supabase Storage
  const uploadAudioFile = async (file) => {
    if (!file) return null;
    const fileExt = file.name ? file.name.split('.').pop() : 'mp3';
    const cleanName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `audio/${cleanName}`;

    const { error: uploadError } = await supabase.storage
      .from('songs')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error('Audio upload error:', uploadError);
      return null;
    }

    const { data } = supabase.storage.from('songs').getPublicUrl(filePath);
    return data.publicUrl;
  };

  // Save / Update Song
  const handleSaveSong = async (formData) => {
    if (!navigator.onLine) {
      alert('Adding/Editing songs requires an active internet connection to sync with all members.');
      return;
    }

    let finalAudioUrl = formData.audioUrl || null;

    if (formData.audioBlob instanceof Blob || formData.audioBlob instanceof File) {
      const uploadedUrl = await uploadAudioFile(formData.audioBlob);
      if (uploadedUrl) finalAudioUrl = uploadedUrl;
    }

    const startingLetter = formData.startingLetter || 
      (formData.title ? formData.title.trim().charAt(0) : 'అ');

    if (songToEdit) {
      await supabase
        .from('songs')
        .update({
          title: formData.title,
          starting_letter: startingLetter,
          lyrics: formData.lyrics || '',
          singer: formData.singer || '',
          audio_url: finalAudioUrl
        })
        .eq('id', songToEdit.id);
      setSongToEdit(null);
    } else {
      await supabase
        .from('songs')
        .insert([{
          title: formData.title,
          starting_letter: startingLetter,
          lyrics: formData.lyrics || '',
          singer: formData.singer || '',
          audio_url: finalAudioUrl,
          liked: false
        }]);
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
    if (!navigator.onLine) {
      alert('Deleting songs requires an active internet connection.');
      return;
    }

    if (window.confirm(t.confirmDelete)) {
      await supabase.from('songs').delete().eq('id', id);
      if (activeSong?.id === id) setActiveSong(null);
      if (detailSong?.id === id) setDetailSong(null);
      await reloadSongs();
    }
  };

  // Backup & Restore
  const handleExport = () => {
    const jsonStr = JSON.stringify(songs, null, 2);
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
        const importedSongs = JSON.parse(event.target.result);
        if (Array.isArray(importedSongs)) {
          const rows = importedSongs.map(s => {
            const letter = s.startingLetter || s.starting_letter || (s.title ? s.title.trim().charAt(0) : 'అ');
            return {
              title: s.title || 'Untitled',
              starting_letter: letter,
              lyrics: s.lyrics || '',
              singer: s.singer || '',
              audio_url: s.audioUrl || s.audio_url || null,
              liked: s.liked || false
            };
          });

          const { error } = await supabase.from('songs').insert(rows);
          if (error) throw error;

          await reloadSongs();
          alert(t.importSuccess || 'Songs imported successfully!');
        }
      } catch (err) {
        alert((t.importFailed || 'Import failed: ') + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearAll = async () => {
    if (!navigator.onLine) {
      alert('Network needed to delete songs.');
      return;
    }
    if (window.confirm(t.confirmClearAll)) {
      await supabase.from('songs').delete().neq('id', 0);
      setActiveSong(null);
      setDetailSong(null);
      await reloadSongs();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 text-xs font-bold py-1 px-4 text-center flex items-center justify-center gap-1.5 shadow-sm">
          <WifiOff size={14} /> ఆఫ్‌లైన్ మోడ్ (Offline Mode - Local songs loaded)
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-blue-900 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2">
          
          {/* Back button or App Logo */}
          <div className="flex items-center gap-2 min-w-0">
            {isViewingSubpage ? (
              <button
                onClick={resetFilters}
                className="p-1.5 hover:bg-blue-800 rounded-full transition-colors text-white active:scale-95 shrink-0"
                title={t.back}
              >
                <ArrowLeft size={22} />
              </button>
            ) : (
              <BookOpen className="text-amber-300 shrink-0" size={24} />
            )}
            <h1 className="text-base sm:text-xl font-bold tracking-tight truncate">
              {isViewingSubpage && selectedLetter 
                ? `${t.songsStartingWith.replace('{letter}', selectedLetter)} (${filteredSongs.length})` 
                : t.appName}
            </h1>
          </div>

          {/* Controls: Language Pill, Add, Settings */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Language Selector */}
            <div className="flex items-center bg-blue-950/70 border border-blue-700 rounded-lg p-0.5 text-xs font-semibold">
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
              className="p-2 hover:bg-blue-800 rounded-full text-white active:scale-95 transition-transform" 
              title={t.addSong}
            >
              <PlusCircle size={22} />
            </button>

            {/* Settings */}
            <button 
              onClick={() => setShowSettings(!showSettings)} 
              className="p-2 hover:bg-blue-800 rounded-full text-white active:scale-95 transition-transform" 
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
              className="w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-xl bg-slate-900 text-white placeholder-slate-400 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300 text-base"
            />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 pb-36 space-y-5">
        
        {/* Settings Drawer */}
        {showSettings && (
          <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2 text-white">
                <Settings size={18} /> {t.dataManagement}
              </h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                {t.cancel}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button 
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl"
              >
                <Download size={16} /> {t.exportSongs}
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl"
              >
                <Upload size={16} /> {t.importSongs}
              </button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
              <button 
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/40 text-rose-300 rounded-xl hover:bg-rose-900"
              >
                <Trash2 size={16} /> {t.deleteAll}
              </button>
            </div>
          </div>
        )}

        {/* Quick Filter Navigation Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {isViewingSubpage && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-900/60 text-blue-200 rounded-xl text-sm font-semibold border border-blue-700 shrink-0 active:scale-95"
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
                : 'bg-slate-900 border border-slate-800 text-slate-300'
            }`}
          >
            <Heart size={16} className={showLikedOnly ? 'fill-white' : 'text-rose-500'} />
            {t.likedSongs} ({songs.filter(s => s.liked).length})
          </button>
        </div>

        {/* SCREEN 1: ALPHABET GRID */}
        {!isViewingSubpage && (
          <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-800 space-y-4">
            <h2 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              {t.alphabetTitle}
            </h2>

            {/* Telugu Vowels */}
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 gap-2">
              {TELUGU_VOWELS.map((letter) => (
                <button
                  key={letter}
                  onClick={() => setSelectedLetter(letter)}
                  className="h-12 rounded-xl text-xl font-bold flex items-center justify-center transition-all bg-slate-800/80 hover:bg-blue-600 text-slate-100 hover:text-white active:scale-95 border border-slate-700/50 hover:border-blue-500 shadow-sm"
                >
                  {letter}
                </button>
              ))}
            </div>

            {/* Telugu Consonants */}
            <div className="pt-3 border-t border-slate-800 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 gap-2">
              {TELUGU_CONSONANTS.map((letter) => (
                <button
                  key={letter}
                  onClick={() => setSelectedLetter(letter)}
                  className="h-12 rounded-xl text-lg font-bold flex items-center justify-center transition-all bg-slate-800/60 hover:bg-blue-600 text-slate-200 hover:text-white active:scale-95 border border-slate-700/50 hover:border-blue-500 shadow-sm"
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SCREEN 2: DEDICATED SONGS LIST */}
        {isViewingSubpage && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-base font-semibold text-slate-300 px-1">
              <span>
                {showLikedOnly 
                  ? `${t.likedSongs} (${filteredSongs.length})` 
                  : selectedLetter 
                    ? `${t.songsStartingWith.replace('{letter}', selectedLetter)} (${filteredSongs.length})`
                    : `Search Results (${filteredSongs.length})`}
              </span>
              <button 
                onClick={resetFilters} 
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                <ArrowLeft size={14} /> Back to Letters
              </button>
            </div>

            {filteredSongs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredSongs.map((song) => (
                  <div
                    key={song.id}
                    className="bg-slate-900 border border-slate-800 hover:border-blue-500 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm transition-all"
                  >
                    {/* Clicking song title: Opens lyrics screen ONLY (does not start playing audio) */}
                    <div 
                      className="flex-1 cursor-pointer truncate"
                      onClick={() => handleSelectSong(song)}
                    >
                      <h3 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                        🎵 {song.title}
                      </h3>
                      {song.singer && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{song.singer}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Edit */}
                      <button
                        onClick={() => handleOpenEdit(song)}
                        className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 active:scale-90"
                        title={t.edit}
                      >
                        <Edit3 size={17} />
                      </button>

                      {/* Like */}
                      <button
                        onClick={() => handleToggleLike(song.id)}
                        className="p-2 rounded-full hover:bg-slate-800 active:scale-90"
                        aria-label="Like"
                      >
                        <Heart
                          size={19}
                          className={song.liked ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}
                        />
                      </button>

                      {/* Explicit Play Button: Plays audio only when clicked */}
                      <button
                        onClick={(e) => handlePlaySong(e, song)}
                        className="p-2.5 bg-blue-950/70 text-blue-400 hover:bg-blue-900 hover:text-white rounded-full active:scale-95 border border-blue-800"
                        aria-label="Play"
                      >
                        <Play size={18} className="fill-current ml-0.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-slate-900 rounded-2xl border border-dashed border-slate-800 p-6">
                <Music size={40} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400 font-medium">{t.noSongs}</p>
                <p className="text-xs text-slate-500 mt-1">{t.addHint}</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* SCREEN 3: DEDICATED SONG VIEW (Lyrics) */}
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

      {/* Add / Edit Song Modal */}
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

      {/* Persistent Audio Player (Active only when a song is explicitly played) */}
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