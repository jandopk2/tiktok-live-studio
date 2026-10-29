const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);

// Configurar Socket.IO con CORS abierto para producción
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Servir la carpeta 'public' de manera explícita
app.use(express.static(path.join(__dirname, 'public')));

let tiktokConnection = null;

io.on('connection', (socket) => {
  console.log(`[WebSocket] Cliente conectado: ${socket.id}`);

  socket.on('connect-tiktok', (username) => {
    if (tiktokConnection) {
      try {
        tiktokConnection.disconnect();
      } catch (e) {
        console.log('Desconectando sesión previa...');
      }
    }

    tiktokConnection = new WebcastPushConnection(username);

    tiktokConnection.connect()
      .then(state => {
        socket.emit('status', { success: true, message: `Conectado exitosamente al Live de @${username}` });
      })
      .catch(err => {
        socket.emit('status', { success: false, message: `Error de conexión: ${err.message}` });
      });

    // Eventos del Live
    tiktokConnection.on('chat', data => {
      io.emit('tiktok-chat', {
        user: data.nickname,
        uniqueId: data.uniqueId,
        comment: data.comment,
        avatar: data.profilePictureUrl
      });
    });

    tiktokConnection.on('gift', data => {
      if (data.giftType === 1 && data.repeatEnd === false) return;
      io.emit('tiktok-alert', {
        type: 'GIFT',
        title: '¡NUEVO REGALO!',
        user: data.nickname,
        details: `Envió ${data.repeatCount}x ${data.giftName} 🎁`
      });
    });

    tiktokConnection.on('follow', data => {
      io.emit('tiktok-alert', {
        type: 'FOLLOW',
        title: '¡NUEVO SEGUIDOR!',
        user: data.nickname,
        details: '¡Se ha unido a la transmisión!'
      });
    });
  });

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Cliente desconectado: ${socket.id}`);
  });
});

// Utilizar el puerto del sistema asignado por el servidor en la nube o 3000 para pruebas locales
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de Live Studio ejecutándose en el puerto ${PORT}`);
});
