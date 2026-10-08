const { badRequest } = require('../lib/errors');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// hoje em UTC, sem horario, para comparar com a data pedida
function todayUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function validateBooking(body, now = new Date()) {
  const data = body || {};
  const raw = typeof data.date === 'string' ? data.date.trim() : '';

  if (!raw) throw badRequest('dados invalidos', ['date e obrigatoria (formato YYYY-MM-DD)']);
  if (!DATE_RE.test(raw)) throw badRequest('dados invalidos', ['date precisa estar no formato YYYY-MM-DD']);

  const date = new Date(`${raw}T00:00:00.000Z`);
  // new Date aceita 2026-02-31 virando 3 de marco, a comparacao de volta pega isso
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    throw badRequest('dados invalidos', ['date nao e um dia valido']);
  }
  if (date < todayUtc(now)) throw badRequest('dados invalidos', ['date nao pode ser no passado']);

  return { date };
}

module.exports = { validateBooking, todayUtc };
