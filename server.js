const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Servir archivos estáticos de la carpeta 'public'
app.use(express.static('public'));

let tiktokConnection = null;

io.on('connection', (socket) => {
  console.log('Estudio conectado vía WebSocket ID:', socket.id);

  // Evento para iniciar conexión con un usuario de TikTok
  socket.on('connect-tiktok', (username) => {
    if (tiktokConnection) {
      tiktokConnection.disconnect();
    }

    // Crear la conexión a la transmisión en vivo pública
    tiktokConnection = new WebcastPushConnection(username);

    tiktokConnection.connect().then(state => {
      socket.emit('status', { success: true, message: `Conectado al Live de @${username}` });
    }).catch(err => {
      socket.emit('status', { success: false, message: `Error de conexión: ${err.message}` });
    });

    // 1. Escuchar Comentarios del Chat
    tiktokConnection.on('chat', data => {
      io.emit('tiktok-chat', {
        user: data.nickname,
        uniqueId: data.uniqueId,
        comment: data.comment,
        avatar: data.profilePictureUrl
      });
    });

    // 2. Escuchar Regalos
    tiktokConnection.on('gift', data => {
      // Filtrar ráfagas de regalos intermedias
      if (data.giftType === 1 && data.repeatEnd === false) return;

      io.emit('tiktok-alert', {
        type: 'GIFT',
        title: '¡NUEVO REGALO!',
        user: data.nickname,
        details: `Envió ${data.repeatCount}x ${data.giftName} 🎁`,
        diamonds: data.diamondCount * data.repeatCount
      });
    });

    // 3. Escuchar Nuevos Seguidores
    tiktokConnection.on('follow', data => {
      io.emit('tiktok-alert', {
        type: 'FOLLOW',
        title: '¡NUEVO SEGUIDOR!',
        user: data.nickname,
        details: '¡Se ha unido a la comunidad!'
      });
    });

    // 4. Escuchar Me Gusta / Niveles
    tiktokConnection.on('like', data => {
      io.emit('tiktok-like', {
        user: data.nickname,
        totalLikes: data.totalLikeCount
      });
    });
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor Live Studio activo en http://localhost:${PORT}`);
});
