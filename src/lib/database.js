const mongoose = require('mongoose');

const { logger } = require('./logger');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function createDatabase(config) {
  let stopped = false;
  let wasConnected = false;

  mongoose.connection.on('connected', () => {
    wasConnected = true;
  });
  // a falha da primeira tentativa tambem dispara 'disconnected', e essa ja e logada no retry
  mongoose.connection.on('disconnected', () => {
    if (wasConnected && !stopped) logger.warn('conexao com o MongoDB caiu, as rotas de dominio respondem 503 ate voltar');
  });
  mongoose.connection.on('reconnected', () => logger.info('conexao com o MongoDB restabelecida'));

  async function connect() {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: config.dbConnectTimeoutMs });
    logger.info('conectado ao MongoDB');
  }

  // tenta ate conseguir: o http ja esta no ar, so as rotas de dominio ficam em 503
  async function connectWithRetry() {
    while (!stopped) {
      try {
        await connect();
        return true;
      } catch (error) {
        logger.error(`falha ao conectar no MongoDB: ${error.message} (nova tentativa em ${config.dbRetryMs}ms)`);
        await sleep(config.dbRetryMs);
      }
    }
    return false;
  }

  // com uma tentativa de conexao em andamento o close() do mongoose espera ela
  // terminar (ate DB_CONNECT_TIMEOUT_MS), e nao ha nada para fechar nesse caso
  async function disconnect() {
    stopped = true;
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  }

  const isConnected = () => mongoose.connection.readyState === 1;

  return { connect, connectWithRetry, disconnect, isConnected };
}

module.exports = { createDatabase };
