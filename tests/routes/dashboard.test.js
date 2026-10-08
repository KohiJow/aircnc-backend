const request = require('supertest');

jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/models/Spot', () => ({ find: jest.fn(), create: jest.fn(), findById: jest.fn() }));

const Spot = require('../../src/models/Spot');
const User = require('../../src/models/User');
const { buildApp, ids, query } = require('../helpers/app');

describe('GET /dashboard', () => {
  let ctx;
  beforeAll(() => {
    ctx = buildApp();
  });
  afterAll(() => ctx.cleanup());

  test('lista os spots do usuario do header', async () => {
    User.findById.mockResolvedValue({ _id: ids.user, email: 'a@b.co' });
    const sort = jest.fn().mockResolvedValue([
      { _id: ids.spot, thumbnail: 'a.png', company: 'ACME', price: 10, techs: ['React'], user: ids.user }
    ]);
    Spot.find.mockReturnValue({ sort });

    const res = await request(ctx.app).get('/dashboard').set('user_id', ids.user);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        _id: ids.spot,
        thumbnail: 'a.png',
        thumbnail_url: 'http://api.test/files/a.png',
        company: 'ACME',
        price: 10,
        techs: ['React'],
        user: ids.user
      }
    ]);
    expect(User.findById).toHaveBeenCalledWith(ids.user);
    expect(Spot.find).toHaveBeenCalledWith({ user: ids.user });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  test('devolve lista vazia quando o usuario nao tem spots', async () => {
    User.findById.mockResolvedValue({ _id: ids.user });
    Spot.find.mockReturnValue(query([]));

    const res = await request(ctx.app).get('/dashboard').set('user_id', ids.user);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('devolve 401 sem o header user_id', async () => {
    const res = await request(ctx.app).get('/dashboard');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'informe o header user_id' });
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('devolve 401 com user_id fora do formato de ObjectId', async () => {
    const res = await request(ctx.app).get('/dashboard').set('user_id', 'abc');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'header user_id invalido' });
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('devolve 401 quando o usuario nao existe', async () => {
    User.findById.mockResolvedValue(null);
    const res = await request(ctx.app).get('/dashboard').set('user_id', ids.unknown);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'usuario nao encontrado' });
    expect(Spot.find).not.toHaveBeenCalled();
  });
});
