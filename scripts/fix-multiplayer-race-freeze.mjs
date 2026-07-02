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
  `    let onlineServerReadyPromise = null;

    const multiplayer = {`,
  `    let onlineServerReadyPromise = null;
    let serverRaceInterp = null;
    let serverRaceEndTimer = null;
    let serverRaceEnded = false;
    const SERVER_TICK_MS = 50;

    const multiplayer = {`,
  'server race state vars'
);

html = replaceOnce(
  html,
  `      socket.on('connect', () => {
        multiplayer.connected = true;
        if (multiplayer.mode === 'solo' && loadMultiplayerSession()) {
          tryReconnectSession();
        }
      });
      socket.on('disconnect', () => { multiplayer.connected = false; });`,
  `      socket.on('connect', () => {
        multiplayer.connected = true;
        onlineServerReadyPromise = null;
        if (loadMultiplayerSession() && multiplayer.mode !== 'solo') {
          multiplayer.reconnectAttempted = false;
          tryReconnectSession();
        }
      });
      socket.on('disconnect', () => {
        multiplayer.connected = false;
        multiplayer.reconnectAttempted = false;
      });`,
  'socket reconnect during race'
);

html = replaceOnce(
  html,
  `      socket.on('race:finished', (data) => {
        if (gameState.serverRace) {
          handleMultiplayerRaceFinished(data);
          gameState.raceRunning = false;
          gameState.raceFinished = true;
          gameState.resultsDelay = 0;
          setRaceSkipVisible(false);
          setRaceSpeedControlsVisible(false);
          if (gameState.phase === 'race') showResults();
        }
      });`,
  `      socket.on('race:finished', (data) => {
        if (gameState.serverRace) {
          completeServerRace(data);
        }
      });`,
  'race finished handler'
);

html = replaceOnce(
  html,
  `    function beginMultiplayerRace(data) {
      if (data.trackIndex != null) gameState.trackIndex = data.trackIndex;
      cacheRacerMeta(data.field);
      setReplaySkipVisible(false);
      const isHost = multiplayer.room?.hostId === multiplayer.playerId;
      setRaceSkipVisible(isHost);
      setRaceSpeedControlsVisible(false);
      stopPreRaceBgm();
      playRaceBgm();
      raceReplay = { frames: [], duration: 0, finalized: false };
      replaySampleTimer = 0;
      gameState.phase = 'race';
      gameState.serverRace = true;
      mergeServerRacers(data.racers);
`,
  `    function resetServerRacePlayback() {
      serverRaceInterp = null;
      serverRaceEnded = false;
      if (serverRaceEndTimer) {
        clearTimeout(serverRaceEndTimer);
        serverRaceEndTimer = null;
      }
    }

    function snapshotRacerPositions(racers) {
      return (racers || []).map((r) => ({ id: r.id, position: r.position }));
    }

    function getDisplayRacers() {
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
    }

    function completeServerRace(resultsData) {
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
    }

    function beginMultiplayerRace(data) {
      if (data.trackIndex != null) gameState.trackIndex = data.trackIndex;
      cacheRacerMeta(data.field);
      resetServerRacePlayback();
      setReplaySkipVisible(false);
      const isHost = multiplayer.room?.hostId === multiplayer.playerId;
      setRaceSkipVisible(isHost);
      setRaceSpeedControlsVisible(false);
      stopPreRaceBgm();
      playRaceBgm();
      raceReplay = { frames: [], duration: 0, finalized: false };
      replaySampleTimer = 0;
      gameState.phase = 'race';
      gameState.serverRace = true;
      mergeServerRacers(data.racers);
`,
  'server race playback helpers'
);

html = replaceOnce(
  html,
  `    function applyServerRaceTick(tick) {
      gameState.raceTime = tick.t;
      mergeServerRacers(tick.racers);
      if (tick.events?.length) {
        tick.events.forEach((ev) => {
          if (!ev.playerId || ev.playerId === multiplayer.playerId) {
            gameState.eventLog.push(ev.text);
          }
        });
      }
      recordReplaySample(0.05);
      if (tick.finished) {
        gameState.raceRunning = false;
        gameState.raceFinished = true;
        gameState.resultsDelay = 2.5;
        setRaceSkipVisible(false);
        setRaceSpeedControlsVisible(false);
        finalizeReplayRecording();
      }
      updateRaceHUD();
    }`,
  `    function applyServerRaceTick(tick) {
      serverRaceInterp = {
        from: snapshotRacerPositions(gameState.racers),
        to: null,
        start: performance.now()
      };
      gameState.raceTime = tick.t;
      mergeServerRacers(tick.racers);
      serverRaceInterp.to = gameState.racers.map((r) => ({ ...r }));
      if (tick.events?.length) {
        tick.events.forEach((ev) => {
          if (!ev.playerId || ev.playerId === multiplayer.playerId) {
            gameState.eventLog.push(ev.text);
          }
        });
      }
      if (!gameState._serverReplayMod) gameState._serverReplayMod = 0;
      gameState._serverReplayMod++;
      if (gameState._serverReplayMod % 5 === 0) {
        captureReplayFrame();
      }
      if (tick.finished) {
        gameState.raceRunning = false;
        gameState.raceFinished = true;
        setRaceSkipVisible(false);
        setRaceSpeedControlsVisible(false);
        scheduleServerRaceEndFallback();
      }
      updateRaceHUD();
    }`,
  'applyServerRaceTick fix'
);

html = replaceOnce(
  html,
  `    function resumeMultiplayerRace(raceSync, toResults) {
      if (raceSync.trackIndex != null) gameState.trackIndex = raceSync.trackIndex;
      cacheRacerMeta(raceSync.field);
      gameState.serverRace = true;
`,
  `    function resumeMultiplayerRace(raceSync, toResults) {
      if (raceSync.trackIndex != null) gameState.trackIndex = raceSync.trackIndex;
      cacheRacerMeta(raceSync.field);
      resetServerRacePlayback();
      gameState.serverRace = true;
`,
  'resume race reset playback'
);

html = replaceOnce(
  html,
  `    function raceLoop(timestamp) {
      const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0;
      const scaledDt = dt * raceSpeedMultiplier;
      lastTime = timestamp;
      globalAnimTime = timestamp / 1000;

      if (gameState.phase === 'race') {
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
        if (gameState.raceFinished) {
          gameState.resultsDelay -= scaledDt;
          if (gameState.resultsDelay <= 0) {
            showResults();
            return;
          }
        }
        requestAnimationFrame(raceLoop);
      }
    }`,
  `    function raceLoop(timestamp) {
      try {
        const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0;
        const scaledDt = dt * raceSpeedMultiplier;
        lastTime = timestamp;
        globalAnimTime = timestamp / 1000;

        if (gameState.phase === 'race') {
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
        }
      } catch (err) {
        console.error('raceLoop error:', err);
      }
      if (gameState.phase === 'race') {
        requestAnimationFrame(raceLoop);
      }
    }`,
  'raceLoop try catch server end'
);

html = replaceOnce(
  html,
  `      const drawRacers = racersOverride || gameState.racers;
`,
  `      const drawRacers = racersOverride || getDisplayRacers();
`,
  'drawRace interpolation'
);

fs.writeFileSync(indexPath, html, 'utf8');
console.log('multiplayer race freeze fixes applied');