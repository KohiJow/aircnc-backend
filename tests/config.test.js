const path = require('path');

const { loadConfig, ConfigError } = require('../src/config/env');

const valid = { MONGO_URI: 'mongodb://localhost:27017/aircnc' };

describe('loadConfig', () => {
  test('usa os padroes quando so MONGO_URI e informada', () => {
    const config = loadConfig(valid);

    expect(config.nodeEnv).toBe('development');
    expect(config.isProduction).toBe(false);
    expect(config.port).toBe(3333);
    expect(config.appUrl).toBe('http://localhost:3333');
    expect(config.filesUrl).toBe('http://localhost:3333/files');
    expect(config.clientUrls).toEqual(['http://localhost:5173']);
    expect(config.trustProxy).toBe(false);
    expect(config.uploadDir).toBe(path.resolve(__dirname, '..', 'uploads'));
    expect(config.uploadMaxBytes).toBe(2 * 1024 * 1024);
    expect(config.uploadMimeTypes).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(config.rateLimitWindowMs).toBe(15 * 60 * 1000);
    expect(config.rateLimitMax).toBe(300);
    expect(config.logLevel).toBe('info');
  });

  test('aceita mongodb+srv e monta APP_URL a partir da PORT', () => {
    const config = loadConfig({ MONGO_URI: 'mongodb+srv://u:p@cluster.example/db', PORT: '8080' });
    expect(config.port).toBe(8080);
    expect(config.appUrl).toBe('http://localhost:8080');
  });

  test('le todas as variaveis opcionais', () => {
    const config = loadConfig({
      ...valid,
      NODE_ENV: 'production',
      APP_URL: 'https://api.exemplo.com/',
      CLIENT_URL: 'https://app.exemplo.com/, http://localhost:5173',
      TRUST_PROXY: 'true',
      UPLOAD_DIR: '/tmp/imagens',
      UPLOAD_MAX_MB: '0.5',
      UPLOAD_MIME_TYPES: 'image/png',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX: '10',
      DB_CONNECT_TIMEOUT_MS: '1000',
      DB_RETRY_MS: '500',
      LOG_LEVEL: 'warn'
    });

    expect(config.isProduction).toBe(true);
    expect(config.appUrl).toBe('https://api.exemplo.com');
    expect(config.filesUrl).toBe('https://api.exemplo.com/files');
    expect(config.clientUrls).toEqual(['https://app.exemplo.com', 'http://localhost:5173']);
    expect(config.trustProxy).toBe(true);
    expect(config.uploadDir).toBe('/tmp/imagens');
    expect(config.uploadMaxBytes).toBe(524288);
    expect(config.uploadMimeTypes).toEqual(['image/png']);
    expect(config.rateLimitWindowMs).toBe(60000);
    expect(config.rateLimitMax).toBe(10);
    expect(config.dbConnectTimeoutMs).toBe(1000);
    expect(config.dbRetryMs).toBe(500);
    expect(config.logLevel).toBe('warn');
  });

  test('CLIENT_URL=* libera qualquer origem', () => {
    expect(loadConfig({ ...valid, CLIENT_URL: '*' }).clientUrls).toEqual(['*']);
  });

  test('em test o log fica silencioso por padrao', () => {
    expect(loadConfig({ ...valid, NODE_ENV: 'test' }).logLevel).toBe('silent');
  });

  test('falha sem MONGO_URI', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/MONGO_URI e obrigatoria/);
  });

  test('falha com MONGO_URI que nao e mongodb://', () => {
    expect(() => loadConfig({ MONGO_URI: 'postgres://x' })).toThrow(/mongodb:\/\/ ou mongodb\+srv:\/\//);
  });

  test('lista todos os problemas de uma vez', () => {
    let error;
    try {
      loadConfig({
        PORT: 'abc',
        NODE_ENV: 'staging',
        CLIENT_URL: 'nao-e-url',
        APP_URL: 'ftp://x',
        TRUST_PROXY: 'talvez',
        UPLOAD_MAX_MB: '-1',
        UPLOAD_MIME_TYPES: 'image/svg+xml',
        RATE_LIMIT_MAX: '0',
        LOG_LEVEL: 'loud'
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(ConfigError);
    expect(error.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('MONGO_URI'),
        expect.stringContaining('PORT'),
        expect.stringContaining('NODE_ENV'),
        expect.stringContaining('CLIENT_URL'),
        expect.stringContaining('APP_URL'),
        expect.stringContaining('TRUST_PROXY'),
        expect.stringContaining('UPLOAD_MAX_MB'),
        expect.stringContaining('UPLOAD_MIME_TYPES'),
        expect.stringContaining('RATE_LIMIT_MAX'),
        expect.stringContaining('LOG_LEVEL')
      ])
    );
    expect(error.problems).toHaveLength(10);
  });
});
