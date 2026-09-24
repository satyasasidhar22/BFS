import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { getAllSongs, addSong } from './db/indexedDB';

// Seed sample Christian Telugu songs on first launch if empty
async function seedInitialData() {
  const songs = await getAllSongs();
  if (songs.length === 0) {
    const samples = [
      {
        title: "అందమైన యేసయ్య",
        startingLetter: "అ",
        singer: "బ్రదరన్ ఫెలోషిప్",
        lyrics: "అందమైన యేసయ్య - నీ ప్రేమే చాలయ్యా\nజీవిత కాలమంతా - నిన్నే కీర్తింతును\n\n1. పాపినైన నన్ను చూచి - ప్రాణమిచ్చినావు\nనీతిమంతునిగా చేసి - జీవమిచ్చినావు",
        liked: true
      },
      {
        title: "ఆనంద గీతం పాడెదము",
        startingLetter: "ఆ",
        singer: "బ్రదరన్ ఫెలోషిప్",
        lyrics: "ఆనంద గీతం పాడెదము - రక్షకునికి జయ గీతం\nఆశ్చర్యకరుడు ఆలోచనకర్త - మన ప్రభువు యేసుకే",
        liked: false
      },
      {
        title: "యేసు నామము అతి మధురము",
        startingLetter: "య",
        singer: "బ్రదరన్ ఫెలోషిప్",
        lyrics: "యేసు నామము అతి మధురము - పావన నామము శక్తి గలది\nఎల్ల వేళలా స్తుతింపదగినది - యేసయ్య దివ్య నామము",
        liked: true
      }
    ];
    for (const item of samples) {
      await addSong(item);
    }
  }
}

seedInitialData().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});