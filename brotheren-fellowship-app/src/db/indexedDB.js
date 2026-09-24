import { openDB } from 'idb';

const DB_NAME = 'brotheren_fellowship_db';
const DB_VERSION = 1;

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('songs')) {
        const songStore = db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
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
  
  // Check for multi-char special letters like క్ష, అం, అః
  if (trimmed.startsWith('క్ష')) return 'క్ష';
  if (trimmed.startsWith('అం')) return 'అం';
  if (trimmed.startsWith('అః')) return 'అః';

  const firstChar = trimmed[0];
  const matched = ALL_TELUGU_LETTERS.find((letter) => letter === firstChar);
  return matched || firstChar;
}

// Database Operations
export async function getAllSongs() {
  const db = await initDB();
  return await db.getAll('songs');
}

export async function getSongById(id) {
  const db = await initDB();
  return await db.get('songs', Number(id));
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
  return await db.add('songs', record);
}

export async function updateSong(id, changes) {
  const db = await initDB();
  const existing = await db.get('songs', Number(id));
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
  const song = await db.get('songs', Number(id));
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
  return await db.delete('songs', Number(id));
}

export async function clearAllSongs() {
  const db = await initDB();
  return await db.clear('songs');
}

// Export / Import Helpers
export async function exportDataAsJSON() {
  const db = await initDB();
  const songs = await db.getAll('songs');
  
  // Convert Blob audio into base64 strings for portable JSON export
  const serializedSongs = await Promise.all(
    songs.map(async (song) => {
      let audioBase64 = null;
      if (song.audioBlob) {
        audioBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(song.audioBlob);
        });
      }
      return {
        ...song,
        audioBlob: audioBase64
      };
    })
  );

  return JSON.stringify(serializedSongs, null, 2);
}

export async function importDataFromJSON(jsonString) {
  const db = await initDB();
  const parsedSongs = JSON.parse(jsonString);
  const tx = db.transaction('songs', 'readwrite');

  for (const item of parsedSongs) {
    let blob = null;
    if (item.audioBlob && typeof item.audioBlob === 'string' && item.audioBlob.startsWith('data:')) {
      const res = await fetch(item.audioBlob);
      blob = await res.blob();
    }
    delete item.id; // Allow fresh autoincrement ID
    await tx.store.add({
      ...item,
      audioBlob: blob,
      updatedAt: new Date().toISOString()
    });
  }
  await tx.done;
}