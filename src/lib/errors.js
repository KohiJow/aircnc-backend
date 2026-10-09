// erro esperado da aplicacao: vira resposta JSON com o status indicado,
// qualquer outro erro vira 500 sem detalhes para o cliente
class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

const badRequest = (message, details) => new AppError(400, message, details);
const unauthorized = message => new AppError(401, message);
const forbidden = message => new AppError(403, message);
const notFound = message => new AppError(404, message);
const conflict = message => new AppError(409, message);
const unsupportedMediaType = message => new AppError(415, message);

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unsupportedMediaType
};
