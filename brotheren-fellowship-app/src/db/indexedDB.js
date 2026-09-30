import { openDB } from 'idb';

const DB_NAME = 'brotheren_fellowship_db';
const DB_VERSION = 4; // Bumped version

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
      if (!db.objectStoreNames.contains('audioFiles')) {
        db.createObjectStore('audioFiles', { keyPath: 'id' });
      }
    },
  });
}

// Telugu characters
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

// Safe string ID key normalization
const normalizeId = (id) => String(id);

// --- Binary Audio Cache in IndexedDB ---
export async function saveAudioBlobToCache(songId, blob) {
  if (!songId || !blob) return false;
  try {
    const db = await initDB();
    await db.put('audioFiles', { 
      id: normalizeId(songId), 
      blob, 
      size: blob.size, 
      cachedAt: Date.now() 
    });
    return true;
  } catch (err) {
    console.error('Failed to cache audio in IndexedDB:', err);
    return false;
  }
}

export async function getCachedAudioBlob(songId) {
  if (!songId) return null;
  try {
    const db = await initDB();
    const record = await db.get('audioFiles', normalizeId(songId));
    return record?.blob || null;
  } catch (err) {
    console.error('Failed to get cached audio blob:', err);
    return null;
  }
}

export async function getAllCachedAudioIds() {
  try {
    const db = await initDB();
    const keys = await db.getAllKeys('audioFiles');
    return new Set(keys.map(String));
  } catch (err) {
    return new Set();
  }
}

export async function removeAudioBlobFromCache(songId) {
  try {
    const db = await initDB();
    await db.delete('audioFiles', normalizeId(songId));
  } catch (err) {}
}

// --- Songs Metadata Cache ---
export async function saveSongsOfflineCache(songs) {
  if (!Array.isArray(songs)) return;
  const db = await initDB();
  const tx = db.transaction('songs', 'readwrite');
  await tx.store.clear();
  for (const song of songs) {
    await tx.store.put({
      ...song,
      id: normalizeId(song.id)
    });
  }
  await tx.done;
}

export async function getOfflineSongsCache() {
  try {
    const db = await initDB();
    return await db.getAll('songs');
  } catch (err) {
    return [];
  }
}

export async function deleteSong(id) {
  const db = await initDB();
  await db.delete('audioFiles', normalizeId(id));
  return await db.delete('songs', normalizeId(id));
}

export async function clearAllSongs() {
  const db = await initDB();
  await db.clear('audioFiles');
  return await db.clear('songs');
}