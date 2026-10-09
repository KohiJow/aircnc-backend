const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { createRoutes } = require('./routes');
const { errorHandler } = require('./middlewares/error-handler');
const { notFound } = require('./middlewares/not-found');
const { requestLogger } = require('./middlewares/request-logger');

// monta o app sem abrir porta nem conectar no banco: o server.js injeta o
// realtime e o database reais, os testes injetam versoes falsas
function createApp({ config, realtime, database }) {
  const app = express();

  app.set('trust proxy', config.trustProxy);
  app.locals.config = config;

  // primeiro de todos, para registrar tambem o que o rate limit e o parser de json barram
  app.use(requestLogger);

  // as imagens de /files sao carregadas pelo front em outra origem,
  // e a politica padrao do helmet (same-origin) bloquearia isso
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(cors({ origin: config.clientUrls.includes('*') ? '*' : config.clientUrls }));

  app.use(
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      limit: config.rateLimitMax,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: req => req.path.startsWith('/files/'),
      handler: (req, res) => res.status(429).json({ error: 'muitas requisicoes, tente de novo em instantes' })
    })
  );

  app.use(express.json({ limit: config.jsonLimit }));

  app.use((req, res, next) => {
    req.realtime = realtime;
    next();
  });

  app.use(createRoutes({ config, database }));

  // arquivos enviados ficam em uploads/ e sao servidos em /files
  app.use('/files', express.static(config.uploadDir, { index: false, dotfiles: 'ignore' }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
