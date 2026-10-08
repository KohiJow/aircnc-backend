const { badRequest } = require('../lib/errors');

const MAX_COMPANY = 120;
const MAX_TECHS = 20;
const MAX_TECH_LENGTH = 40;

// techs chega como "React, Node" num form multipart ou como array num JSON
function parseTechs(raw) {
  if (Array.isArray(raw)) return raw.map(item => String(item).trim()).filter(Boolean);
  if (typeof raw === 'string') return raw.split(',').map(item => item.trim()).filter(Boolean);
  return [];
}

function validateSpot(body, file) {
  const data = body || {};
  const errors = [];

  if (!file) errors.push('thumbnail e obrigatoria (campo de arquivo "thumbnail")');

  const company = typeof data.company === 'string' ? data.company.trim() : '';
  if (!company) errors.push('company e obrigatoria');
  else if (company.length > MAX_COMPANY) errors.push(`company pode ter no maximo ${MAX_COMPANY} caracteres`);

  const techs = parseTechs(data.techs);
  if (techs.length === 0) errors.push('techs e obrigatoria (lista separada por virgula)');
  else if (techs.length > MAX_TECHS) errors.push(`techs pode ter no maximo ${MAX_TECHS} itens`);
  else if (techs.some(tech => tech.length > MAX_TECH_LENGTH)) {
    errors.push(`cada tech pode ter no maximo ${MAX_TECH_LENGTH} caracteres`);
  }

  // preco vazio significa spot gratuito
  let price;
  if (data.price !== undefined && data.price !== null && String(data.price).trim() !== '') {
    price = Number(data.price);
    if (!Number.isFinite(price) || price < 0) errors.push('price precisa ser um numero maior ou igual a zero');
  }

  if (errors.length > 0) throw badRequest('dados invalidos', errors);

  return { company, techs, price };
}

function validateTechFilter(query) {
  const raw = (query || {}).tech;
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') throw badRequest('dados invalidos', ['tech precisa ser um texto']);
  const tech = raw.trim();
  if (!tech) return undefined;
  if (tech.length > MAX_TECH_LENGTH) {
    throw badRequest('dados invalidos', [`tech pode ter no maximo ${MAX_TECH_LENGTH} caracteres`]);
  }
  return tech;
}

module.exports = { validateSpot, validateTechFilter, parseTechs };
