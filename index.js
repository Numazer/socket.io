const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

const messageHistory = [];
const rooms = new Map();
const flip7ModulePromise = import('./games/flip7.js');

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

function createDeck() {
  const deck = [];

  for (let value = 1; value <= 7; value += 1) {
    for (let count = 0; count < 4; count += 1) {
      deck.push({ value });
    }
  }

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

function createRoom(roomId, hostId) {
  return {
    id: roomId,
    hostId,
    status: 'waiting',
    deck: [],
    players: [],
    turnIndex: 0,
    round: 0,
    lastAction: null,
    lastRoundResults: []
  };
}

function createPlayer(socket, name) {
  return {
    id: socket.id,
    name: name || `Joueur-${socket.id.slice(0, 4)}`,
    hand: [],
    score: 0,
    isOut: false,
    hasFlipped7: false,
    hasStopped: false
  };
}

function resetPlayerForRound(player) {
  player.hand = [];
  player.isOut = false;
  player.hasFlipped7 = false;
  player.hasStopped = false;
}

function getCurrentPlayer(room) {
  return room.players[room.turnIndex] || null;
}

function getNextActivePlayerIndex(room, startIndex = room.turnIndex) {
  if (room.players.length === 0) {
    return -1;
  }

  for (let offset = 1; offset <= room.players.length; offset += 1) {
    const candidateIndex = (startIndex + offset) % room.players.length;
    const candidate = room.players[candidateIndex];

    if (candidate && !candidate.isOut && !candidate.hasStopped) {
      return candidateIndex;
    }
  }

  return -1;
}

function areAllPlayersDone(room) {
  return room.players.every(player => player.isOut || player.hasStopped || player.hasFlipped7);
}

function serializeRoom(room) {
  return {
    id: room.id,
    hostId: room.hostId,
    status: room.status,
    round: room.round,
    currentPlayerId: room.status === 'playing' ? getCurrentPlayer(room)?.id ?? null : null,
    deckCount: room.deck.length,
    lastAction: room.lastAction,
    lastRoundResults: room.lastRoundResults,
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      score: player.score,
      isOut: player.isOut,
      hasFlipped7: player.hasFlipped7,
      hasStopped: player.hasStopped,
      handSize: player.hand.length,
      handValues: player.hand.map(card => card.value)
    }))
  };
}

function emitRoomState(room) {
  io.to(room.id).emit('room:update', serializeRoom(room));
}

async function finishRound(room, reason) {
  const { calculateScore, endRound } = await flip7ModulePromise;

  room.lastRoundResults = room.players.map(player => ({
    id: player.id,
    name: player.name,
    handValues: player.hand.map(card => card.value),
    isOut: player.isOut,
    hasFlipped7: player.hasFlipped7,
    pointsWon: player.isOut ? 0 : calculateScore(player)
  }));

  endRound(room.players);
  room.status = 'waiting';
  room.deck = [];
  room.turnIndex = 0;
  room.lastAction = reason;

  room.players.forEach(player => {
    player.hasStopped = false;
    player.hasFlipped7 = false;
    player.isOut = false;
  });

  emitRoomState(room);
}

async function advanceTurnOrFinish(room, reason) {
  if (room.players.length === 0) {
    return;
  }

  if (areAllPlayersDone(room)) {
    await finishRound(room, reason);
    return;
  }

  const nextIndex = getNextActivePlayerIndex(room);
  if (nextIndex === -1) {
    await finishRound(room, reason);
    return;
  }

  room.turnIndex = nextIndex;
}

function getSocketRoom(socket) {
  const roomId = socket.data.roomId;
  return roomId ? rooms.get(roomId) : null;
}

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.emit('history', messageHistory);

  socket.on('chat message', (msg) => {
    if (msg.startsWith('/')) {
      const parts = msg.split(' ');

      if (parts[0] === '/somme') {
        const a = parseFloat(parts[1]);
        const b = parseFloat(parts[2]);
        const text = !isNaN(a) && !isNaN(b) ? `${a + b}` : 'Erreur: nombres invalides';
        socket.emit('chat message', { user: 'SYSTEM', text });
        return;
      }

      if (parts[0] === '/history') {
        messageHistory.forEach(m => socket.emit('chat message', m));
        return;
      }

      if (parts[0] === '/getLastComment') {
        const target = parts[1];
        const last = messageHistory.filter(m => m.user === target).slice(-1)[0];
        const text = last ? last.text : 'Aucun message';
        socket.emit('chat message', { user: 'SYSTEM', text });
        return;
      }

      socket.emit('chat message', { user: 'SYSTEM', text: 'Commande inconnue' });
      return;
    }

    const newMessage = {
      user: socket.id,
      text: msg
    };

    messageHistory.push(newMessage);
    io.emit('chat message', newMessage);
  });

  socket.on('room:join', ({ roomId, name }) => {
    const normalizedRoomId = String(roomId || '').trim().toUpperCase();

    if (!normalizedRoomId) {
      socket.emit('room:error', 'Le code de room est obligatoire.');
      return;
    }

    const previousRoom = getSocketRoom(socket);
    if (previousRoom) {
      previousRoom.players = previousRoom.players.filter(player => player.id !== socket.id);
      socket.leave(previousRoom.id);

      if (previousRoom.hostId === socket.id) {
        previousRoom.hostId = previousRoom.players[0]?.id ?? null;
      }

      if (previousRoom.players.length === 0) {
        rooms.delete(previousRoom.id);
      } else {
        emitRoomState(previousRoom);
      }
    }

    const room = rooms.get(normalizedRoomId) || createRoom(normalizedRoomId, socket.id);

    if (!rooms.has(normalizedRoomId)) {
      rooms.set(normalizedRoomId, room);
    }

    if (room.status === 'playing' && !room.players.some(player => player.id === socket.id)) {
      socket.emit('room:error', 'Une manche est deja en cours dans cette room.');
      return;
    }

    if (!room.players.some(player => player.id === socket.id)) {
      room.players.push(createPlayer(socket, name));
    }

    socket.data.roomId = normalizedRoomId;
    socket.join(normalizedRoomId);

    room.lastAction = `${name || socket.id} a rejoint la room.`;
    emitRoomState(room);
  });

  socket.on('room:start-game', async () => {
    const room = getSocketRoom(socket);

    if (!room) {
      socket.emit('room:error', 'Tu dois rejoindre une room avant de lancer une partie.');
      return;
    }

    if (room.hostId !== socket.id) {
      socket.emit('room:error', 'Seul l’hôte peut lancer la partie.');
      return;
    }

    if (room.players.length === 0) {
      socket.emit('room:error', 'Aucun joueur dans la room.');
      return;
    }

    room.status = 'playing';
    room.round += 1;
    room.deck = createDeck();
    room.turnIndex = 0;
    room.lastRoundResults = [];
    room.lastAction = `Manche ${room.round} lancee.`;

    room.players.forEach(resetPlayerForRound);

    emitRoomState(room);
  });

  socket.on('flip7:draw', async () => {
    const room = getSocketRoom(socket);

    if (!room || room.status !== 'playing') {
      socket.emit('room:error', 'Aucune manche en cours.');
      return;
    }

    const player = getCurrentPlayer(room);
    if (!player || player.id !== socket.id) {
      socket.emit('room:error', 'Ce n’est pas ton tour.');
      return;
    }

    const { playTurn } = await flip7ModulePromise;

    playTurn(player, room.deck);

    if (player.isOut) {
      room.lastAction = `${player.name} a pioche un doublon et est elimine.`;
      await advanceTurnOrFinish(room, room.lastAction);
      emitRoomState(room);
      return;
    }

    if (player.hasFlipped7) {
      room.lastAction = `${player.name} a realise un Flip7 !`;
      await finishRound(room, room.lastAction);
      return;
    }

    room.lastAction = `${player.name} a pioche une carte.`;
    await advanceTurnOrFinish(room, room.lastAction);
    emitRoomState(room);
  });

  socket.on('flip7:stand', async () => {
    const room = getSocketRoom(socket);

    if (!room || room.status !== 'playing') {
      socket.emit('room:error', 'Aucune manche en cours.');
      return;
    }

    const player = getCurrentPlayer(room);
    if (!player || player.id !== socket.id) {
      socket.emit('room:error', 'Ce n’est pas ton tour.');
      return;
    }

    player.hasStopped = true;
    room.lastAction = `${player.name} s'arrete.`;

    await advanceTurnOrFinish(room, room.lastAction);
    emitRoomState(room);
  });

  socket.on('disconnect', async () => {
    console.log('user disconnected');

    const room = getSocketRoom(socket);
    if (!room) {
      return;
    }

    const removedIndex = room.players.findIndex(player => player.id === socket.id);
    room.players = room.players.filter(player => player.id !== socket.id);

    if (room.players.length === 0) {
      rooms.delete(room.id);
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
    }

    if (room.turnIndex >= room.players.length) {
      room.turnIndex = 0;
    } else if (removedIndex !== -1 && removedIndex < room.turnIndex) {
      room.turnIndex -= 1;
    }

    if (room.status === 'playing' && areAllPlayersDone(room)) {
      await finishRound(room, 'La manche se termine apres une deconnexion.');
      return;
    }

    room.lastAction = `${socket.id} a quitte la room.`;
    emitRoomState(room);
  });
});

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
