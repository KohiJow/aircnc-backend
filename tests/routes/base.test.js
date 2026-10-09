const request = require('supertest');

jest.mock('../../src/models/User', () => ({ findById: jest.fn(), findOne: jest.fn(), create: jest.fn() }));

const User = require('../../src/models/User');
const { buildApp } = require('../helpers/app');

describe('rotas base', () => {
  let ctx;
  beforeAll(() => {
    ctx = buildApp();
  });
  afterAll(() => ctx.cleanup());

  test('GET / identifica a api', async () => {
    const res = await request(ctx.app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'aircnc-backend', status: 'ok' });
  });

  test('GET /ping responde texto', async () => {
    const res = await request(ctx.app).get('/ping');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('pong');
  });

  test('GET /health informa o estado do banco', async () => {
    const res = await request(ctx.app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'connected', uptime: expect.any(Number) });
  });

  test('rota desconhecida devolve 404 em JSON', async () => {
    const res = await request(ctx.app).get('/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'rota nao encontrada' });
  });

  test('GET /files/<inexistente> devolve 404 em JSON', async () => {
    const res = await request(ctx.app).get('/files/nada.png');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'rota nao encontrada' });
  });

  test('JSON invalido no corpo devolve 400', async () => {
    const res = await request(ctx.app).post('/sessions').set('content-type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'JSON invalido no corpo da requisicao' });
  });

  test('JSON acima de 100kb devolve 413', async () => {
    const res = await request(ctx.app)
      .post('/sessions')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ email: 'a'.repeat(120 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'corpo da requisicao muito grande' });
  });

  test('cabecalhos de seguranca do helmet, sem x-powered-by', async () => {
    const res = await request(ctx.app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('CORS libera so as origens configuradas', async () => {
    const allowed = await request(ctx.app).get('/').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const denied = await request(ctx.app).get('/').set('Origin', 'http://outro.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();

    const preflight = await request(ctx.app)
      .options('/spots')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'user_id,content-type');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-headers']).toMatch(/user_id/);
  });

  test('CLIENT_URL=* libera qualquer origem', async () => {
    const open = buildApp({ env: { CLIENT_URL: '*' } });
    const res = await request(open.app).get('/').set('Origin', 'http://qualquer.example');
    expect(res.headers['access-control-allow-origin']).toBe('*');
    open.cleanup();
  });

  test('rate limit devolve 429 em JSON depois do limite', async () => {
    const limited = buildApp({ env: { RATE_LIMIT_MAX: '2', RATE_LIMIT_WINDOW_MS: '60000' } });
    expect((await request(limited.app).get('/ping')).status).toBe(200);
    expect((await request(limited.app).get('/ping')).status).toBe(200);

    const res = await request(limited.app).get('/ping');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'muitas requisicoes, tente de novo em instantes' });
    expect(res.headers['ratelimit']).toBeDefined();

    // /files fica fora do limite: o front carrega varias imagens por tela
    const file = await request(limited.app).get('/files/nada.png');
    expect(file.status).toBe(404);
    limited.cleanup();
  });

  test('atras de um proxy o rate limit usa o ip que o proxy anotou, nao o que o cliente forjou', async () => {
    const proxied = buildApp({ env: { TRUST_PROXY: '1', RATE_LIMIT_MAX: '1', RATE_LIMIT_WINDOW_MS: '60000' } });
    // o ultimo ip e o que o proxy confiavel anotou; o primeiro veio do cliente e nao conta
    expect((await request(proxied.app).get('/ping').set('X-Forwarded-For', '9.9.9.9, 1.1.1.1')).status).toBe(200);
    expect((await request(proxied.app).get('/ping').set('X-Forwarded-For', '8.8.8.8, 1.1.1.1')).status).toBe(429);
    expect((await request(proxied.app).get('/ping').set('X-Forwarded-For', '8.8.8.8, 2.2.2.2')).status).toBe(200);
    proxied.cleanup();
  });

  test('loga toda requisicao, inclusive as barradas antes das rotas', async () => {
    const { logger } = require('../../src/lib/logger');
    const info = jest.spyOn(logger, 'info').mockImplementation(() => {});
    const limited = buildApp({ env: { RATE_LIMIT_MAX: '1', RATE_LIMIT_WINDOW_MS: '60000' } });

    await request(limited.app).post('/sessions').set('content-type', 'application/json').send('{"email":');
    await request(limited.app).get('/ping');

    expect(info.mock.calls.map(([line]) => line)).toEqual([
      expect.stringMatching(/^POST \/sessions 400 \d+\.\dms$/),
      expect.stringMatching(/^GET \/ping 429 \d+\.\dms$/)
    ]);
    info.mockRestore();
    limited.cleanup();
  });

  test('rotas de dominio respondem 503 enquanto o banco nao conectou', async () => {
    const offline = buildApp({ databaseConnected: false });

    const health = await request(offline.app).get('/health');
    expect(health.body).toMatchObject({ status: 'degraded', database: 'disconnected' });

    for (const call of [
      request(offline.app).post('/sessions').send({ email: 'ana@example.com' }),
      request(offline.app).get('/spots'),
      request(offline.app).get('/dashboard').set('user_id', '507f1f77bcf86cd799439011')
    ]) {
      const res = await call;
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: 'banco de dados indisponivel' });
    }
    expect(User.findById).not.toHaveBeenCalled();
    offline.cleanup();
  });

  test('erro inesperado num handler async vira 500 com detalhes fora de producao', async () => {
    User.findOne.mockRejectedValue(new Error('explodiu'));
    const res = await request(ctx.app).post('/sessions').send({ email: 'ana@example.com' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('erro interno no servidor');
    expect(res.body.details).toBe('explodiu');
    expect(res.body.stack).toContain('explodiu');
  });

  test('em producao o 500 nao expoe mensagem nem stack', async () => {
    const prod = buildApp({ env: { NODE_ENV: 'production' } });
    User.findOne.mockRejectedValue(new Error('explodiu'));
    const res = await request(prod.app).post('/sessions').send({ email: 'ana@example.com' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'erro interno no servidor' });
    prod.cleanup();
  });
});
