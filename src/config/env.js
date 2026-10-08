const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

const NODE_ENVS = ['development', 'production', 'test'];
const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'];

// tipos que o verificador de assinatura em lib/upload.js sabe reconhecer
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

class ConfigError extends Error {
  constructor(problems) {
    super(`configuracao invalida:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

function parseInteger(name, raw, fallback, { min, max }, problems) {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    problems.push(`${name} precisa ser um inteiro entre ${min} e ${max} (recebido: "${raw}")`);
    return fallback;
  }
  return value;
}

function parseNumber(name, raw, fallback, { min, max }, problems) {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    problems.push(`${name} precisa ser um numero entre ${min} e ${max} (recebido: "${raw}")`);
    return fallback;
  }
  return value;
}

function parseBoolean(name, raw, fallback, problems) {
  if (raw === undefined || raw === '') return fallback;
  const value = String(raw).trim().toLowerCase();
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  problems.push(`${name} precisa ser true ou false (recebido: "${raw}")`);
  return fallback;
}

function parseList(raw) {
  return String(raw)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseOneOf(name, raw, fallback, allowed, problems) {
  if (raw === undefined || raw === '') return fallback;
  if (!allowed.includes(raw)) {
    problems.push(`${name} precisa ser um de: ${allowed.join(', ')} (recebido: "${raw}")`);
    return fallback;
  }
  return raw;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

// origens do CORS: lista separada por virgula, ou "*" para liberar tudo
function parseOrigins(raw, problems) {
  const origins = parseList(raw);
  if (origins.length === 0) {
    problems.push('CLIENT_URL nao pode ficar vazia');
    return origins;
  }
  if (origins.includes('*')) return ['*'];
  for (const origin of origins) {
    if (!isHttpUrl(origin)) {
      problems.push(`CLIENT_URL contem uma origem invalida: "${origin}"`);
    }
  }
  return origins.map(origin => origin.replace(/\/+$/, ''));
}

function loadConfig(env = process.env) {
  const problems = [];

  const nodeEnv = parseOneOf('NODE_ENV', env.NODE_ENV, 'development', NODE_ENVS, problems);

  const mongoUri = (env.MONGO_URI || '').trim();
  if (!mongoUri) {
    problems.push('MONGO_URI e obrigatoria (copie .env.example para .env e preencha)');
  } else if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    problems.push('MONGO_URI precisa comecar com mongodb:// ou mongodb+srv://');
  }

  const port = parseInteger('PORT', env.PORT, 3333, { min: 0, max: 65535 }, problems);

  let appUrl = (env.APP_URL || '').trim();
  if (!appUrl) {
    appUrl = `http://localhost:${port}`;
  } else if (!isHttpUrl(appUrl)) {
    problems.push(`APP_URL precisa ser uma url http(s) (recebido: "${appUrl}")`);
  }
  appUrl = appUrl.replace(/\/+$/, '');

  const clientUrls = parseOrigins(env.CLIENT_URL || 'http://localhost:5173', problems);
  const trustProxy = parseBoolean('TRUST_PROXY', env.TRUST_PROXY, false, problems);

  const uploadDir = path.resolve(ROOT_DIR, env.UPLOAD_DIR || 'uploads');
  const uploadMaxMb = parseNumber('UPLOAD_MAX_MB', env.UPLOAD_MAX_MB, 2, { min: 0.01, max: 100 }, problems);
  const uploadMimeTypes = parseList(env.UPLOAD_MIME_TYPES || 'image/jpeg,image/png,image/webp');
  for (const type of uploadMimeTypes) {
    if (!SUPPORTED_MIME_TYPES.includes(type)) {
      problems.push(`UPLOAD_MIME_TYPES contem um tipo sem suporte: "${type}" (aceitos: ${SUPPORTED_MIME_TYPES.join(', ')})`);
    }
  }
  if (uploadMimeTypes.length === 0) problems.push('UPLOAD_MIME_TYPES nao pode ficar vazia');

  const rateLimitWindowMs = parseInteger('RATE_LIMIT_WINDOW_MS', env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, { min: 1000, max: 24 * 60 * 60 * 1000 }, problems);
  const rateLimitMax = parseInteger('RATE_LIMIT_MAX', env.RATE_LIMIT_MAX, 300, { min: 1, max: 1000000 }, problems);

  const dbConnectTimeoutMs = parseInteger('DB_CONNECT_TIMEOUT_MS', env.DB_CONNECT_TIMEOUT_MS, 5000, { min: 100, max: 120000 }, problems);
  const dbRetryMs = parseInteger('DB_RETRY_MS', env.DB_RETRY_MS, 10000, { min: 100, max: 600000 }, problems);

  const logLevel = parseOneOf('LOG_LEVEL', env.LOG_LEVEL, nodeEnv === 'test' ? 'silent' : 'info', LOG_LEVELS, problems);

  if (problems.length > 0) throw new ConfigError(problems);

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    mongoUri,
    port,
    appUrl,
    filesUrl: `${appUrl}/files`,
    clientUrls,
    trustProxy,
    uploadDir,
    uploadMaxBytes: Math.round(uploadMaxMb * 1024 * 1024),
    uploadMimeTypes,
    jsonLimit: '100kb',
    rateLimitWindowMs,
    rateLimitMax,
    dbConnectTimeoutMs,
    dbRetryMs,
    logLevel
  };
}

module.exports = { loadConfig, ConfigError };
