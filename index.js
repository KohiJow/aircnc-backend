require('dotenv').config();

const http = require('http');
const path = require('path');

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const PORT = process.env.PORT || 3333;

const io = socketio(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// socket.id de cada usuario conectado, indexado por user_id
const connectedUsers = {};

io.on('connection', socket => {
  const { user_id } = socket.handshake.query;

  if (!user_id) {
    console.log(`socket ${socket.id} conectou sem user_id`);
    return;
  }

  if (!connectedUsers[user_id]) {
    connectedUsers[user_id] = [];
  }
  connectedUsers[user_id].push(socket.id);
  console.log(`user ${user_id} conectou no socket ${socket.id}`);

  socket.on('disconnect', () => {
    const sockets = connectedUsers[user_id] || [];
    const index = sockets.indexOf(socket.id);
    if (index !== -1) sockets.splice(index, 1);
    if (sockets.length === 0) delete connectedUsers[user_id];
    console.log(`socket ${socket.id} desconectou`);
  });
});

app.use(express.json());
app.use(cors({ origin: CLIENT_URL }));

// deixa io e connectedUsers disponiveis em qualquer rota
app.use((req, res, next) => {
  req.io = io;
  req.connectedUsers = connectedUsers;
  next();
});

app.get('/', (req, res) => res.json({ name: 'aircnc-backend', status: 'ok' }));

app.get('/ping', (req, res) => res.send('pong'));

// arquivos enviados ficam em uploads/ e sao servidos em /files
app.use('/files', express.static(path.resolve(__dirname, 'uploads')));

// qualquer caminho nao mapeado devolve JSON, nao o HTML padrao do Express
app.use((req, res) => {
  res.status(404).json({ error: 'rota nao encontrada' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'erro interno no servidor' });
});

async function connectDatabase() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI nao definida: copie .env.example para .env');
  }

  await mongoose.connect(uri);
  console.log('conectado ao MongoDB');
}

// so sobe o servidor quando o arquivo e executado direto,
// assim o app pode ser importado por um teste sem abrir porta nem banco
if (require.main === module) {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI nao definida: copie .env.example para .env');
    process.exit(1);
  }

  connectDatabase()
    .then(() => {
      server.listen(PORT, () => console.log(`servidor em http://localhost:${PORT}`));
    })
    .catch(error => {
      console.error('falha ao conectar no MongoDB:', error.message);
      process.exit(1);
    });
}

module.exports = { app, server, io, connectedUsers, connectDatabase };
