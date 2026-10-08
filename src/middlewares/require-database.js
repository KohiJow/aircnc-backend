// as rotas de dominio respondem 503 enquanto o mongo nao conectou,
// em vez de deixar a requisicao pendurada esperando o buffer do mongoose
function requireDatabase(database) {
  return (req, res, next) => {
    if (database.isConnected()) return next();
    res.status(503).json({ error: 'banco de dados indisponivel' });
  };
}

module.exports = { requireDatabase };
