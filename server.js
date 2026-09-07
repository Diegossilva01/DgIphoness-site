const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const {
  BOARD_SIZE,
  SHIPS,
  validateFleet,
  createBoardFromFleet,
  getSunkShipId,
  allShipsSunk
} = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/config', (_req, res) => {
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    });
  }
  res.json({ iceServers });
});

function cleanName(value) {
  return String(value || 'Jogador').trim().slice(0, 24) || 'Jogador';
}

function cleanRoomCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function makeRoom(code) {
  const room = {
    code,
    players: [],
    status: 'lobby',
    turnPlayerId: null,
    winnerId: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  rooms.set(code, room);
  return room;
}

function publicRoomState(room) {
  return {
    code: room.code,
    status: room.status,
    playerCount: room.players.length,
    turnPlayerId: room.turnPlayerId,
    winnerId: room.winnerId,
    players: room.players.map((player, index) => ({
      id: player.id,
      name: player.name,
      number: index + 1,
      ready: player.ready,
      connected: player.connected,
      voiceReady: player.voiceReady
    }))
  };
}

function emitRoomState(room) {
  room.updatedAt = Date.now();
  io.to(room.code).emit('room-state', publicRoomState(room));
}

function getMembership(socket) {
  const code = socket.data.roomCode;
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;
  const player = room.players.find(item => item.id === socket.id);
  if (!player) return null;
  return { room, player };
}

function resetRoom(room) {
  room.status = 'lobby';
  room.turnPlayerId = null;
  room.winnerId = null;
  room.players.forEach(player => {
    player.ready = false;
    player.fleet = null;
    player.board = null;
    player.incomingShots = new Set();
  });
}

io.on('connection', socket => {
  socket.on('create-room', ({ name } = {}, callback = () => {}) => {
    const code = generateRoomCode();
    const room = makeRoom(code);
    const player = {
      id: socket.id,
      name: cleanName(name),
      ready: false,
      connected: true,
      voiceReady: false,
      fleet: null,
      board: null,
      incomingShots: new Set()
    };
    room.players.push(player);
    socket.join(code);
    socket.data.roomCode = code;
    callback({ ok: true, code, playerId: socket.id, playerNumber: 1 });
    emitRoomState(room);
  });

  socket.on('join-room', ({ code, name } = {}, callback = () => {}) => {
    const normalized = cleanRoomCode(code);
    const room = rooms.get(normalized);
    if (!room) return callback({ ok: false, error: 'Sala não encontrada.' });
    if (room.players.length >= 2) return callback({ ok: false, error: 'Esta sala já está cheia.' });
    if (room.status !== 'lobby') return callback({ ok: false, error: 'A partida desta sala já começou.' });

    const player = {
      id: socket.id,
      name: cleanName(name),
      ready: false,
      connected: true,
      voiceReady: false,
      fleet: null,
      board: null,
      incomingShots: new Set()
    };
    room.players.push(player);
    socket.join(normalized);
    socket.data.roomCode = normalized;
    callback({ ok: true, code: normalized, playerId: socket.id, playerNumber: 2 });
    socket.to(normalized).emit('opponent-joined', { name: player.name });
    emitRoomState(room);
  });

  socket.on('submit-fleet', ({ fleet } = {}, callback = () => {}) => {
    const membership = getMembership(socket);
    if (!membership) return callback({ ok: false, error: 'Você não está em uma sala.' });
    const { room, player } = membership;
    if (room.status !== 'lobby') return callback({ ok: false, error: 'A partida já começou.' });

    const validation = validateFleet(fleet);
    if (!validation.valid) return callback({ ok: false, error: validation.error });

    player.fleet = fleet.map(ship => ({
      id: ship.id,
      cells: ship.cells.map(cell => ({ row: Number(cell.row), col: Number(cell.col) }))
    }));
    player.board = createBoardFromFleet(player.fleet);
    player.incomingShots = new Set();
    player.ready = true;
    callback({ ok: true });

    if (room.players.length === 2 && room.players.every(item => item.ready)) {
      room.status = 'playing';
      room.winnerId = null;
      room.turnPlayerId = room.players[Math.floor(Math.random() * 2)].id;
      io.to(room.code).emit('game-started', {
        turnPlayerId: room.turnPlayerId,
        ships: SHIPS,
        boardSize: BOARD_SIZE
      });
    }
    emitRoomState(room);
  });

  socket.on('fire', ({ row, col } = {}, callback = () => {}) => {
    const membership = getMembership(socket);
    if (!membership) return callback({ ok: false, error: 'Sala inválida.' });
    const { room, player } = membership;
    if (room.status !== 'playing') return callback({ ok: false, error: 'A partida não está ativa.' });
    if (room.turnPlayerId !== socket.id) return callback({ ok: false, error: 'Aguarde a sua vez.' });

    row = Number(row);
    col = Number(col);
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= BOARD_SIZE || col >= BOARD_SIZE) {
      return callback({ ok: false, error: 'Tiro inválido.' });
    }

    const target = room.players.find(item => item.id !== player.id);
    if (!target || !target.board || !target.fleet) return callback({ ok: false, error: 'Adversário indisponível.' });

    const key = `${row}:${col}`;
    if (target.incomingShots.has(key)) return callback({ ok: false, error: 'Você já atirou nessa posição.' });

    target.incomingShots.add(key);
    const hit = Boolean(target.board[row][col]);
    const sunkShipId = hit ? getSunkShipId(target.fleet, target.incomingShots, row, col) : null;
    const won = hit && allShipsSunk(target.fleet, target.incomingShots);

    const result = {
      row,
      col,
      hit,
      sunkShipId,
      shooterId: player.id,
      targetId: target.id,
      won
    };

    if (won) {
      room.status = 'finished';
      room.winnerId = player.id;
      room.turnPlayerId = null;
    } else {
      room.turnPlayerId = target.id;
    }

    io.to(room.code).emit('shot-result', result);
    callback({ ok: true, ...result });
    emitRoomState(room);
  });

  socket.on('request-rematch', (_payload, callback = () => {}) => {
    const membership = getMembership(socket);
    if (!membership) return callback({ ok: false });
    const { room, player } = membership;
    player.rematch = true;
    io.to(room.code).emit('rematch-status', {
      playerId: player.id,
      requested: true
    });
    if (room.players.length === 2 && room.players.every(item => item.rematch)) {
      room.players.forEach(item => { item.rematch = false; });
      resetRoom(room);
      io.to(room.code).emit('rematch-start');
      emitRoomState(room);
    }
    callback({ ok: true });
  });

  socket.on('voice-ready', ({ ready } = {}) => {
    const membership = getMembership(socket);
    if (!membership) return;
    membership.player.voiceReady = Boolean(ready);
    socket.to(membership.room.code).emit('voice-peer-ready', {
      playerId: socket.id,
      ready: membership.player.voiceReady
    });
    emitRoomState(membership.room);
  });

  socket.on('webrtc-signal', ({ type, data } = {}) => {
    const membership = getMembership(socket);
    if (!membership) return;
    if (!['offer', 'answer', 'ice'].includes(type)) return;
    socket.to(membership.room.code).emit('webrtc-signal', {
      from: socket.id,
      type,
      data
    });
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const room = code && rooms.get(code);
    if (!room) return;

    const index = room.players.findIndex(player => player.id === socket.id);
    if (index === -1) return;
    const [leftPlayer] = room.players.splice(index, 1);
    io.to(code).emit('opponent-left', { name: leftPlayer.name });

    if (room.players.length === 0) {
      rooms.delete(code);
      return;
    }

    resetRoom(room);
    emitRoomState(room);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (room.players.length === 0 || now - room.updatedAt > ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }
}, 30 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`Batalha Naval Online rodando na porta ${PORT}`);
});
