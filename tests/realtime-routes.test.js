const http = require('http');
const request = require('supertest');
const { io: connectClient } = require('socket.io-client');

jest.mock('../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../src/models/Spot', () => ({ findById: jest.fn() }));
jest.mock('../src/models/Booking', () => ({ findById: jest.fn(), findOne: jest.fn(), create: jest.fn() }));

const Booking = require('../src/models/Booking');
const Spot = require('../src/models/Spot');
const User = require('../src/models/User');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config/env');
const { createRealtime } = require('../src/lib/realtime');
const { ids } = require('./helpers/app');

// rotas de reserva com o socket.io de verdade: garante que o evento chega
// na sala certa, o que o realtime falso dos outros testes nao cobre
describe('rotas de reserva com socket real', () => {
  let server;
  let realtime;
  let app;
  let url;
  const clients = [];

  const ownerDoc = { _id: ids.owner, email: 'dono@example.com' };
  const guestDoc = { _id: ids.user, email: 'hospede@example.com' };
  const spotDoc = { _id: ids.spot, thumbnail: 'a.png', company: 'ACME', techs: ['React'], user: ids.owner };

  beforeAll(async () => {
    const config = loadConfig({ NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/aircnc-test', APP_URL: 'http://api.test' });
    server = http.createServer();
    realtime = createRealtime(server, config);
    app = createApp({ config, realtime, database: { isConnected: () => true } });
    server.on('request', app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(() => {
    while (clients.length) clients.pop().disconnect();
  });

  afterAll(() => realtime.close());

  function connect(userId) {
    return new Promise((resolve, reject) => {
      const socket = connectClient(url, { query: { user_id: userId }, transports: ['websocket'], forceNew: true, reconnection: false });
      clients.push(socket);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  const nextEvent = (socket, event, timeout = 2000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${event} nao chegou em ${timeout}ms`)), timeout);
      socket.once(event, payload => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  test('o dono recebe booking_request ao criar a reserva', async () => {
    User.findById.mockResolvedValue(guestDoc);
    Spot.findById.mockResolvedValue(spotDoc);
    Booking.findOne.mockResolvedValue(null);
    Booking.create.mockResolvedValue({
      _id: ids.booking,
      date: new Date('2030-01-01T00:00:00Z'),
      approved: null,
      user: guestDoc,
      spot: spotDoc,
      populate: jest.fn().mockResolvedValue()
    });

    const owner = await connect(ids.owner);
    const received = nextEvent(owner, 'booking_request');

    const res = await request(app).post(`/spots/${ids.spot}/bookings`).set('user_id', ids.user).send({ date: '2030-01-01' });
    expect(res.status).toBe(201);
    expect(await received).toMatchObject({ _id: ids.booking, approved: null, user: guestDoc });
  });

  test('quem pediu recebe booking_response quando o dono responde', async () => {
    User.findById.mockResolvedValue(ownerDoc);
    const booking = {
      _id: ids.booking,
      date: new Date('2030-01-01T00:00:00Z'),
      approved: null,
      user: guestDoc,
      spot: spotDoc,
      save: jest.fn().mockResolvedValue()
    };
    Booking.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(booking) });

    const guest = await connect(ids.user);
    const received = nextEvent(guest, 'booking_response');

    const res = await request(app).post(`/bookings/${ids.booking}/approvals`).set('user_id', ids.owner);
    expect(res.status).toBe(200);
    expect(await received).toMatchObject({ _id: ids.booking, approved: true, user: guestDoc });
  });
});
