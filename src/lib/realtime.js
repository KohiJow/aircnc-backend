const { Server } = require('socket.io');

const { logger } = require('./logger');
const { isObjectId } = require('./object-id');

const roomOf = userId => `user:${userId}`;

// cada socket entra na sala do seu user_id; o socket.io limpa a sala no disconnect,
// entao nao precisa de mapa manual de usuarios conectados
function createRealtime(server, config) {
  const wildcard = config.clientUrls.includes('*');
  const io = new Server(server, {
    cors: {
      origin: wildcard ? '*' : config.clientUrls,
      methods: ['GET', 'POST'],
      credentials: !wildcard
    }
  });

  io.on('connection', socket => {
    const { user_id: userId } = socket.handshake.query;

    if (!isObjectId(userId)) {
      logger.debug(`socket ${socket.id} conectou sem user_id valido`);
      return;
    }

    socket.join(roomOf(userId));
    logger.debug(`user ${userId} conectou no socket ${socket.id}`);

    socket.on('disconnect', () => logger.debug(`socket ${socket.id} desconectou`));
  });

  function connectionsOf(userId) {
    const room = io.sockets.adapter.rooms.get(roomOf(String(userId)));
    return room ? room.size : 0;
  }

  // devolve se havia alguem conectado para receber
  function emitToUser(userId, event, payload) {
    const id = String(userId);
    if (connectionsOf(id) === 0) return false;
    io.to(roomOf(id)).emit(event, payload);
    return true;
  }

  const close = () => new Promise(resolve => io.close(() => resolve()));

  return { io, emitToUser, connectionsOf, close };
}

module.exports = { createRealtime };
