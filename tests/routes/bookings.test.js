const request = require('supertest');

jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/models/Spot', () => ({ find: jest.fn(), create: jest.fn(), findById: jest.fn() }));
jest.mock('../../src/models/Booking', () => ({ findById: jest.fn(), findOne: jest.fn(), create: jest.fn() }));

const Booking = require('../../src/models/Booking');
const Spot = require('../../src/models/Spot');
const User = require('../../src/models/User');
const { buildApp, ids, query } = require('../helpers/app');

const spotDoc = { _id: ids.spot, thumbnail: 'a.png', company: 'ACME', price: 10, techs: ['React'], user: ids.owner };
const userDoc = { _id: ids.user, email: 'hospede@exemplo.com' };

const bookingDoc = (extra = {}) => ({
  _id: ids.booking,
  date: new Date('2030-01-01T00:00:00Z'),
  approved: null,
  user: userDoc,
  spot: spotDoc,
  createdAt: 'agora',
  save: jest.fn().mockResolvedValue(),
  populate: jest.fn().mockResolvedValue(),
  ...extra
});

const expectedBody = (approved = null) => ({
  _id: ids.booking,
  date: '2030-01-01',
  approved,
  user: userDoc,
  spot: { ...spotDoc, thumbnail_url: 'http://api.test/files/a.png', createdAt: undefined },
  createdAt: 'agora'
});

describe('POST /spots/:spot_id/bookings', () => {
  let ctx;
  beforeAll(() => {
    ctx = buildApp();
  });
  afterAll(() => ctx.cleanup());
  beforeEach(() => User.findById.mockResolvedValue(userDoc));

  const book = (spotId = ids.spot, body = { date: '2030-01-01' }) =>
    request(ctx.app).post(`/spots/${spotId}/bookings`).set('user_id', ids.user).send(body);

  test('cria a reserva e avisa o dono do spot', async () => {
    Spot.findById.mockResolvedValue(spotDoc);
    Booking.findOne.mockResolvedValue(null);
    const created = bookingDoc();
    Booking.create.mockResolvedValue(created);

    const res = await book();

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expectedBody());
    expect(Booking.findOne).toHaveBeenCalledWith({ user: ids.user, spot: ids.spot, date: new Date('2030-01-01T00:00:00Z') });
    expect(Booking.create).toHaveBeenCalledWith({ user: ids.user, spot: ids.spot, date: new Date('2030-01-01T00:00:00Z') });
    expect(created.populate).toHaveBeenCalledWith(['spot', 'user']);
    expect(ctx.realtime.emitToUser).toHaveBeenCalledWith(ids.owner, 'booking_request', expectedBody());
  });

  test('devolve 400 com spot_id fora do formato', async () => {
    const res = await book('123');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'spot_id invalido' });
    expect(Spot.findById).not.toHaveBeenCalled();
  });

  test('devolve 400 sem data ou com data no passado', async () => {
    expect((await book(ids.spot, {})).body).toEqual({ error: 'dados invalidos', details: ['date e obrigatoria (formato YYYY-MM-DD)'] });
    const past = await book(ids.spot, { date: '2000-01-01' });
    expect(past.status).toBe(400);
    expect(past.body.details).toEqual(['date nao pode ser no passado']);
    expect(Spot.findById).not.toHaveBeenCalled();
  });

  test('devolve 404 quando o spot nao existe', async () => {
    Spot.findById.mockResolvedValue(null);
    const res = await book(ids.unknown);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'spot nao encontrado' });
  });

  test('devolve 400 ao reservar o proprio spot', async () => {
    Spot.findById.mockResolvedValue({ ...spotDoc, user: ids.user });
    const res = await book();
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'nao e possivel reservar o proprio spot' });
    expect(Booking.create).not.toHaveBeenCalled();
  });

  test('devolve 409 para reserva repetida na mesma data', async () => {
    Spot.findById.mockResolvedValue(spotDoc);
    Booking.findOne.mockResolvedValue(bookingDoc());
    const res = await book();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'ja existe uma reserva sua para esse spot nessa data' });
    expect(Booking.create).not.toHaveBeenCalled();
    expect(ctx.realtime.emitToUser).not.toHaveBeenCalled();
  });

  test('devolve 401 sem user_id', async () => {
    const res = await request(ctx.app).post(`/spots/${ids.spot}/bookings`).send({ date: '2030-01-01' });
    expect(res.status).toBe(401);
  });
});

describe.each([
  ['approvals', true],
  ['rejections', false]
])('POST /bookings/:booking_id/%s', (action, approved) => {
  let ctx;
  beforeAll(() => {
    ctx = buildApp();
  });
  afterAll(() => ctx.cleanup());

  const respond = (bookingId = ids.booking, userId = ids.owner) =>
    request(ctx.app).post(`/bookings/${bookingId}/${action}`).set('user_id', userId);

  test(`marca approved=${approved} e avisa quem pediu`, async () => {
    User.findById.mockResolvedValue({ _id: ids.owner, email: 'dono@exemplo.com' });
    const booking = bookingDoc();
    Booking.findById.mockReturnValue(query(booking));

    const res = await respond();

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expectedBody(approved));
    expect(booking.approved).toBe(approved);
    expect(booking.save).toHaveBeenCalled();
    expect(Booking.findById).toHaveBeenCalledWith(ids.booking);
    expect(ctx.realtime.emitToUser).toHaveBeenCalledWith(userDoc, 'booking_response', expectedBody(approved));
  });

  test('devolve 400 com booking_id fora do formato', async () => {
    User.findById.mockResolvedValue({ _id: ids.owner });
    const res = await respond('xyz');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'booking_id invalido' });
  });

  test('devolve 404 quando a reserva nao existe', async () => {
    User.findById.mockResolvedValue({ _id: ids.owner });
    Booking.findById.mockReturnValue(query(null));
    const res = await respond(ids.unknown);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'reserva nao encontrada' });
  });

  test('devolve 403 para quem nao e dono do spot', async () => {
    User.findById.mockResolvedValue(userDoc);
    const booking = bookingDoc();
    Booking.findById.mockReturnValue(query(booking));

    const res = await respond(ids.booking, ids.user);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'so o dono do spot pode responder a reserva' });
    expect(booking.save).not.toHaveBeenCalled();
    expect(ctx.realtime.emitToUser).not.toHaveBeenCalled();
  });

  test('devolve 409 se a reserva ja foi respondida', async () => {
    User.findById.mockResolvedValue({ _id: ids.owner });
    const booking = bookingDoc({ approved: !approved });
    Booking.findById.mockReturnValue(query(booking));

    const res = await respond();

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'reserva ja respondida' });
    expect(booking.save).not.toHaveBeenCalled();
  });
});
