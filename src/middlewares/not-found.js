// qualquer caminho nao mapeado devolve JSON, nao o HTML padrao do Express
function notFound(req, res) {
  res.status(404).json({ error: 'rota nao encontrada' });
}

module.exports = { notFound };
