const request = require('supertest');

jest.mock('../../src/models/User', () => ({ findById: jest.fn(), findOne: jest.fn(), create: jest.fn() }));

const User = require('../../src/models/User');
const { buildApp, ids } = require('../helpers/app');

describe('POST /sessions', () => {
  let ctx;
  beforeAll(() => {
    ctx = buildApp();
  });
  afterAll(() => ctx.cleanup());

  test('devolve 200 com o usuario existente', async () => {
    User.findOne.mockResolvedValue({ _id: ids.user, email: 'fulano@example.com', createdAt: 'x' });

    const res = await request(ctx.app).post('/sessions').send({ email: ' Fulano@Example.com ' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ _id: ids.user, email: 'fulano@example.com' });
    expect(User.findOne).toHaveBeenCalledWith({ email: 'fulano@example.com' });
    expect(User.create).not.toHaveBeenCalled();
  });

  test('devolve 201 quando cria o usuario', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: ids.user, email: 'novo@example.com' });

    const res = await request(ctx.app).post('/sessions').send({ email: 'novo@example.com' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ _id: ids.user, email: 'novo@example.com' });
    expect(User.create).toHaveBeenCalledWith({ email: 'novo@example.com' });
  });

  test('devolve 400 sem email', async () => {
    const res = await request(ctx.app).post('/sessions').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'dados invalidos', details: ['email e obrigatorio'] });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test('devolve 400 com email invalido', async () => {
    const res = await request(ctx.app).post('/sessions').send({ email: 'sem-arroba' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'dados invalidos', details: ['email invalido'] });
  });

  test('devolve 409 se o insert bater em email duplicado', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }));

    const res = await request(ctx.app).post('/sessions').send({ email: 'ana@example.com' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'registro duplicado' });
  });
});
