import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const indexPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

function replaceOnce(content, oldStr, newStr, label) {
  if (!content.includes(oldStr)) throw new Error(`Missing block: ${label}`);
  return content.replace(oldStr, newStr);
}

html = replaceOnce(
  html,
  `      gameState.turn = me.turn || gameState.turn;`,
  `      gameState.turn = me.turn != null ? me.turn : gameState.turn;`,
  'syncLocalPlayerFromRoom turn'
);

html = replaceOnce(
  html,
  `      const waiting = !!me?.trainingComplete && multiplayer.room?.phase === 'training';
      el.classList.toggle('hidden', !waiting);
      if (waiting) setTrainButtonsEnabled(false);
    }`,
  `      const waiting = !!me?.trainingComplete && multiplayer.room?.phase === 'training';
      el.classList.toggle('hidden', !waiting);
      if (waiting) {
        setTrainButtonsEnabled(false);
      } else if (!trainingModalActive) {
        setTrainButtonsEnabled(!me?.trainingComplete);
      }
    }`,
  'updateTrainingWaitStatus re-enable'
);

html = replaceOnce(
  html,
  `    function enterTrainingScreen() {
      gameState.phase = 'training';
      showScreen('training-screen');
      updateTrackUI();
      updateTrainingUI();
      drawPortrait();
      renderTrainingRivals();
      updateTrainingWaitStatus();
      setTrainButtonsEnabled(!getLocalRoomPlayer()?.trainingComplete);
      playTrainingBgm();
      stopResultsBgm();
    }`,
  `    function enterTrainingScreen() {
      if (isMultiplayer()) {
        syncTrackIndexFromRoom();
        syncLocalPlayerFromRoom();
        gameState.bonusOffered = false;
        gameState.bonusDoneThisTurn = false;
        gameState.bonusType = null;
        gameState.skillChoices = [];
        gameState.skillPickPending = false;
        gameState.skillPickSource = null;
      }
      gameState.phase = 'training';
      showScreen('training-screen');
      updateTrackUI();
      renderStats();
      updateTrainingUI();
      drawPortrait();
      renderTrainingRivals();
      updateTrainingWaitStatus();
      if (!trainingModalActive) {
        setTrainButtonsEnabled(!getLocalRoomPlayer()?.trainingComplete);
      }
      playTrainingBgm();
      stopResultsBgm();
    }`,
  'enterTrainingScreen sync'
);

html = replaceOnce(
  html,
  `      socket.on('room:updated', (room) => {
        multiplayer.room = { ...multiplayer.room, ...room };
        if (room.trackIndex != null) gameState.trackIndex = room.trackIndex;
        const me = room.players?.find((p) => p.id === multiplayer.playerId);
        if (me) multiplayer.localReady = !!me.ready;
        if (gameState.phase === 'lobby') renderLobby();
        if (gameState.phase === 'results') updateResultsContinueButton();
        if (gameState.phase === 'training') {
          syncLocalPlayerFromRoom();
          renderTrainingRivals();
          updateTrainingWaitStatus();
        }
        if (gameState.phase === 'lineup' && room.field?.length) {
          buildMultiplayerLineup();
          renderLineupGrid();
          updateLineupStartButton();
        }
      });`,
  `      socket.on('room:updated', (room) => {
        multiplayer.room = { ...multiplayer.room, ...room };
        if (room.trackIndex != null) gameState.trackIndex = room.trackIndex;
        const me = room.players?.find((p) => p.id === multiplayer.playerId);
        if (me) multiplayer.localReady = !!me.ready;
        if (gameState.phase === 'lobby') renderLobby();
        if (gameState.phase === 'results') updateResultsContinueButton();
        if (room.phase === 'training' && gameState.phase === 'results') {
          syncLocalPlayerFromRoom();
          enterTrainingScreen();
          return;
        }
        if (gameState.phase === 'training') {
          syncLocalPlayerFromRoom();
          renderStats();
          updateTrainingUI();
          renderTrainingRivals();
          updateTrainingWaitStatus();
          if (!trainingModalActive) {
            setTrainButtonsEnabled(!getLocalRoomPlayer()?.trainingComplete);
          }
        }
        if (gameState.phase === 'lineup' && room.field?.length) {
          buildMultiplayerLineup();
          renderLineupGrid();
          updateLineupStartButton();
        }
      });`,
  'room:updated training sync'
);

html = replaceOnce(
  html,
  `          multiplayer.socket.emit('host:start-next-training', {}, (res) => {
            if (!res?.ok) return;
            if (res.trackIndex != null) gameState.trackIndex = res.trackIndex;
          });`,
  `          multiplayer.socket.emit('host:start-next-training', {}, (res) => {
            if (!res?.ok) {
              const text = document.getElementById('result-text');
              if (text) text.innerHTML += \`<br><br>\${res?.error || 'Could not continue'}\`;
              return;
            }
            if (res.room) multiplayer.room = { ...multiplayer.room, ...res.room };
            if (res.trackIndex != null) gameState.trackIndex = res.trackIndex;
            if (gameState.phase === 'results') {
              syncLocalPlayerFromRoom();
              enterTrainingScreen();
            }
          });`,
  'restart-btn start-next-training ack'
);

fs.writeFileSync(indexPath, html);
console.log('Applied multiplayer round-2 fixes to index.html');