require('dotenv').config({ quiet: true });

const fs = require('fs');
const http = require('http');

const { createApp } = require('./app');
const { loadConfig } = require('./config/env');
const { createDatabase } = require('./lib/database');
const { logger } = require('./lib/logger');
const { createRealtime } = require('./lib/realtime');

const SHUTDOWN_TIMEOUT_MS = 3000;

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
  logger.setLevel(config.logLevel);

  await fs.promises.mkdir(config.uploadDir, { recursive: true });

  const server = http.createServer();
  const realtime = createRealtime(server, config);
  const database = createDatabase(config);
  const app = createApp({ config, realtime, database });
  server.on('request', app);

  // o http sobe antes do banco: /, /ping, /health e /files respondem sempre,
  // as rotas de dominio respondem 503 ate o mongo conectar
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, resolve);
  });
  logger.info(`servidor em http://localhost:${server.address().port} (${config.nodeEnv})`);

  database.connectWithRetry();

  let closing = false;
  async function shutdown(signal) {
    if (closing) return;
    closing = true;
    logger.info(`${signal} recebido, encerrando`);

    // se algo travar no encerramento, sai mesmo assim
    const deadline = setTimeout(() => {
      logger.warn(`encerramento passou de ${SHUTDOWN_TIMEOUT_MS}ms, saindo mesmo assim`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    deadline.unref();

    // io.close() derruba os sockets e fecha o http server que ele envolve
    await realtime.close();
    await database.disconnect();
    process.exit(0);
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(error => {
  logger.error(`falha ao iniciar: ${error.message}`, error.stack);
  process.exit(1);
});
