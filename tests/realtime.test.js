const http = require('http');
const { io: connectClient } = require('socket.io-client');

const { createRealtime } = require('../src/lib/realtime');

const USER = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439012';

describe('realtime', () => {
  let server;
  let realtime;
  let url;
  const clients = [];

  beforeAll(async () => {
    server = http.createServer();
    realtime = createRealtime(server, { clientUrls: ['http://localhost:5173'] });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  // o servidor processa o disconnect de forma assincrona, entao espera as salas esvaziarem
  afterEach(async () => {
    while (clients.length) clients.pop().disconnect();
    await waitUntil(() => realtime.io.of('/').sockets.size === 0);
  });

  afterAll(() => realtime.close());

  function connect(query) {
    return new Promise((resolve, reject) => {
      const socket = connectClient(url, { query, transports: ['websocket'], forceNew: true, reconnection: false });
      clients.push(socket);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  const waitUntil = async (check, timeout = 2000) => {
    const started = Date.now();
    while (!check()) {
      if (Date.now() - started > timeout) throw new Error('timeout esperando a condicao');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  };

  test('entrega o evento para todos os sockets do user_id e para mais ninguem', async () => {
    const first = await connect({ user_id: USER });
    const second = await connect({ user_id: USER });
    const other = await connect({ user_id: OTHER });

    const received = [];
    for (const socket of [first, second, other]) {
      socket.on('booking_request', payload => received.push([socket.id, payload]));
    }

    expect(realtime.connectionsOf(USER)).toBe(2);
    expect(realtime.emitToUser(USER, 'booking_request', { ok: true })).toBe(true);

    await waitUntil(() => received.length === 2);
    expect(received.map(([id]) => id).sort()).toEqual([first.id, second.id].sort());
    expect(received[0][1]).toEqual({ ok: true });
  });

  test('devolve false quando ninguem do user_id esta conectado', () => {
    expect(realtime.emitToUser(USER, 'booking_request', {})).toBe(false);
    expect(realtime.connectionsOf(USER)).toBe(0);
  });

  test('conexao sem user_id valido e aceita mas nao entra em sala', async () => {
    await connect({});
    await connect({ user_id: 'abc' });
    expect(realtime.connectionsOf('abc')).toBe(0);
    expect(realtime.emitToUser('abc', 'x', {})).toBe(false);
  });

  test('sai da sala quando desconecta', async () => {
    const socket = await connect({ user_id: USER });
    expect(realtime.connectionsOf(USER)).toBe(1);

    socket.disconnect();
    await waitUntil(() => realtime.connectionsOf(USER) === 0);
    expect(realtime.emitToUser(USER, 'x', {})).toBe(false);
  });
});
