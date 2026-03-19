const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require("socket.io");

const app = express();
const server = createServer(app);
const io = new Server(server);

const messageHistory = [];

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.emit('history', messageHistory);

  socket.broadcast.emit('hi');

  socket.on('chat message', (msg) => {

    if (msg.startsWith("/")) {

      const parts = msg.split(" ");

      if (parts[0] === "/somme") {
        const a = parseFloat(parts[1]);
        const b = parseFloat(parts[2]);
        const text = (!isNaN(a) && !isNaN(b)) ? `${a + b}` : "Erreur: nombres invalides";
        socket.emit('chat message', { user: "SYSTEM", text });
        return;
      }

      if (parts[0] === "/history") {
        messageHistory.forEach(m => socket.emit('chat message', m));
        return;
      }

      if (parts[0] === "/getLastComment") {
        const target = parts[1];
        const last = messageHistory.filter(m => m.user === target).slice(-1)[0];
        const text = last ? last.text : "Aucun message";
        socket.emit('chat message', { user: "SYSTEM", text });
        return;
      }

      socket.emit('chat message', { user: "SYSTEM", text: "Commande inconnue" });
      return;
    }

    const newMessage = {
      user: socket.id,
      text: msg
    };

    messageHistory.push(newMessage);

    io.emit('chat message', newMessage);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});