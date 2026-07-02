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
  `    let serverRaceInterp = null;
    let serverRaceEndTimer = null;
    let serverRaceEnded = false;
    const SERVER_TICK_MS = 50;`,
  `    let serverRaceInterp = null;
    let serverRaceEndTimer = null;
    let serverRaceEnded = false;
    let pendingServerRaceResults = null;
    const SERVER_TICK_MS = 50;
    const SERVER_RESULTS_DELAY_SEC = 2.5;`,
  'server race pending results vars'
);

html = replaceOnce(
  html,
  `    function resetServerRacePlayback() {
      serverRaceInterp = null;
      serverRaceEnded = false;
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
      gameState._serverReplayMod = 0;
      if (serverRaceEndTimer) {
        clearTimeout(serverRaceEndTimer);
        serverRaceEndTimer = null;
      }
    }`,
  'reset pending results'
);

html = replaceOnce(
  html,
  `    function getDisplayRacers() {
      if (!gameState.serverRace || !serverRaceInterp?.to?.length) {
        return gameState.racers;
      }
      const elapsed = performance.now() - (serverRaceInterp.start || 0);
      const u = Math.min(1, elapsed / SERVER_TICK_MS);
      const fromById = new Map((serverRaceInterp.from || []).map((r) => [r.id, r.position]));
      return serverRaceInterp.to.map((racer) => {
        const fromPos = fromById.get(racer.id);
        if (fromPos == null || !Number.isFinite(fromPos)) return racer;
        return {
          ...racer,
          position: fromPos + (racer.position - fromPos) * u
        };
      });
    }`,
  `    function getDisplayRacers() {
      if (!gameState.serverRace || !serverRaceInterp?.to?.length) {
        return gameState.racers;
      }
      const elapsed = performance.now() - (serverRaceInterp.start || 0);
      const u = Math.min(1, elapsed / SERVER_TICK_MS);
      const fromById = new Map((serverRaceInterp.from || []).map((r) => [r.id, r.position]));
      return serverRaceInterp.to.map((racer) => {
        if (racer.finished) {
          return { ...racer, position: RACE_LENGTH };
        }
        const fromPos = fromById.get(racer.id);
        if (fromPos == null || !Number.isFinite(fromPos)) return racer;
        const toPos = racer.finished ? RACE_LENGTH : racer.position;
        return {
          ...racer,
          position: fromPos + (toPos - fromPos) * u
        };
      });
    }

    function localPlayerReachedFinishLine() {
      const player = gameState.racers.find((r) => r.isPlayer);
      if (!player) return true;
      if (player.finished) return true;
      const display = getDisplayRacers().find((r) => r.isPlayer);
      return (display?.position ?? player.position) >= RACE_LENGTH * 0.995;
    }

    function serverRaceInterpSettled() {
      if (!serverRaceInterp?.to?.length) return true;
      return performance.now() - (serverRaceInterp.start || 0) >= SERVER_TICK_MS;
    }

    function tryShowServerRaceResults(force = false) {
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
    }`,
  'display racers finish snap + tryShowServerRaceResults'
);

html = replaceOnce(
  html,
  `    function completeServerRace(resultsData) {
      if (serverRaceEnded) return;
      serverRaceEnded = true;
      if (serverRaceEndTimer) {
        clearTimeout(serverRaceEndTimer);
        serverRaceEndTimer = null;
      }
      gameState.raceRunning = false;
      gameState.raceFinished = true;
      gameState.resultsDelay = 1.0;
      setRaceSkipVisible(false);
      setRaceSpeedControlsVisible(false);
      if (resultsData) handleMultiplayerRaceFinished(resultsData);
      finalizeReplayRecording();
      if (gameState.phase === 'race') {
        showResults();
      }
    }

    function scheduleServerRaceEndFallback() {
      if (serverRaceEndTimer) clearTimeout(serverRaceEndTimer);
      serverRaceEndTimer = setTimeout(() => {
        if (gameState.serverRace && gameState.raceFinished && gameState.phase === 'race') {
          completeServerRace(null);
        }
      }, 5000);
    }`,
  `    function completeServerRace(resultsData) {
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
  'completeServerRace delay results'
);

html = replaceOnce(
  html,
  `      if (tick.finished) {
        gameState.raceRunning = false;
        gameState.raceFinished = true;
        setRaceSkipVisible(false);
        setRaceSpeedControlsVisible(false);
        scheduleServerRaceEndFallback();
      }`,
  `      if (tick.finished) {
        gameState.raceRunning = false;
        gameState.raceFinished = true;
        const skipped = tick.events?.some((ev) => /skipped/i.test(ev.text || ''));
        gameState.resultsDelay = skipped ? 0 : Math.max(gameState.resultsDelay || 0, SERVER_RESULTS_DELAY_SEC);
        setRaceSkipVisible(false);
        setRaceSpeedControlsVisible(false);
        scheduleServerRaceEndFallback();
        tryShowServerRaceResults();
      }`,
  'applyServerRaceTick finished delay'
);

html = replaceOnce(
  html,
  `        if (gameState.phase === 'race') {
          if (gameState.raceRunning && !gameState.serverRace) {
            raceUpdate(scaledDt);
            recordReplaySample(scaledDt);
          } else if (gameState.raceFinished && !gameState.serverRace) {
            recordReplaySample(scaledDt);
            finalizeReplayRecording();
          }
          if (gameState.raceRunning || gameState.raceFinished) {
            updateRacerVisualState(scaledDt);
          }
          drawRace();
          if (gameState.raceFinished && !gameState.serverRace) {
            gameState.resultsDelay -= scaledDt;
            if (gameState.resultsDelay <= 0) {
              showResults();
              return;
            }
          }
        }`,
  `        if (gameState.phase === 'race') {
          if (gameState.raceRunning && !gameState.serverRace) {
            raceUpdate(scaledDt);
            recordReplaySample(scaledDt);
          } else if (gameState.raceFinished && !gameState.serverRace) {
            recordReplaySample(scaledDt);
            finalizeReplayRecording();
          } else if (gameState.raceFinished && gameState.serverRace) {
            recordReplaySample(scaledDt);
          }
          if (gameState.raceRunning || gameState.raceFinished) {
            updateRacerVisualState(scaledDt);
          }
          drawRace();
          if (gameState.raceFinished && gameState.serverRace) {
            gameState.resultsDelay -= scaledDt;
            tryShowServerRaceResults();
          } else if (gameState.raceFinished && !gameState.serverRace) {
            gameState.resultsDelay -= scaledDt;
            if (gameState.resultsDelay <= 0) {
              showResults();
              return;
            }
          }
        }`,
  'raceLoop server results delay'
);

if (html.includes('racer.finished = true;\n            racer.name = s.name')) {
  html = replaceOnce(
    html,
    `          if (racer) {
            racer.finishTime = s.finishTime;
            racer.finished = true;
            racer.name = s.name || racer.name;
          }`,
    `          if (racer) {
            racer.finishTime = s.finishTime;
            racer.finished = true;
            racer.position = RACE_LENGTH;
            racer.name = s.name || racer.name;
          }`,
    'handleMultiplayerRaceFinished position snap'
  );
}

fs.writeFileSync(indexPath, html);
console.log('Applied multiplayer early-finish fixes to index.html');