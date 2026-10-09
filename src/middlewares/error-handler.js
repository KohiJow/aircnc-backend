const { AppError } = require('../lib/errors');
const { logger } = require('../lib/logger');

// traduz qualquer erro para { status, body }; funcao pura para ser testavel sem http
function translateError(err, { exposeDetails }) {
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.details !== undefined) body.details = err.details;
    return { status: err.status, body, expected: true };
  }

  // express.json: corpo que nao e JSON ou maior que o limite
  if (err.type === 'entity.parse.failed') {
    return { status: 400, body: { error: 'JSON invalido no corpo da requisicao' }, expected: true };
  }
  if (err.type === 'entity.too.large') {
    return { status: 413, body: { error: 'corpo da requisicao muito grande' }, expected: true };
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return { status: 413, body: { error: 'arquivo maior que o limite permitido' }, expected: true };
    }
    return { status: 400, body: { error: 'upload invalido', details: [err.message] }, expected: true };
  }

  if (err.name === 'CastError') {
    return { status: 400, body: { error: 'id invalido' }, expected: true };
  }
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map(item => item.message);
    return { status: 400, body: { error: 'dados invalidos', details }, expected: true };
  }
  if (err.code === 11000) {
    return { status: 409, body: { error: 'registro duplicado' }, expected: true };
  }
  if (err.name === 'MongooseServerSelectionError' || err.name === 'MongoNetworkError' || err.name === 'MongoNotConnectedError') {
    return { status: 503, body: { error: 'banco de dados indisponivel' }, expected: false };
  }

  const body = { error: 'erro interno no servidor' };
  if (exposeDetails) {
    body.details = err.message;
    body.stack = err.stack;
  }
  return { status: 500, body, expected: false };
}

function errorHandler(err, req, res, next) {
  const config = req.app.locals.config || {};
  const { status, body, expected } = translateError(err, { exposeDetails: !config.isProduction });

  if (!expected) {
    logger.error(`${req.method} ${req.originalUrl} -> ${status}: ${err.message}`, err.stack);
  } else {
    logger.debug(`${req.method} ${req.originalUrl} -> ${status}: ${err.message}`);
  }

  // com a resposta ja iniciada so o handler padrao do express consegue fechar a conexao
  if (res.headersSent) return next(err);
  res.status(status).json(body);
}

module.exports = { errorHandler, translateError };
