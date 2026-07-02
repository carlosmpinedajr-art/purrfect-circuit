const path = require('path');
const os = require('os');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const {
  createRoom,
  joinRoom,
  rejoinRoom,
  disconnectPlayer,
  serializeRoom,
  updatePlayerProfile,
  setPlayerReady,
  allPlayersReady,
  setRoomPhase,
  findRoomByPlayer,
  getPlayerBySocket,
  getPlayerToken,
  leaveRoom
} = require('./rooms');
const {
  initRoomTraining,
  initRoomTrainingPhase2,
  resetRoomForPlayAgain,
  trainStat,
  pickSkill,
  pickBonus,
  advanceTrainingTurn,
  allTrainingComplete
} = require('./training');
const { hasMoreTracks } = require('../tracks');
const { buildRaceScoring } = require('../scoring');
const {
  buildLineupField,
  createRaceState,
  raceTick,
  serializeRaceStart,
  serializeRaceTick,
  serializeRaceResults,
  serializeRaceSync,
  skipRace,
  stopRace
} = require('./race-sim');

const RACE_TICK_MS = 50;
const RACE_TICK_DT = 0.05;

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'purrfect-circuit' });
});

app.use(express.static(ROOT));

function broadcastRoom(room) {
  io.to(room.code).emit('room:updated', serializeRoom(room));
}

function attachToRoom(socket, room) {
  socket.join(room.code);
  socket.data.roomCode = room.code;
}

function buildSyncPayload(room) {
  const sync = { phase: room.phase };
  if (room.phase === 'race' || room.phase === 'results') {
    sync.race = serializeRaceSync(room);
    if (room.raceResults) sync.results = room.raceResults;
  }
  return sync;
}

function finishRace(room) {
  stopRace(room);
  if (room.race) {
    room.raceResults = {
      ...serializeRaceResults(room.race),
      ...buildRaceScoring(room, room.race)
    };
  }
  setRoomPhase(room, 'results');
  io.to(room.code).emit('race:finished', room.raceResults);
  broadcastRoom(room);
}

io.on('connection', (socket) => {
  socket.on('room:create', (ack) => {
    const room = createRoom(socket.id);
    attachToRoom(socket, room);
    const playerId = getPlayerToken(room, socket.id);
    const payload = { ok: true, ...serializeRoom(room), playerId };
    if (typeof ack === 'function') ack(payload);
    broadcastRoom(room);
  });

  socket.on('room:join', (data, ack) => {
    const code = (data?.code || '').toUpperCase();
    const result = joinRoom(code, socket.id);
    if (result.error) {
      if (typeof ack === 'function') ack({ ok: false, error: result.error });
      return;
    }
    attachToRoom(socket, result.room);
    if (typeof ack === 'function') {
      ack({ ok: true, ...serializeRoom(result.room), playerId: result.playerId });
    }
    broadcastRoom(result.room);
  });

  socket.on('room:rejoin', (data, ack) => {
    const code = (data?.code || '').toUpperCase();
    const token = data?.token || '';
    const result = rejoinRoom(code, token, socket.id);
    if (result.error) {
      if (typeof ack === 'function') ack({ ok: false, error: result.error });
      return;
    }
    attachToRoom(socket, result.room);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        ...serializeRoom(result.room),
        playerId: result.playerId,
        sync: buildSyncPayload(result.room)
      });
    }
    broadcastRoom(result.room);
  });

  socket.on('player:profile', (data, ack) => {
    const room = findRoomByPlayer(socket.id);
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not in a room' });
      return;
    }
    updatePlayerProfile(room, socket.id, data || {});
    if (typeof ack === 'function') ack({ ok: true });
    broadcastRoom(room);
  });

  socket.on('player:ready', (data, ack) => {
    const room = findRoomByPlayer(socket.id);
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not in a room' });
      return;
    }
    setPlayerReady(room, socket.id, data?.ready !== false);
    if (typeof ack === 'function') ack({ ok: true });
    broadcastRoom(room);
  });

  socket.on('host:start-training', (ack) => {
    const room = findRoomByPlayer(socket.id);
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not in a room' });
      return;
    }
    if (room.hostId !== getPlayerToken(room, socket.id)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Only the host can start' });
      return;
    }
    if (!allPlayersReady(room)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'All players must be ready' });
      return;
    }
    initRoomTraining(room);
    setRoomPhase(room, 'training');
    broadcastRoom(room);
    io.to(room.code).emit('room:phase', { phase: 'training' });
    if (typeof ack === 'function') ack({ ok: true });
  });

  function maybeStartLineup(room) {
    if (room.phase !== 'training' || !allTrainingComplete(room)) return;
    buildLineupField(room);
    setRoomPhase(room, 'lineup');
    broadcastRoom(room);
    io.to(room.code).emit('room:phase', { phase: 'lineup' });
  }

  function startRaceLoop(room) {
    stopRace(room);
    room.race = createRaceState(room);
    room.raceResults = null;
    setRoomPhase(room, 'race');
    io.to(room.code).emit('race:started', serializeRaceStart(room, room.race));
    broadcastRoom(room);

    room.raceTimer = setInterval(() => {
      try {
        if (!room.race?.running) return;
        const events = raceTick(room.race, RACE_TICK_DT);
        io.to(room.code).emit('race:tick', serializeRaceTick(room.race, events));
        if (room.race.finished) {
          finishRace(room);
        }
      } catch (err) {
        console.error('race tick error:', err);
        finishRace(room);
      }
    }, RACE_TICK_MS);
  }

  socket.on('training:train-stat', (data, ack) => {
    const room = findRoomByPlayer(socket.id);
    if (!room || room.phase !== 'training') {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not in training' });
      return;
    }
    const player = getPlayerBySocket(room, socket.id);
    const result = trainStat(player, data?.stat);
    if (result.error) {
      if (typeof ack === 'function') ack({ ok: false, error: result.error });
      return;
    }
    broadcastRoom(room);
    if (typeof ack === 'function') {
      ack({ ok: true, next: result.next, skillChoices: result.skillChoices || null });
    }
  });

  socket.on('training:pick-skill', (data, ack) => {
    const room = findRoomByPlayer(socket.id);
    if (!room || room.phase !== 'training') {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not in training' });
      return;
    }
    const player = getPlayerBySocket(room, socket.id);
    const result = pickSkill(player, data?.skillId);
    if (result.error) {
      if (typeof ack === 'function') ack({ ok: false, error: result.error });
      return;
    }
    broadcastRoom(room);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        skillGranted: result.skillGranted,
        next: result.next,
        skillChoices: result.skillChoices || null
      });
    }
  });

  socket.on('training:pick-bonus', (data, ack) => {
    const room = findRoomByPlayer(socket.id);
    if (!room || room.phase !== 'training') {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not in training' });
      return;
    }
    const player = getPlayerBySocket(room, socket.id);
    const result = pickBonus(player, data?.stat);
    if (result.error) {
      if (typeof ack === 'function') ack({ ok: false, error: result.error });
      return;
    }
    broadcastRoom(room);
    if (typeof ack === 'function') ack({ ok: true, next: result.next });
  });

  socket.on('training:advance-turn', (data, ack) => {
    const room = findRoomByPlayer(socket.id);
    if (!room || room.phase !== 'training') {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not in training' });
      return;
    }
    const player = getPlayerBySocket(room, socket.id);
    const result = advanceTrainingTurn(player);
    if (result.error) {
      if (typeof ack === 'function') ack({ ok: false, error: result.error });
      return;
    }
    broadcastRoom(room);
    if (typeof ack === 'function') ack({ ok: true, complete: result.complete });
    maybeStartLineup(room);
  });

  socket.on('host:play-again', (ack) => {
    const room = findRoomByPlayer(socket.id);
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not in a room' });
      return;
    }
    if (room.hostId !== getPlayerToken(room, socket.id)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Only the host can restart' });
      return;
    }
    if (room.phase !== 'results') {
      if (typeof ack === 'function') ack({ ok: false, error: 'Can only play again after race results' });
      return;
    }
    stopRace(room);
    resetRoomForPlayAgain(room);
    setRoomPhase(room, 'lobby');
    broadcastRoom(room);
    io.to(room.code).emit('room:phase', { phase: 'lobby', trackIndex: 0 });
    if (typeof ack === 'function') ack({ ok: true, room: serializeRoom(room) });
  });

  socket.on('room:leave', (ack) => {
    const room = findRoomByPlayer(socket.id);
    if (!room) {
      if (typeof ack === 'function') ack({ ok: true });
      return;
    }
    const code = room.code;
    leaveRoom(socket.id);
    socket.leave(code);
    delete socket.data.roomCode;
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('host:start-next-training', (ack) => {
    const room = findRoomByPlayer(socket.id);
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not in a room' });
      return;
    }
    if (room.hostId !== getPlayerToken(room, socket.id)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Only the host can continue' });
      return;
    }
    if (room.phase !== 'results') {
      if (typeof ack === 'function') ack({ ok: false, error: 'Can only continue after race results' });
      return;
    }
    if (!hasMoreTracks(room.trackIndex || 0)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'No more tracks in this event' });
      return;
    }
    room.trackIndex = (room.trackIndex || 0) + 1;
    room.field = [];
    room.raceResults = null;
    initRoomTrainingPhase2(room);
    setRoomPhase(room, 'training');
    broadcastRoom(room);
    io.to(room.code).emit('room:phase', { phase: 'training', trackIndex: room.trackIndex });
    if (typeof ack === 'function') {
      ack({ ok: true, trackIndex: room.trackIndex, room: serializeRoom(room) });
    }
  });

  socket.on('host:start-race', (ack) => {
    const room = findRoomByPlayer(socket.id);
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not in a room' });
      return;
    }
    if (room.hostId !== getPlayerToken(room, socket.id)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Only the host can start the race' });
      return;
    }
    if (room.phase !== 'lineup') {
      if (typeof ack === 'function') ack({ ok: false, error: 'Race can only start from the lineup' });
      return;
    }
    if (!room.field?.length) {
      buildLineupField(room);
    }
    startRaceLoop(room);
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('host:skip-race', (ack) => {
    const room = findRoomByPlayer(socket.id);
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not in a room' });
      return;
    }
    if (room.hostId !== getPlayerToken(room, socket.id)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Only the host can skip' });
      return;
    }
    if (room.phase !== 'race' || !room.race?.running) {
      if (typeof ack === 'function') ack({ ok: false, error: 'No active race' });
      return;
    }
    const result = skipRace(room.race);
    io.to(room.code).emit('race:tick', serializeRaceTick(room.race, result.events));
    finishRace(room);
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('disconnect', () => {
    const result = disconnectPlayer(socket.id);
    if (!result || result.deleted) return;
    broadcastRoom(result.room);
  });
});

function logListenUrls(port) {
  console.log(`Purrfect Circuit server running at http://localhost:${port}`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  Friends on your network: http://${net.address}:${port}`);
      }
    }
  }
  console.log('Share that URL + your room code so friends can join.');
}

const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  logListenUrls(PORT);
});