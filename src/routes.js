const express = require('express');

const sessions = require('./controllers/sessions');
const spots = require('./controllers/spots');
const dashboard = require('./controllers/dashboard');
const bookings = require('./controllers/bookings');
const { requireDatabase } = require('./middlewares/require-database');
const { requireUser } = require('./middlewares/require-user');
const { createUpload } = require('./lib/upload');

// o Express 5 encaminha a rejeicao de um handler async para o handler de erro,
// por isso nao ha wrapper em volta dos controllers
function createRoutes({ config, database }) {
  const router = express.Router();
  const upload = createUpload(config);

  router.get('/', (req, res) => res.json({ name: 'aircnc-backend', status: 'ok' }));
  router.get('/ping', (req, res) => res.type('text').send('pong'));
  router.get('/health', (req, res) => {
    const connected = database.isConnected();
    res.json({
      status: connected ? 'ok' : 'degraded',
      database: connected ? 'connected' : 'disconnected',
      uptime: Math.round(process.uptime())
    });
  });

  // so as rotas de dominio dependem do banco; /files e o 404 continuam respondendo sem ele
  const db = requireDatabase(database);

  router.post('/sessions', db, sessions.store);
  router.get('/spots', db, spots.index);
  router.post('/spots', db, requireUser, upload.single('thumbnail'), spots.store);
  router.get('/dashboard', db, requireUser, dashboard.show);
  router.post('/spots/:spot_id/bookings', db, requireUser, bookings.store);
  router.post('/bookings/:booking_id/approvals', db, requireUser, bookings.approve);
  router.post('/bookings/:booking_id/rejections', db, requireUser, bookings.reject);

  return router;
}

module.exports = { createRoutes };
