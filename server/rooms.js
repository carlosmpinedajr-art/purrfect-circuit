const crypto = require('crypto');
const { stopRace } = require('./race-sim');
const { getStartingStatsForRacer } = require('../racer-stats');

const MAX_PLAYERS = 6;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

const rooms = new Map();

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  if (rooms.has(code)) return generateCode();
  return code;
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function createPlayer(socketId, isHost = false) {
  const id = generateToken();
  const racerId = 'purple';
  return {
    id,
    socketId,
    name: '',
    racerId,
    isHost,
    ready: false,
    turn: 1,
    trainingTurn: 1,
    trainingComplete: false,
    stats: getStartingStatsForRacer(racerId),
    raceSkill: null,
    learnedSkills: [],
    campaignPoints: 0,
    connected: true,
    _statDoneThisTurn: false,
    _bonusDoneThisTurn: false
  };
}

function attachSocket(room, player, socketId) {
  if (player.socketId && room.sockets[player.socketId] === player.id) {
    delete room.sockets[player.socketId];
  }
  player.socketId = socketId;
  player.connected = true;
  room.sockets[socketId] = player.id;
}

function serializeRoom(room) {
  const payload = {
    code: room.code,
    phase: room.phase,
    trackIndex: room.trackIndex || 0,
    hostId: room.hostId,
    players: Object.values(room.players).map((p) => ({
      id: p.id,
      name: p.name,
      racerId: p.racerId,
      isHost: p.id === room.hostId,
      ready: p.ready,
      turn: p.turn,
      trainingTurn: p.trainingTurn,
      trainingComplete: p.trainingComplete,
      stats: { ...p.stats },
      raceSkill: p.raceSkill || null,
      learnedSkills: [...(p.learnedSkills || [])],
      campaignPoints: p.campaignPoints || 0,
      connected: p.connected
    }))
  };
  if (room.field?.length) {
    payload.field = room.field.map((entry) => ({
      id: entry.id,
      playerId: entry.playerId,
      name: entry.name,
      stats: { ...entry.stats },
      raceSkill: entry.raceSkill,
      learnedSkills: [...(entry.learnedSkills || [])],
      racerId: entry.racerId,
      cpuStyleId: entry.cpuStyleId || null,
      isHuman: !!entry.isHuman,
      lane: entry.lane,
      animOffset: entry.animOffset || 0
    }));
  }
  return payload;
}

function createRoom(hostSocketId) {
  const code = generateCode();
  const host = createPlayer(hostSocketId, true);
  const room = {
    code,
    hostId: host.id,
    phase: 'lobby',
    trackIndex: 0,
    seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0,
    createdAt: Date.now(),
    field: [],
    race: null,
    raceTimer: null,
    raceResults: null,
    sockets: {
      [hostSocketId]: host.id
    },
    players: {
      [host.id]: host
    }
  };
  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  return rooms.get((code || '').toUpperCase()) || null;
}

function findRoomByPlayer(socketId) {
  for (const room of rooms.values()) {
    const playerId = room.sockets[socketId];
    if (playerId && room.players[playerId]) return room;
  }
  return null;
}

function getPlayerBySocket(room, socketId) {
  const playerId = room.sockets[socketId];
  return playerId ? room.players[playerId] || null : null;
}

function getPlayerToken(room, socketId) {
  return room.sockets[socketId] || null;
}

function joinRoom(code, socketId) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'lobby') {
    return { error: 'Game already started — use your saved session to rejoin' };
  }
  const count = Object.keys(room.players).length;
  if (count >= MAX_PLAYERS) return { error: 'Room is full' };

  const player = createPlayer(socketId, false);
  room.players[player.id] = player;
  attachSocket(room, player, socketId);
  return { room, playerId: player.id };
}

function rejoinRoom(code, token, socketId) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };
  const player = room.players[token];
  if (!player) return { error: 'Session not found — room may have expired' };

  attachSocket(room, player, socketId);
  return { room, playerId: player.id };
}

function disconnectPlayer(socketId) {
  for (const [code, room] of rooms.entries()) {
    const playerId = room.sockets[socketId];
    if (!playerId) continue;

    const player = room.players[playerId];
    delete room.sockets[socketId];
    player.connected = false;
    player.socketId = null;

    if (room.phase === 'lobby') {
      delete room.players[playerId];

      if (Object.keys(room.players).length === 0) {
        stopRace(room);
        rooms.delete(code);
        return { code, deleted: true };
      }

      if (room.hostId === playerId) {
        const nextHost = Object.keys(room.players)[0];
        room.hostId = nextHost;
        room.players[nextHost].isHost = true;
      }
    }

    return { code, room, deleted: false };
  }
  return null;
}

function leaveRoom(socketId) {
  return disconnectPlayer(socketId);
}

function updatePlayerProfile(room, socketId, profile) {
  const player = getPlayerBySocket(room, socketId);
  if (!player) return false;
  if (profile.name) player.name = String(profile.name).trim().slice(0, 12);
  if (profile.racerId) player.racerId = profile.racerId;
  return true;
}

function setPlayerReady(room, socketId, ready) {
  const player = getPlayerBySocket(room, socketId);
  if (!player) return false;
  player.ready = !!ready;
  return true;
}

function allPlayersReady(room) {
  const players = Object.values(room.players);
  if (players.length === 0) return false;
  return players.every((p) => p.connected && p.ready && p.name);
}

function setRoomPhase(room, phase) {
  room.phase = phase;
}

function cleanupStaleRooms() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      stopRace(room);
      rooms.delete(code);
    }
  }
}

setInterval(cleanupStaleRooms, 15 * 60 * 1000);

module.exports = {
  MAX_PLAYERS,
  createRoom,
  getRoom,
  findRoomByPlayer,
  getPlayerBySocket,
  getPlayerToken,
  joinRoom,
  rejoinRoom,
  disconnectPlayer,
  leaveRoom,
  serializeRoom,
  updatePlayerProfile,
  setPlayerReady,
  allPlayersReady,
  setRoomPhase
};