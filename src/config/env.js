const net = require('net');
const path = require('path');

const { SUPPORTED_MIME_TYPES } = require('../lib/upload');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

const NODE_ENVS = ['development', 'production', 'test'];
const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'];

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

// nomes que o express aceita no trust proxy, alem de ips e redes em CIDR
const PROXY_NAMES = ['loopback', 'linklocal', 'uniquelocal'];

function isProxyAddress(item) {
  if (PROXY_NAMES.includes(item)) return true;
  const [address, prefix, extra] = item.split('/');
  if (extra !== undefined || !net.isIP(address)) return false;
  return prefix === undefined || /^\d{1,3}$/.test(prefix);
}

// trust proxy = true confia em qualquer X-Forwarded-For e deixa o cliente escolher
// o proprio ip no rate limit, por isso so entra o numero de proxies ou a lista deles
function parseTrustProxy(raw, problems) {
  if (raw === undefined || raw.trim() === '') return false;
  const value = raw.trim().toLowerCase();
  if (value === 'false') return false;
  if (value === 'true') {
    problems.push('TRUST_PROXY=true confia em qualquer X-Forwarded-For e deixa burlar o rate limit: use o numero de proxies na frente da api (ex.: 1) ou a lista de ips/redes');
    return false;
  }
  if (/^\d+$/.test(value)) return Number(value);
  const list = parseList(raw);
  const invalid = list.find(item => !isProxyAddress(item));
  if (invalid !== undefined) {
    problems.push(`TRUST_PROXY contem um valor invalido: "${invalid}" (aceitos: false, numero de proxies, ou lista de ips, redes CIDR, loopback, linklocal, uniquelocal)`);
    return false;
  }
  return list;
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
  const appUrlFromEnv = appUrl !== '';
  if (!appUrlFromEnv) {
    appUrl = `http://localhost:${port}`;
  } else if (!isHttpUrl(appUrl)) {
    problems.push(`APP_URL precisa ser uma url http(s) (recebido: "${appUrl}")`);
  }
  appUrl = appUrl.replace(/\/+$/, '');

  const clientUrls = parseOrigins(env.CLIENT_URL || 'http://localhost:5173', problems);
  const trustProxy = parseTrustProxy(env.TRUST_PROXY, problems);

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
    appUrlFromEnv,
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

// com PORT=0 a porta so existe depois do listen: se APP_URL nao foi dada,
// monta appUrl e filesUrl com a porta que o sistema escolheu
function withListeningPort(config, port) {
  if (config.appUrlFromEnv || config.port !== 0) return config;
  const appUrl = `http://localhost:${port}`;
  return { ...config, appUrl, filesUrl: `${appUrl}/files` };
}

module.exports = { loadConfig, withListeningPort, ConfigError };
