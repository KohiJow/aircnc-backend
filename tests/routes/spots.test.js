const fs = require('fs');
const path = require('path');
const request = require('supertest');

jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/models/Spot', () => ({ find: jest.fn(), create: jest.fn(), findById: jest.fn() }));

const Spot = require('../../src/models/Spot');
const User = require('../../src/models/User');
const { buildApp, ids, query, fakeImage, PNG_SIGNATURE, JPEG_SIGNATURE } = require('../helpers/app');

describe('GET /spots', () => {
  let ctx;
  beforeAll(() => {
    ctx = buildApp();
  });
  afterAll(() => ctx.cleanup());

  const spots = [
    { _id: ids.spot, thumbnail: 'a.png', company: 'ACME', techs: ['React', 'Node'], user: ids.owner },
    { _id: ids.unknown, thumbnail: 'b.jpg', company: 'Beta', price: 0, techs: ['React'], user: ids.owner }
  ];

  test('lista todos os spots sem filtro, sem exigir user_id', async () => {
    Spot.find.mockReturnValue(query(spots));

    const res = await request(ctx.app).get('/spots');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ _id: ids.spot, thumbnail_url: 'http://api.test/files/a.png', price: null });
    expect(res.body[1]).toMatchObject({ company: 'Beta', price: 0 });
    expect(Spot.find).toHaveBeenCalledWith({});
  });

  test('filtra por tech ignorando maiusculas e sem casar parcial', async () => {
    Spot.find.mockReturnValue(query([spots[1]]));

    const res = await request(ctx.app).get('/spots').query({ tech: ' react ' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const filter = Spot.find.mock.calls[0][0];
    expect(filter.techs).toBeInstanceOf(RegExp);
    expect(filter.techs.test('React')).toBe(true);
    expect(filter.techs.test('REACT')).toBe(true);
    expect(filter.techs.test('ReactJS')).toBe(false);
  });

  test('escapa caracteres de regex no filtro', async () => {
    Spot.find.mockReturnValue(query([]));
    await request(ctx.app).get('/spots').query({ tech: 'C++' });
    const filter = Spot.find.mock.calls[0][0];
    expect(filter.techs.test('C++')).toBe(true);
    expect(filter.techs.test('C')).toBe(false);
  });

  test('devolve 400 com tech repetida na query', async () => {
    const res = await request(ctx.app).get('/spots?tech=a&tech=b');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'dados invalidos', details: ['tech precisa ser um texto'] });
  });
});

describe('POST /spots', () => {
  let ctx;
  beforeEach(() => {
    ctx = buildApp();
    User.findById.mockResolvedValue({ _id: ids.user, email: 'ana@example.com' });
  });
  afterEach(() => ctx.cleanup());

  const send = (app, image = fakeImage(PNG_SIGNATURE), contentType = 'image/png') =>
    request(app)
      .post('/spots')
      .set('user_id', ids.user)
      .field('company', 'ACME')
      .field('techs', 'React, Node')
      .field('price', '120')
      .attach('thumbnail', image, { filename: 'foto.png', contentType });

  test('cria o spot, grava a imagem e serve em /files', async () => {
    Spot.create.mockImplementation(async data => ({ _id: ids.spot, createdAt: 'agora', ...data }));

    const res = await send(ctx.app);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      _id: ids.spot,
      thumbnail: expect.stringMatching(/^[0-9a-f]{24}\.png$/),
      thumbnail_url: expect.stringMatching(/^http:\/\/api\.test\/files\/[0-9a-f]{24}\.png$/),
      company: 'ACME',
      price: 120,
      techs: ['React', 'Node'],
      user: ids.user,
      createdAt: 'agora'
    });
    expect(Spot.create).toHaveBeenCalledWith({
      user: ids.user,
      thumbnail: res.body.thumbnail,
      company: 'ACME',
      techs: ['React', 'Node'],
      price: 120
    });

    expect(fs.existsSync(path.join(ctx.uploadDir, res.body.thumbnail))).toBe(true);
    const file = await request(ctx.app).get(`/files/${res.body.thumbnail}`);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toMatch(/image\/png/);
    expect(file.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  test('aceita jpeg e price vazio como gratuito', async () => {
    Spot.create.mockImplementation(async data => ({ _id: ids.spot, ...data }));

    const res = await request(ctx.app)
      .post('/spots')
      .set('user_id', ids.user)
      .field('company', 'ACME')
      .field('techs', 'React')
      .field('price', '')
      .attach('thumbnail', fakeImage(JPEG_SIGNATURE), { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.thumbnail).toMatch(/\.jpg$/);
    expect(res.body.price).toBeNull();
  });

  test('devolve 400 listando os campos faltando e nao grava imagem', async () => {
    const res = await request(ctx.app)
      .post('/spots')
      .set('user_id', ids.user)
      .attach('thumbnail', fakeImage(PNG_SIGNATURE), { filename: 'foto.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'dados invalidos',
      details: ['company e obrigatoria', 'techs e obrigatoria (lista separada por virgula)']
    });
    expect(fs.readdirSync(ctx.uploadDir)).toEqual([]);
    expect(Spot.create).not.toHaveBeenCalled();
  });

  test('devolve 400 sem thumbnail (corpo JSON)', async () => {
    const res = await request(ctx.app).post('/spots').set('user_id', ids.user).send({ company: 'ACME', techs: ['React'] });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(['thumbnail e obrigatoria (campo de arquivo "thumbnail")']);
  });

  test('devolve 415 para mimetype fora da lista', async () => {
    const res = await send(ctx.app, Buffer.from('oi'), 'text/plain');
    expect(res.status).toBe(415);
    expect(res.body.error).toMatch(/tipo de arquivo nao permitido/);
    expect(fs.readdirSync(ctx.uploadDir)).toEqual([]);
  });

  test('devolve 415 quando o conteudo nao e a imagem anunciada', async () => {
    const res = await send(ctx.app, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/png');
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: 'o conteudo do arquivo nao corresponde a uma imagem aceita' });
    expect(fs.readdirSync(ctx.uploadDir)).toEqual([]);
  });

  test('devolve 413 quando a imagem passa do limite', async () => {
    const small = buildApp({ env: { UPLOAD_MAX_MB: '0.01' } });
    const res = await send(small.app, fakeImage(PNG_SIGNATURE, 20 * 1024));
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'arquivo maior que o limite permitido' });
    expect(fs.readdirSync(small.uploadDir)).toEqual([]);
    small.cleanup();
  });

  test('devolve 400 para campo de arquivo com outro nome', async () => {
    const res = await request(ctx.app)
      .post('/spots')
      .set('user_id', ids.user)
      .field('company', 'ACME')
      .field('techs', 'React')
      .attach('foto', fakeImage(PNG_SIGNATURE), { filename: 'foto.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('upload invalido');
  });

  test('devolve 401 sem user_id antes de processar o upload', async () => {
    const res = await request(ctx.app).post('/spots').field('company', 'ACME');
    expect(res.status).toBe(401);
    expect(Spot.create).not.toHaveBeenCalled();
  });

  test('remove a imagem se o insert falhar', async () => {
    Spot.create.mockRejectedValue(new Error('mongo caiu'));
    const res = await send(ctx.app);
    expect(res.status).toBe(500);
    expect(fs.readdirSync(ctx.uploadDir)).toEqual([]);
  });
});
