import { openDB } from 'idb';

const DB_NAME = 'brotheren_fellowship_db';
const DB_VERSION = 2;

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains('songs')) {
        const songStore = db.createObjectStore('songs', { keyPath: 'id' });
        songStore.createIndex('title', 'title', { unique: false });
        songStore.createIndex('startingLetter', 'startingLetter', { unique: false });
        songStore.createIndex('liked', 'liked', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });
}

// Telugu character detection utility
export const TELUGU_VOWELS = [
  'అ', 'ఆ', 'ఇ', 'ఈ', 'ఉ', 'ఊ', 'ఋ', 'ఎ', 'ఏ', 'ఐ', 'ఒ', 'ఓ', 'ఔ', 'అం', 'అః'
];

export const TELUGU_CONSONANTS = [
  'క', 'ఖ', 'గ', 'ఘ', 'ఙ',
  'చ', 'ఛ', 'జ', 'ఝ', 'ఞ',
  'ట', 'ఠ', 'డ', 'ఢ', 'ణ',
  'త', 'థ', 'ద', 'ధ', 'న',
  'ప', 'ఫ', 'బ', 'భ', 'మ',
  'య', 'ర', 'ల', 'వ',
  'శ', 'ష', 'స', 'హ',
  'ళ', 'క్ష', 'ఱ'
];

export const ALL_TELUGU_LETTERS = [...TELUGU_VOWELS, ...TELUGU_CONSONANTS];

export function extractStartingTeluguLetter(title = '') {
  const trimmed = title.trim();
  if (!trimmed) return 'అ';

  if (trimmed.startsWith('క్ష')) return 'క్ష';
  if (trimmed.startsWith('అం')) return 'అం';
  if (trimmed.startsWith('అః')) return 'అః';

  const firstChar = trimmed[0];
  const matched = ALL_TELUGU_LETTERS.find((letter) => letter === firstChar);
  return matched || firstChar;
}

// Offline Caching Bridge
export async function saveSongsOfflineCache(songs) {
  if (!Array.isArray(songs)) return;
  const db = await initDB();
  const tx = db.transaction('songs', 'readwrite');
  await tx.store.clear();
  for (const song of songs) {
    await tx.store.put(song);
  }
  await tx.done;
}

export async function getOfflineSongsCache() {
  try {
    const db = await initDB();
    return await db.getAll('songs');
  } catch (err) {
    console.error('Error reading offline cache:', err);
    return [];
  }
}

// Database Operations
export async function getAllSongs() {
  const db = await initDB();
  return await db.getAll('songs');
}

export async function getSongById(id) {
  const db = await initDB();
  return await db.get('songs', id);
}

export async function addSong(songData) {
  const db = await initDB();
  const letter = songData.startingLetter || extractStartingTeluguLetter(songData.title);
  const record = {
    ...songData,
    startingLetter: letter,
    liked: !!songData.liked,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return await db.put('songs', record);
}

export async function updateSong(id, changes) {
  const db = await initDB();
  const existing = await db.get('songs', id);
  if (!existing) throw new Error("Song not found");
  const updated = {
    ...existing,
    ...changes,
    updatedAt: new Date().toISOString()
  };
  await db.put('songs', updated);
  return updated;
}

export async function toggleLikeSong(id) {
  const db = await initDB();
  const song = await db.get('songs', id);
  if (song) {
    song.liked = !song.liked;
    song.updatedAt = new Date().toISOString();
    await db.put('songs', song);
    return song.liked;
  }
  return false;
}

export async function deleteSong(id) {
  const db = await initDB();
  return await db.delete('songs', id);
}

export async function clearAllSongs() {
  const db = await initDB();
  return await db.clear('songs');
}

// Export / Import Helpers
export async function exportDataAsJSON() {
  const db = await initDB();
  const songs = await db.getAll('songs');
  return JSON.stringify(songs, null, 2);
}

export async function importDataFromJSON(jsonString) {
  const db = await initDB();
  const parsedSongs = JSON.parse(jsonString);
  const tx = db.transaction('songs', 'readwrite');
  for (const item of parsedSongs) {
    await tx.store.put({
      ...item,
      updatedAt: new Date().toISOString()
    });
  }
  await tx.done;
}