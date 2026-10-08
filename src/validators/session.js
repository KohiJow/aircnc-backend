const { badRequest } = require('../lib/errors');

// aceita o formato geral local@dominio.tld sem tentar cobrir toda a RFC
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateSession(body) {
  const data = body || {};
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';

  if (!email) throw badRequest('dados invalidos', ['email e obrigatorio']);
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    throw badRequest('dados invalidos', ['email invalido']);
  }

  return { email };
}

module.exports = { validateSession };
