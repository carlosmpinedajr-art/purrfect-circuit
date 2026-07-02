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
  `    .race-skip-btn:hover,
    .race-speed-btn:hover {
      background: #5a3d9e;
      border-color: #ffd700;
    }`,
  `    .race-skip-btn:hover,
    .race-speed-btn:hover {
      background: #5a3d9e;
      border-color: #ffd700;
    }
    #race-continue-btn {
      background: linear-gradient(180deg, #7fd7ff 0%, #3a9fd4 100%);
      border-color: #fff;
      color: #1a0a2e;
      font-size: clamp(7px, 1.2vw, 9px);
      padding: 8px 14px;
      animation: race-continue-pulse 1.2s ease-in-out infinite;
    }
    #race-continue-btn:hover {
      background: #9fe8ff;
      border-color: #ffd700;
    }
    @keyframes race-continue-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(127, 215, 255, 0.45); }
      50% { box-shadow: 0 0 10px 2px rgba(127, 215, 255, 0.55); }
    }`,
  'race continue btn css'
);

html = replaceOnce(
  html,
  `            <button type="button" class="race-skip-btn hidden" id="race-skip-btn">SKIP</button>
            <button type="button" class="race-skip-btn hidden" id="replay-skip-btn">SKIP</button>`,
  `            <button type="button" class="race-skip-btn hidden" id="race-skip-btn">SKIP</button>
            <button type="button" class="race-skip-btn hidden" id="replay-skip-btn">SKIP</button>
            <button type="button" class="race-skip-btn hidden" id="race-continue-btn">VIEW RESULTS</button>`,
  'race continue btn html'
);

html = replaceOnce(
  html,
  `    let pendingServerRaceResults = null;
    const SERVER_TICK_MS = 50;
    const SERVER_RESULTS_DELAY_SEC = 2.5;`,
  `    let pendingServerRaceResults = null;
    let raceResultsPrepared = false;
    const SERVER_TICK_MS = 50;`,
  'raceResultsPrepared var'
);

html = replaceOnce(
  html,
  `    function resetServerRacePlayback() {
      serverRaceInterp = null;
      serverRaceEnded = false;
      pendingServerRaceResults = null;
      gameState._serverReplayMod = 0;
      if (serverRaceEndTimer) {
        clearTimeout(serverRaceEndTimer);
        serverRaceEndTimer = null;
      }
    }`,
  `    function resetServerRacePlayback() {
      serverRaceInterp = null;
      serverRaceEnded = false;
      pendingServerRaceResults = null;
      raceResultsPrepared = false;
      gameState._serverReplayMod = 0;
      if (serverRaceEndTimer) {
        clearTimeout(serverRaceEndTimer);
        serverRaceEndTimer = null;
      }
      setRaceContinueVisible(false);
    }`,
  'reset continue state'
);

html = replaceOnce(
  html,
  `    function tryShowServerRaceResults(force = false) {
      if (serverRaceEnded || !gameState.serverRace || !gameState.raceFinished) return;
      if (!force) {
        if ((gameState.resultsDelay ?? 0) > 0) return;
        if (!serverRaceInterpSettled()) return;
        if (!localPlayerReachedFinishLine()) return;
      }
      serverRaceEnded = true;
      if (serverRaceEndTimer) {
        clearTimeout(serverRaceEndTimer);
        serverRaceEndTimer = null;
      }
      gameState.raceRunning = false;
      setRaceSkipVisible(false);
      setRaceSpeedControlsVisible(false);
      if (pendingServerRaceResults) {
        handleMultiplayerRaceFinished(pendingServerRaceResults);
        pendingServerRaceResults = null;
      }
      finalizeReplayRecording();
      if (gameState.phase === 'race') showResults();
    }

    function completeServerRace(resultsData) {
      if (serverRaceEnded) return;
      if (resultsData) pendingServerRaceResults = resultsData;
      gameState.raceRunning = false;
      gameState.raceFinished = true;
      setRaceSkipVisible(false);
      setRaceSpeedControlsVisible(false);
      if (gameState.resultsDelay == null || gameState.resultsDelay <= 0) {
        gameState.resultsDelay = SERVER_RESULTS_DELAY_SEC;
      }
      tryShowServerRaceResults();
    }

    function scheduleServerRaceEndFallback() {
      if (serverRaceEndTimer) clearTimeout(serverRaceEndTimer);
      serverRaceEndTimer = setTimeout(() => {
        if (gameState.serverRace && gameState.raceFinished && gameState.phase === 'race') {
          tryShowServerRaceResults(true);
        }
      }, 8000);
    }`,
  `    function getHumanRacersFromState() {
      return (gameState.racers || []).filter((r) => r.isHuman || r.playerId);
    }

    function getUnfinishedHumanRacerCount() {
      return getHumanRacersFromState().filter((r) => !r.finished).length;
    }

    function localPlayerFinishedRace() {
      const player = gameState.racers.find((r) => r.isPlayer);
      return !!player?.finished;
    }

    function allLocalHumansFinished() {
      const humans = getHumanRacersFromState();
      return humans.length > 0 && humans.every((r) => r.finished);
    }

    function raceReadyForResultsPrompt() {
      if (!gameState.raceFinished) return false;
      if (!serverRaceInterpSettled()) return false;
      if (!localPlayerReachedFinishLine()) return false;
      if (isMultiplayer() && gameState.serverRace && !allLocalHumansFinished()) return false;
      return true;
    }

    function prepareRaceResultsContinue(force = false) {
      if (raceResultsPrepared) {
        setRaceContinueVisible(true);
        updateRaceFinishStatus();
        return;
      }
      if (!gameState.raceFinished) return;
      if (!force && !raceReadyForResultsPrompt()) return;

      raceResultsPrepared = true;
      if (serverRaceEndTimer) {
        clearTimeout(serverRaceEndTimer);
        serverRaceEndTimer = null;
      }
      gameState.raceRunning = false;
      setRaceSkipVisible(false);
      setRaceSpeedControlsVisible(false);

      if (gameState.serverRace && pendingServerRaceResults) {
        handleMultiplayerRaceFinished(pendingServerRaceResults);
        pendingServerRaceResults = null;
      }
      finalizeReplayRecording();
      setRaceContinueVisible(true);
      updateRaceFinishStatus();
    }

    function goToRaceResults() {
      if (!raceResultsPrepared && gameState.phase === 'race') {
        prepareRaceResultsContinue(true);
      }
      setRaceContinueVisible(false);
      if (gameState.phase === 'race') showResults();
    }

    function completeServerRace(resultsData) {
      if (raceResultsPrepared) return;
      if (resultsData) pendingServerRaceResults = resultsData;
      gameState.raceRunning = false;
      gameState.raceFinished = true;
      setRaceSkipVisible(false);
      setRaceSpeedControlsVisible(false);
      prepareRaceResultsContinue();
    }

    function scheduleServerRaceEndFallback() {
      if (serverRaceEndTimer) clearTimeout(serverRaceEndTimer);
      serverRaceEndTimer = setTimeout(() => {
        if (gameState.raceFinished && gameState.phase === 'race' && !raceResultsPrepared) {
          prepareRaceResultsContinue(true);
        }
      }, 12000);
    }`,
  'prepare continue instead of auto results'
);

html = replaceOnce(
  html,
  `      if (tick.finished) {
        gameState.raceRunning = false;
        gameState.raceFinished = true;
        const skipped = tick.events?.some((ev) => /skipped/i.test(ev.text || ''));
        gameState.resultsDelay = skipped ? 0 : Math.max(gameState.resultsDelay || 0, SERVER_RESULTS_DELAY_SEC);
        setRaceSkipVisible(false);
        setRaceSpeedControlsVisible(false);
        scheduleServerRaceEndFallback();
        tryShowServerRaceResults();
      }
      updateRaceHUD();`,
  `      if (localPlayerFinishedRace()) setRaceSkipVisible(false);
      if (tick.finished) {
        gameState.raceRunning = false;
        gameState.raceFinished = true;
        setRaceSkipVisible(false);
        setRaceSpeedControlsVisible(false);
        scheduleServerRaceEndFallback();
        prepareRaceResultsContinue();
      }
      updateRaceHUD();`,
  'tick finished prepare continue'
);

html = replaceOnce(
  html,
  `      if (raceSync.finished || toResults) {
        if (raceSync.results) handleMultiplayerRaceFinished(raceSync.results);
        gameState.raceFinished = true;
        showResults();
        return;
      }`,
  `      if (raceSync.finished || toResults) {
        if (raceSync.results) {
          pendingServerRaceResults = raceSync.results;
        }
        gameState.raceFinished = true;
        gameState.raceRunning = false;
        prepareRaceResultsContinue(true);
        return;
      }`,
  'resume race finished continue btn'
);

html = replaceOnce(
  html,
  `    function setRaceSkipVisible(visible) {
      document.getElementById('race-skip-btn').classList.toggle('hidden', !visible);
    }`,
  `    function setRaceSkipVisible(visible) {
      const btn = document.getElementById('race-skip-btn');
      if (btn) btn.classList.toggle('hidden', !visible);
    }

    function setRaceContinueVisible(visible) {
      const btn = document.getElementById('race-continue-btn');
      if (btn) btn.classList.toggle('hidden', !visible);
    }

    function updateRaceFinishStatus() {
      const posEl = document.getElementById('race-position');
      if (!posEl || gameState.phase !== 'race') return;

      if (raceResultsPrepared) {
        posEl.textContent = 'RACE COMPLETE — Press VIEW RESULTS when ready';
        return;
      }

      if (isMultiplayer() && gameState.serverRace && localPlayerFinishedRace() && !gameState.raceFinished) {
        const waiting = getUnfinishedHumanRacerCount();
        posEl.textContent = waiting > 0
          ? \`YOU FINISHED — Waiting for \${waiting} player\${waiting === 1 ? '' : 's'}...\`
          : 'YOU FINISHED — Waiting for race to end...';
        return;
      }

      if (gameState.raceFinished && !raceResultsPrepared) {
        const waiting = getUnfinishedHumanRacerCount();
        if (waiting > 0) {
          posEl.textContent = \`WAITING FOR \${waiting} PLAYER\${waiting === 1 ? '' : 'S'} TO FINISH...\`;
        }
      }
    }`,
  'continue button helpers'
);

html = replaceOnce(
  html,
  `    function updateRaceHUD() {
      const player = gameState.racers.find(r => r.isPlayer) || gameState.racers[0];
      const sorted = [...gameState.racers].sort((a, b) => b.position - a.position);
      const pos = sorted.findIndex(r => r.isPlayer) + 1;
      const lap = getLapNumber(player.position);
      const lapPct = Math.floor(getLapProgress(player.position) * 100);
      document.getElementById('race-position').textContent =
        \`POSITION: \${pos}\${getOrdinal(pos)} / \${getRaceFieldSize()}  |  LAP \${lap}/\${TOTAL_LAPS} (\${lapPct}%)\`;
      updateRaceSpeedDisplay(player);
      updateRaceProgressBar(gameState.racers);
      document.getElementById('event-log').textContent = gameState.eventLog.slice(-2).join('  |  ');
    }`,
  `    function updateRaceHUD() {
      if (raceResultsPrepared || (isMultiplayer() && gameState.serverRace && localPlayerFinishedRace() && !gameState.raceFinished)) {
        updateRaceFinishStatus();
        const player = gameState.racers.find((r) => r.isPlayer) || gameState.racers[0];
        if (player) updateRaceSpeedDisplay(player);
        updateRaceProgressBar(gameState.racers);
        if (!raceResultsPrepared) {
          document.getElementById('event-log').textContent = gameState.eventLog.slice(-2).join('  |  ');
        }
        return;
      }
      if (gameState.raceFinished && !raceResultsPrepared) {
        updateRaceFinishStatus();
      }
      const player = gameState.racers.find(r => r.isPlayer) || gameState.racers[0];
      const sorted = [...gameState.racers].sort((a, b) => b.position - a.position);
      const pos = sorted.findIndex(r => r.isPlayer) + 1;
      const lap = getLapNumber(player.position);
      const lapPct = Math.floor(getLapProgress(player.position) * 100);
      document.getElementById('race-position').textContent =
        \`POSITION: \${pos}\${getOrdinal(pos)} / \${getRaceFieldSize()}  |  LAP \${lap}/\${TOTAL_LAPS} (\${lapPct}%)\`;
      updateRaceSpeedDisplay(player);
      updateRaceProgressBar(gameState.racers);
      document.getElementById('event-log').textContent = gameState.eventLog.slice(-2).join('  |  ');
    }`,
  'updateRaceHUD waiting status'
);

html = replaceOnce(
  html,
  `      if (allFinished || gameState.racers.every(r => r.finished)) {
        gameState.raceRunning = false;
        gameState.raceFinished = true;
        gameState.resultsDelay = 2.5;
        setRaceSkipVisible(false);
        setRaceSpeedControlsVisible(false);
      }`,
  `      if (allFinished || gameState.racers.every(r => r.finished)) {
        gameState.raceRunning = false;
        gameState.raceFinished = true;
        setRaceSkipVisible(false);
        setRaceSpeedControlsVisible(false);
        prepareRaceResultsContinue();
      }`,
  'solo race finish continue'
);

html = replaceOnce(
  html,
  `          if (gameState.raceFinished && gameState.serverRace) {
            gameState.resultsDelay -= scaledDt;
            tryShowServerRaceResults();
          } else if (gameState.raceFinished && !gameState.serverRace) {
            gameState.resultsDelay -= scaledDt;
            if (gameState.resultsDelay <= 0) {
              showResults();
              return;
            }
          }`,
  `          if (gameState.raceFinished && !raceResultsPrepared) {
            prepareRaceResultsContinue();
          }`,
  'raceLoop prepare continue'
);

html = replaceOnce(
  html,
  `      gameState.raceRunning = false;
      gameState.raceFinished = true;
      gameState.resultsDelay = 0;
      gameState.eventLog.push('Race skipped — showing results.');
      captureReplayFrame();
      finalizeReplayRecording();
      showResults();
    }`,
  `      gameState.raceRunning = false;
      gameState.raceFinished = true;
      gameState.eventLog.push('Race skipped — press VIEW RESULTS.');
      captureReplayFrame();
      prepareRaceResultsContinue(true);
    }`,
  'solo skip shows continue'
);

html = replaceOnce(
  html,
  `    document.getElementById('race-skip-btn').onclick = skipRace;
    document.getElementById('replay-skip-btn').onclick = endReplay;`,
  `    document.getElementById('race-skip-btn').onclick = skipRace;
    document.getElementById('replay-skip-btn').onclick = endReplay;
    document.getElementById('race-continue-btn').onclick = goToRaceResults;`,
  'continue btn onclick'
);

html = replaceOnce(
  html,
  `    function showResults() {
      setRaceSkipVisible(false);
      setReplaySkipVisible(false);
      setRaceSpeedControlsVisible(false);
      resetRaceSpeed();`,
  `    function showResults() {
      setRaceContinueVisible(false);
      raceResultsPrepared = false;
      setRaceSkipVisible(false);
      setReplaySkipVisible(false);
      setRaceSpeedControlsVisible(false);
      resetRaceSpeed();`,
  'showResults reset continue'
);

fs.writeFileSync(indexPath, html);
console.log('Applied race continue button fixes to index.html');