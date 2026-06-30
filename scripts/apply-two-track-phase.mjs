import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(root, 'index.html');
let content = readFileSync(indexPath, 'utf8');

function replaceOnce(old, neu, label) {
  if (!content.includes(old)) throw new Error(`${label} not found`);
  content = content.replace(old, neu);
}

const em = '\u2014';

replaceOnce(
  '  <script src="racer-stats.js"></script>\n  <script>',
  '  <script src="racer-stats.js"></script>\n  <script src="tracks.js"></script>\n  <script>',
  'tracks script'
);

replaceOnce(
  `            <strong>STAMINA</strong> ${em} Need 15+ at 75% of lap or -80% speed<br>`,
  `            <span id="stamina-guide-line"><strong>STAMINA</strong> ${em} Need 15+ at 75% of lap or -80% speed<br></span>`,
  'stamina guide'
);

replaceOnce('    const STAMINA_REQUIREMENT = 15;\n    const LAP_LENGTH = 1000;', '    const LAP_LENGTH = 1000;', 'stamina const');

replaceOnce(
  `    function initGame() {\n      gameState = {\n        phase: 'splash',\n        turn: 1,`,
  `    function getCurrentTrack() {\n      const idx = gameState.trackIndex ?? multiplayer.room?.trackIndex ?? 0;\n      return getTrack(idx);\n    }\n\n    function getStaminaRequirement() {\n      return getCurrentTrack().staminaRequirement;\n    }\n\n    function hasMoreTracks() {\n      const idx = gameState.trackIndex ?? multiplayer.room?.trackIndex ?? 0;\n      return idx < getTrackCount() - 1;\n    }\n\n    function syncTrackIndexFromRoom() {\n      if (multiplayer.room?.trackIndex != null) {\n        gameState.trackIndex = multiplayer.room.trackIndex;\n      }\n    }\n\n    function updateTrackUI() {\n      const track = getCurrentTrack();\n      const subtitle = document.getElementById('game-subtitle');\n      if (subtitle) subtitle.textContent = track.subtitle;\n      const staminaGuide = document.getElementById('stamina-guide-line');\n      if (staminaGuide) {\n        staminaGuide.innerHTML = \`<strong>STAMINA</strong> ${em} Need \${track.staminaRequirement}+ at 75% of lap or -80% speed<br>\`;\n      }\n    }\n\n    function initGame() {\n      gameState = {\n        phase: 'splash',\n        trackIndex: 0,\n        turn: 1,`,
  'initGame'
);

replaceOnce(
  `      if (phase === 'training') {\n        startTraining();\n        return;\n      }`,
  `      if (phase === 'training') {\n        syncTrackIndexFromRoom();\n        if ((gameState.trackIndex || 0) > 0) {\n          enterTrainingScreen();\n        } else {\n          startTraining();\n        }\n        return;\n      }`,
  'reconnect training'
);

replaceOnce(
  `      socket.on('room:updated', (room) => {\n        multiplayer.room = { ...multiplayer.room, ...room };\n        const me = room.players?.find((p) => p.id === multiplayer.playerId);\n        if (me) multiplayer.localReady = !!me.ready;\n        if (gameState.phase === 'lobby') renderLobby();`,
  `      socket.on('room:updated', (room) => {\n        multiplayer.room = { ...multiplayer.room, ...room };\n        if (room.trackIndex != null) gameState.trackIndex = room.trackIndex;\n        const me = room.players?.find((p) => p.id === multiplayer.playerId);\n        if (me) multiplayer.localReady = !!me.ready;\n        if (gameState.phase === 'lobby') renderLobby();\n        if (gameState.phase === 'results') updateResultsContinueButton();`,
  'room updated'
);

replaceOnce(
  `      socket.on('room:phase', ({ phase }) => {\n        if (phase === 'training' && (gameState.phase === 'lobby' || gameState.phase === 'setup')) {\n          startTraining();\n          return;\n        }\n        if (phase === 'lineup' && (gameState.phase === 'training' || gameState.phase === 'lobby')) {\n          showLineupScreen();\n        }\n      });`,
  `      socket.on('room:phase', ({ phase, trackIndex }) => {\n        if (trackIndex != null) gameState.trackIndex = trackIndex;\n        if (phase === 'training' && gameState.phase === 'results') {\n          syncLocalPlayerFromRoom();\n          enterTrainingScreen();\n          return;\n        }\n        if (phase === 'training' && (gameState.phase === 'lobby' || gameState.phase === 'setup')) {\n          gameState.trackIndex = 0;\n          startTraining();\n          return;\n        }\n        if (phase === 'lineup' && (gameState.phase === 'training' || gameState.phase === 'lobby')) {\n          showLineupScreen();\n        }\n      });`,
  'room phase'
);

replaceOnce(
  `    function startTraining() {\n      gameState.phase = 'training';\n      if (isMultiplayer()) {\n        syncLocalPlayerFromRoom();\n      } else {\n        gameState.turn = 1;\n        gameState.player.name = readRacerNameFromInput();\n        gameState.player.stats = getStartingStatsForRacer(selectedRacerId);\n        gameState.player.raceSkill = null;\n        gameState.bonusOffered = false;\n        gameState.bonusDoneThisTurn = false;\n        gameState.player.racerId = selectedRacerId;\n        applySelectedRacer(selectedRacerId);\n      }\n      showScreen('training-screen');\n      updateTrainingUI();\n      drawPortrait();\n      renderTrainingRivals();\n      updateTrainingWaitStatus();\n      setTrainButtonsEnabled(!getLocalRoomPlayer()?.trainingComplete);\n      playTrainingBgm();\n    }`,
  `    function enterTrainingScreen() {\n      gameState.phase = 'training';\n      showScreen('training-screen');\n      updateTrackUI();\n      updateTrainingUI();\n      drawPortrait();\n      renderTrainingRivals();\n      updateTrainingWaitStatus();\n      setTrainButtonsEnabled(!getLocalRoomPlayer()?.trainingComplete);\n      playTrainingBgm();\n      stopResultsBgm();\n    }\n\n    function startNextTrainingPhase() {\n      gameState.trackIndex = (gameState.trackIndex || 0) + 1;\n      gameState.turn = 1;\n      gameState.player.raceSkill = null;\n      gameState.bonusOffered = false;\n      gameState.bonusDoneThisTurn = false;\n      enterTrainingScreen();\n    }\n\n    function startTraining() {\n      gameState.phase = 'training';\n      if (isMultiplayer()) {\n        syncTrackIndexFromRoom();\n        syncLocalPlayerFromRoom();\n      } else {\n        gameState.turn = 1;\n        gameState.trackIndex = 0;\n        gameState.player.name = readRacerNameFromInput();\n        gameState.player.stats = getStartingStatsForRacer(selectedRacerId);\n        gameState.player.raceSkill = null;\n        gameState.bonusOffered = false;\n        gameState.bonusDoneThisTurn = false;\n        gameState.player.racerId = selectedRacerId;\n        applySelectedRacer(selectedRacerId);\n      }\n      showScreen('training-screen');\n      updateTrackUI();\n      updateTrainingUI();\n      drawPortrait();\n      renderTrainingRivals();\n      updateTrainingWaitStatus();\n      setTrainButtonsEnabled(!getLocalRoomPlayer()?.trainingComplete);\n      playTrainingBgm();\n    }`,
  'training functions'
);

replaceOnce(
  `    function showLineupScreen() {\n      if (isMultiplayer()) {\n        buildMultiplayerLineup();\n      } else {\n        generateCPUs();\n      }\n      gameState.phase = 'lineup';\n      renderLineupGrid();\n      updateLineupStartButton();\n      playPreRaceBgm();\n      showScreen('lineup-screen');\n    }`,
  `    function showLineupScreen() {\n      if (isMultiplayer()) {\n        buildMultiplayerLineup();\n      } else {\n        generateCPUs();\n      }\n      gameState.phase = 'lineup';\n      const track = getCurrentTrack();\n      const lineupTitle = document.querySelector('#lineup-screen h2');\n      const lineupSubtitle = document.querySelector('.lineup-subtitle');\n      if (lineupTitle) lineupTitle.textContent = \`\${track.subtitle} ${em} LINEUP\`;\n      if (lineupSubtitle) {\n        lineupSubtitle.textContent =\n          \`Meet the field ${em} need \${track.staminaRequirement}+ Stamina at 75% of lap on the \${track.name}.\`;\n      }\n      renderLineupGrid();\n      updateLineupStartButton();\n      playPreRaceBgm();\n      showScreen('lineup-screen');\n    }`,
  'lineup screen'
);

replaceOnce(
  `    function beginMultiplayerRace(data) {\n      cacheRacerMeta(data.field);`,
  `    function beginMultiplayerRace(data) {\n      if (data.trackIndex != null) gameState.trackIndex = data.trackIndex;\n      cacheRacerMeta(data.field);`,
  'begin race'
);

replaceOnce(
  `    function resumeMultiplayerRace(raceSync, toResults) {\n      cacheRacerMeta(raceSync.field);`,
  `    function resumeMultiplayerRace(raceSync, toResults) {\n      if (raceSync.trackIndex != null) gameState.trackIndex = raceSync.trackIndex;\n      cacheRacerMeta(raceSync.field);`,
  'resume race'
);

replaceOnce(
  '          if (effectiveStamina < STAMINA_REQUIREMENT && !secondWindSave) {',
  '          if (effectiveStamina < getStaminaRequirement() && !secondWindSave) {',
  'stamina check'
);

replaceOnce(
  `    // --- Results ---\n    function showResults() {`,
  `    // --- Results ---\n    function updateResultsContinueButton() {\n      const btn = document.getElementById('restart-btn');\n      if (!btn) return;\n      if (hasMoreTracks()) {\n        const nextTrack = getTrack((gameState.trackIndex ?? 0) + 1);\n        if (isMultiplayer()) {\n          const isHost = multiplayer.room?.hostId === multiplayer.playerId;\n          btn.textContent = isHost ? \`START \${nextTrack.subtitle}\` : 'WAITING FOR HOST...';\n          btn.disabled = !isHost;\n        } else {\n          btn.textContent = \`TRAIN FOR \${nextTrack.subtitle}\`;\n          btn.disabled = false;\n        }\n      } else {\n        btn.textContent = 'PLAY AGAIN';\n        btn.disabled = false;\n      }\n    }\n\n    function showResults() {`,
  'results helpers'
);

replaceOnce(
  `      title.className = won ? 'win' : 'lose';\n      title.textContent = won ? 'VICTORY!' : 'DEFEAT...';`,
  `      const track = getCurrentTrack();\n      title.className = won ? 'win' : 'lose';\n      title.textContent = \`\${track.subtitle} ${em} \${won ? 'VICTORY!' : 'DEFEAT...'}\`;`,
  'results title'
);

replaceOnce(
  `      const replayBtn = document.getElementById('replay-btn');\n      replayBtn.disabled = !raceReplay.finalized || raceReplay.frames.length < 2;\n    }\n\n    function uiAnimLoop(timestamp) {`,
  `      const replayBtn = document.getElementById('replay-btn');\n      replayBtn.disabled = !raceReplay.finalized || raceReplay.frames.length < 2;\n      updateResultsContinueButton();\n    }\n\n    function uiAnimLoop(timestamp) {`,
  'results continue btn'
);

replaceOnce(
  `    document.getElementById('restart-btn').onclick = () => {\n      stopSetupBgm();\n      stopTrainingBgm();\n      stopPreRaceBgm();\n      stopRaceBgm();\n      stopResultsBgm();\n      initGame();\n      multiplayer.mode = 'solo';\n      multiplayer.room = null;\n      multiplayer.playerId = null;\n      multiplayer.localReady = false;\n      multiplayer.racerMeta = {};\n      gameState.serverRace = false;\n      clearMultiplayerSession();\n      multiplayer.reconnectAttempted = false;\n      applySelectedRacer(selectedRacerId);\n      renderRacerOptions();\n      gameState.phase = 'splash';\n      showScreen('splash-screen');\n      playTitleBgm();\n    };`,
  `    document.getElementById('restart-btn').onclick = () => {\n      if (gameState.phase === 'results' && hasMoreTracks()) {\n        if (isMultiplayer()) {\n          multiplayer.socket.emit('host:start-next-training', {}, (res) => {\n            if (!res?.ok) return;\n            if (res.trackIndex != null) gameState.trackIndex = res.trackIndex;\n          });\n          return;\n        }\n        startNextTrainingPhase();\n        return;\n      }\n      stopSetupBgm();\n      stopTrainingBgm();\n      stopPreRaceBgm();\n      stopRaceBgm();\n      stopResultsBgm();\n      initGame();\n      multiplayer.mode = 'solo';\n      multiplayer.room = null;\n      multiplayer.playerId = null;\n      multiplayer.localReady = false;\n      multiplayer.racerMeta = {};\n      gameState.serverRace = false;\n      clearMultiplayerSession();\n      multiplayer.reconnectAttempted = false;\n      applySelectedRacer(selectedRacerId);\n      renderRacerOptions();\n      gameState.phase = 'splash';\n      showScreen('splash-screen');\n      playTitleBgm();\n    };`,
  'restart handler'
);

replaceOnce(
  `    function endReplay() {\n      setReplaySkipVisible(false);\n      setRaceSpeedControlsVisible(false);\n      resetRaceSpeed();\n      stopRaceBgm();\n      gameState.phase = 'results';\n      gameState.replayRacers = null;\n      showScreen('results-screen');\n      playResultsBgm();\n    }`,
  `    function endReplay() {\n      setReplaySkipVisible(false);\n      setRaceSpeedControlsVisible(false);\n      resetRaceSpeed();\n      stopRaceBgm();\n      gameState.replayRacers = null;\n      showResults();\n    }`,
  'end replay'
);

writeFileSync(indexPath, content);
console.log('index.html updated for two-track phase');