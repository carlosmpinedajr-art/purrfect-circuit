$index = Join-Path $PSScriptRoot '..\index.html'
$content = [IO.File]::ReadAllText($index)

function Replace-Once($text, $old, $new, $label) {
  if (-not $text.Contains($old)) { throw "$label not found" }
  return $text.Replace($old, $new)
}

$replacements = @(
  @{
    Old = '  <script src="racer-stats.js"></script>' + "`n  <script>"
    New = '  <script src="racer-stats.js"></script>' + "`n  <script src=`"tracks.js`"></script>" + "`n  <script>"
    Label = 'tracks script'
  },
  @{
    Old = '            <strong>STAMINA</strong> ' + [char]0x2014 + ' Need 15+ at 75% of lap or -80% speed<br>'
    New = '            <span id="stamina-guide-line"><strong>STAMINA</strong> ' + [char]0x2014 + ' Need 15+ at 75% of lap or -80% speed<br></span>'
    Label = 'stamina guide id'
  },
  @{
    Old = '    const STAMINA_REQUIREMENT = 15;' + "`n    const LAP_LENGTH = 1000;"
    New = '    const LAP_LENGTH = 1000;'
    Label = 'remove stamina const'
  },
  @{
    Old = '          if (effectiveStamina < STAMINA_REQUIREMENT && !secondWindSave) {'
    New = '          if (effectiveStamina < getStaminaRequirement() && !secondWindSave) {'
    Label = 'race stamina check'
  }
)

foreach ($r in $replacements) {
  $content = Replace-Once $content $r.Old $r.New $r.Label
}

# Larger blocks written to temp files to avoid here-string newline issues
$blocks = Join-Path $PSScriptRoot 'two-track-blocks'
New-Item -ItemType Directory -Force -Path $blocks | Out-Null

@'
    function getCurrentTrack() {
      const idx = gameState.trackIndex ?? multiplayer.room?.trackIndex ?? 0;
      return getTrack(idx);
    }

    function getStaminaRequirement() {
      return getCurrentTrack().staminaRequirement;
    }

    function hasMoreTracks() {
      const idx = gameState.trackIndex ?? multiplayer.room?.trackIndex ?? 0;
      return idx < getTrackCount() - 1;
    }

    function syncTrackIndexFromRoom() {
      if (multiplayer.room?.trackIndex != null) {
        gameState.trackIndex = multiplayer.room.trackIndex;
      }
    }

    function updateTrackUI() {
      const track = getCurrentTrack();
      const subtitle = document.getElementById('game-subtitle');
      if (subtitle) subtitle.textContent = track.subtitle;
      const staminaGuide = document.getElementById('stamina-guide-line');
      if (staminaGuide) {
        staminaGuide.innerHTML = `<strong>STAMINA</strong> \u2014 Need ${track.staminaRequirement}+ at 75% of lap or -80% speed<br>`;
      }
    }

    function initGame() {
      gameState = {
        phase: 'splash',
        trackIndex: 0,
        turn: 1,
'@ | Set-Content -Path (Join-Path $blocks 'initGame.new') -NoNewline

@'
    function initGame() {
      gameState = {
        phase: 'splash',
        turn: 1,
'@ | Set-Content -Path (Join-Path $blocks 'initGame.old') -NoNewline

$content = Replace-Once $content ([IO.File]::ReadAllText((Join-Path $blocks 'initGame.old'))) ([IO.File]::ReadAllText((Join-Path $blocks 'initGame.new'))) 'initGame'

@'
      if (phase === 'training') {
        syncTrackIndexFromRoom();
        if ((gameState.trackIndex || 0) > 0) {
          enterTrainingScreen();
        } else {
          startTraining();
        }
        return;
      }
'@ | Set-Content (Join-Path $blocks 'reconnect.new') -NoNewline
@'
      if (phase === 'training') {
        startTraining();
        return;
      }
'@ | Set-Content (Join-Path $blocks 'reconnect.old') -NoNewline
$content = Replace-Once $content ([IO.File]::ReadAllText((Join-Path $blocks 'reconnect.old'))) ([IO.File]::ReadAllText((Join-Path $blocks 'reconnect.new'))) 'reconnect'

@'
      socket.on('room:updated', (room) => {
        multiplayer.room = { ...multiplayer.room, ...room };
        if (room.trackIndex != null) gameState.trackIndex = room.trackIndex;
        const me = room.players?.find((p) => p.id === multiplayer.playerId);
        if (me) multiplayer.localReady = !!me.ready;
        if (gameState.phase === 'lobby') renderLobby();
        if (gameState.phase === 'results') updateResultsContinueButton();
'@ | Set-Content (Join-Path $blocks 'roomUpdated.new') -NoNewline
@'
      socket.on('room:updated', (room) => {
        multiplayer.room = { ...multiplayer.room, ...room };
        const me = room.players?.find((p) => p.id === multiplayer.playerId);
        if (me) multiplayer.localReady = !!me.ready;
        if (gameState.phase === 'lobby') renderLobby();
'@ | Set-Content (Join-Path $blocks 'roomUpdated.old') -NoNewline
$content = Replace-Once $content ([IO.File]::ReadAllText((Join-Path $blocks 'roomUpdated.old'))) ([IO.File]::ReadAllText((Join-Path $blocks 'roomUpdated.new'))) 'roomUpdated'

@'
      socket.on('room:phase', ({ phase, trackIndex }) => {
        if (trackIndex != null) gameState.trackIndex = trackIndex;
        if (phase === 'training' && gameState.phase === 'results') {
          syncLocalPlayerFromRoom();
          enterTrainingScreen();
          return;
        }
        if (phase === 'training' && (gameState.phase === 'lobby' || gameState.phase === 'setup')) {
          gameState.trackIndex = 0;
          startTraining();
          return;
        }
        if (phase === 'lineup' && (gameState.phase === 'training' || gameState.phase === 'lobby')) {
          showLineupScreen();
        }
      });
'@ | Set-Content (Join-Path $blocks 'roomPhase.new') -NoNewline
@'
      socket.on('room:phase', ({ phase }) => {
        if (phase === 'training' && (gameState.phase === 'lobby' || gameState.phase === 'setup')) {
          startTraining();
          return;
        }
        if (phase === 'lineup' && (gameState.phase === 'training' || gameState.phase === 'lobby')) {
          showLineupScreen();
        }
      });
'@ | Set-Content (Join-Path $blocks 'roomPhase.old') -NoNewline
$content = Replace-Once $content ([IO.File]::ReadAllText((Join-Path $blocks 'roomPhase.old'))) ([IO.File]::ReadAllText((Join-Path $blocks 'roomPhase.new'))) 'roomPhase'

@'
    function enterTrainingScreen() {
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
    }

    function startNextTrainingPhase() {
      gameState.trackIndex = (gameState.trackIndex || 0) + 1;
      gameState.turn = 1;
      gameState.player.raceSkill = null;
      gameState.bonusOffered = false;
      gameState.bonusDoneThisTurn = false;
      enterTrainingScreen();
    }

    function startTraining() {
      gameState.phase = 'training';
      if (isMultiplayer()) {
        syncTrackIndexFromRoom();
        syncLocalPlayerFromRoom();
      } else {
        gameState.turn = 1;
        gameState.trackIndex = 0;
        gameState.player.name = readRacerNameFromInput();
        gameState.player.stats = getStartingStatsForRacer(selectedRacerId);
        gameState.player.raceSkill = null;
        gameState.bonusOffered = false;
        gameState.bonusDoneThisTurn = false;
        gameState.player.racerId = selectedRacerId;
        applySelectedRacer(selectedRacerId);
      }
      showScreen('training-screen');
      updateTrackUI();
      updateTrainingUI();
      drawPortrait();
      renderTrainingRivals();
      updateTrainingWaitStatus();
      setTrainButtonsEnabled(!getLocalRoomPlayer()?.trainingComplete);
      playTrainingBgm();
    }
'@ | Set-Content (Join-Path $blocks 'training.new') -NoNewline
@'
    function startTraining() {
      gameState.phase = 'training';
      if (isMultiplayer()) {
        syncLocalPlayerFromRoom();
      } else {
        gameState.turn = 1;
        gameState.player.name = readRacerNameFromInput();
        gameState.player.stats = getStartingStatsForRacer(selectedRacerId);
        gameState.player.raceSkill = null;
        gameState.bonusOffered = false;
        gameState.bonusDoneThisTurn = false;
        gameState.player.racerId = selectedRacerId;
        applySelectedRacer(selectedRacerId);
      }
      showScreen('training-screen');
      updateTrainingUI();
      drawPortrait();
      renderTrainingRivals();
      updateTrainingWaitStatus();
      setTrainButtonsEnabled(!getLocalRoomPlayer()?.trainingComplete);
      playTrainingBgm();
    }
'@ | Set-Content (Join-Path $blocks 'training.old') -NoNewline
$content = Replace-Once $content ([IO.File]::ReadAllText((Join-Path $blocks 'training.old'))) ([IO.File]::ReadAllText((Join-Path $blocks 'training.new'))) 'training'

@'
    function showLineupScreen() {
      if (isMultiplayer()) {
        buildMultiplayerLineup();
      } else {
        generateCPUs();
      }
      gameState.phase = 'lineup';
      const track = getCurrentTrack();
      const lineupTitle = document.querySelector('#lineup-screen h2');
      const lineupSubtitle = document.querySelector('.lineup-subtitle');
      if (lineupTitle) lineupTitle.textContent = `${track.subtitle} - LINEUP`;
      if (lineupSubtitle) {
        lineupSubtitle.textContent =
          `Meet the field - need ${track.staminaRequirement}+ Stamina at 75% of lap on the ${track.name}.`;
      }
      renderLineupGrid();
      updateLineupStartButton();
      playPreRaceBgm();
      showScreen('lineup-screen');
    }
'@ | Set-Content (Join-Path $blocks 'lineup.new') -NoNewline
@'
    function showLineupScreen() {
      if (isMultiplayer()) {
        buildMultiplayerLineup();
      } else {
        generateCPUs();
      }
      gameState.phase = 'lineup';
      renderLineupGrid();
      updateLineupStartButton();
      playPreRaceBgm();
      showScreen('lineup-screen');
    }
'@ | Set-Content (Join-Path $blocks 'lineup.old') -NoNewline
$content = Replace-Once $content ([IO.File]::ReadAllText((Join-Path $blocks 'lineup.old'))) ([IO.File]::ReadAllText((Join-Path $blocks 'lineup.new'))) 'lineup'

$content = Replace-Once $content '    function beginMultiplayerRace(data) {' + "`n      cacheRacerMeta(data.field);" '    function beginMultiplayerRace(data) {' + "`n      if (data.trackIndex != null) gameState.trackIndex = data.trackIndex;`n      cacheRacerMeta(data.field);" 'beginRace'
$content = Replace-Once $content '    function resumeMultiplayerRace(raceSync, toResults) {' + "`n      cacheRacerMeta(raceSync.field);" '    function resumeMultiplayerRace(raceSync, toResults) {' + "`n      if (raceSync.trackIndex != null) gameState.trackIndex = raceSync.trackIndex;`n      cacheRacerMeta(raceSync.field);" 'resumeRace'

@'
    // --- Results ---
    function updateResultsContinueButton() {
      const btn = document.getElementById('restart-btn');
      if (!btn) return;
      if (hasMoreTracks()) {
        const nextTrack = getTrack((gameState.trackIndex ?? 0) + 1);
        if (isMultiplayer()) {
          const isHost = multiplayer.room?.hostId === multiplayer.playerId;
          btn.textContent = isHost ? `START ${nextTrack.subtitle}` : 'WAITING FOR HOST...';
          btn.disabled = !isHost;
        } else {
          btn.textContent = `TRAIN FOR ${nextTrack.subtitle}`;
          btn.disabled = false;
        }
      } else {
        btn.textContent = 'PLAY AGAIN';
        btn.disabled = false;
      }
    }

    function showResults() {
'@ | Set-Content (Join-Path $blocks 'results.new') -NoNewline
@'
    // --- Results ---
    function showResults() {
'@ | Set-Content (Join-Path $blocks 'results.old') -NoNewline
$content = Replace-Once $content ([IO.File]::ReadAllText((Join-Path $blocks 'results.old'))) ([IO.File]::ReadAllText((Join-Path $blocks 'results.new'))) 'results fn'

@'
      const track = getCurrentTrack();
      title.textContent = `${track.subtitle} - ${won ? 'VICTORY!' : 'DEFEAT...'}`;
'@ | Set-Content (Join-Path $blocks 'resultsTitle.new') -NoNewline
@'
      title.textContent = won ? 'VICTORY!' : 'DEFEAT...';
'@ | Set-Content (Join-Path $blocks 'resultsTitle.old') -NoNewline
$content = Replace-Once $content ([IO.File]::ReadAllText((Join-Path $blocks 'resultsTitle.old'))) ([IO.File]::ReadAllText((Join-Path $blocks 'resultsTitle.new'))) 'results title'

$content = Replace-Once $content @"
      const replayBtn = document.getElementById('replay-btn');
      replayBtn.disabled = !raceReplay.finalized || raceReplay.frames.length < 2;
    }

    function uiAnimLoop(timestamp) {
"@ @"
      const replayBtn = document.getElementById('replay-btn');
      replayBtn.disabled = !raceReplay.finalized || raceReplay.frames.length < 2;
      updateResultsContinueButton();
    }

    function uiAnimLoop(timestamp) {
"@ 'results button update'

@'
    document.getElementById('restart-btn').onclick = () => {
      if (gameState.phase === 'results' && hasMoreTracks()) {
        if (isMultiplayer()) {
          multiplayer.socket.emit('host:start-next-training', {}, (res) => {
            if (!res?.ok) return;
            if (res.trackIndex != null) gameState.trackIndex = res.trackIndex;
          });
          return;
        }
        startNextTrainingPhase();
        return;
      }
      stopSetupBgm();
      stopTrainingBgm();
      stopPreRaceBgm();
      stopRaceBgm();
      stopResultsBgm();
      initGame();
      multiplayer.mode = 'solo';
      multiplayer.room = null;
      multiplayer.playerId = null;
      multiplayer.localReady = false;
      multiplayer.racerMeta = {};
      gameState.serverRace = false;
      clearMultiplayerSession();
      multiplayer.reconnectAttempted = false;
      applySelectedRacer(selectedRacerId);
      renderRacerOptions();
      gameState.phase = 'splash';
      showScreen('splash-screen');
    };
'@ | Set-Content (Join-Path $blocks 'restart.new') -NoNewline
@'
    document.getElementById('restart-btn').onclick = () => {
      stopSetupBgm();
      stopTrainingBgm();
      stopPreRaceBgm();
      stopRaceBgm();
      stopResultsBgm();
      initGame();
      multiplayer.mode = 'solo';
      multiplayer.room = null;
      multiplayer.playerId = null;
      multiplayer.localReady = false;
      multiplayer.racerMeta = {};
      gameState.serverRace = false;
      clearMultiplayerSession();
      multiplayer.reconnectAttempted = false;
      applySelectedRacer(selectedRacerId);
      renderRacerOptions();
      gameState.phase = 'splash';
      showScreen('splash-screen');
    };
'@ | Set-Content (Join-Path $blocks 'restart.old') -NoNewline
$content = Replace-Once $content ([IO.File]::ReadAllText((Join-Path $blocks 'restart.old'))) ([IO.File]::ReadAllText((Join-Path $blocks 'restart.new'))) 'restart'

@'
    function endReplay() {
      setReplaySkipVisible(false);
      setRaceSpeedControlsVisible(false);
      resetRaceSpeed();
      stopRaceBgm();
      gameState.replayRacers = null;
      showResults();
    }
'@ | Set-Content (Join-Path $blocks 'endReplay.new') -NoNewline
@'
    function endReplay() {
      setReplaySkipVisible(false);
      setRaceSpeedControlsVisible(false);
      resetRaceSpeed();
      stopRaceBgm();
      gameState.phase = 'results';
      gameState.replayRacers = null;
      showScreen('results-screen');
      playResultsBgm();
    }
'@ | Set-Content (Join-Path $blocks 'endReplay.old') -NoNewline
$content = Replace-Once $content ([IO.File]::ReadAllText((Join-Path $blocks 'endReplay.old'))) ([IO.File]::ReadAllText((Join-Path $blocks 'endReplay.new'))) 'endReplay'

[IO.File]::WriteAllText($index, $content)
Write-Host 'index.html updated for two-track phase'