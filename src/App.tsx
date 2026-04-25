import { useState } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { DialogueBox } from './components/DialogueBox';
import { HUD } from './components/HUD';
import { TitleScreen } from './components/TitleScreen';
import { QuestPanel } from './components/QuestPanel';
import { EventBus } from './game/EventBus';

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);

  const handleStart = () => {
    setGameStarted(true);
    // The user has interacted with the page — the audio context is now unlocked.
    // Tell Phaser to start the BGM.
    EventBus.emit('start-bgm');
  };

  return (
    <>
      {/* Phaser game mounts immediately so assets start loading in the background.
          The TitleScreen overlays it until the user presses a key. */}
      <PhaserGame />

      {/* Game-only UI — only show after title screen is dismissed */}
      {gameStarted && (
        <>
          <HUD />
          <QuestPanel />
          <DialogueBox />
        </>
      )}

      {/* Title screen on top until dismissed */}
      {!gameStarted && <TitleScreen onStart={handleStart} />}
    </>
  );
}
