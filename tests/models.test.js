const Booking = require('../src/models/Booking');
const Spot = require('../src/models/Spot');
const User = require('../src/models/User');

// os models validam sem conexao, entao da para testar as regras de schema sem banco
describe('models', () => {
  test('User normaliza o email e exige o campo', () => {
    expect(new User({ email: '  Fulano@Example.COM ' }).email).toBe('fulano@example.com');
    expect(Object.keys(new User({}).validateSync().errors)).toEqual(['email']);
  });

  test('Spot exige thumbnail, company e user, e price nao pode ser negativo', () => {
    expect(Object.keys(new Spot({}).validateSync().errors).sort()).toEqual(['company', 'thumbnail', 'user']);

    const spot = new Spot({ thumbnail: 'a.png', company: ' ACME ', user: '507f1f77bcf86cd799439011', price: -1 });
    expect(Object.keys(spot.validateSync().errors)).toEqual(['price']);
    expect(spot.company).toBe('ACME');
    expect(spot.techs).toEqual([]);
  });

  test('Booking exige date, user e spot e comeca sem resposta', () => {
    const empty = new Booking({});
    expect(Object.keys(empty.validateSync().errors).sort()).toEqual(['date', 'spot', 'user']);
    expect(empty.approved).toBeNull();

    const booking = new Booking({ date: '2030-01-01', user: '507f1f77bcf86cd799439011', spot: '507f1f77bcf86cd799439021' });
    expect(booking.validateSync()).toBeUndefined();
    expect(booking.date).toBeInstanceOf(Date);
  });

  test('Booking tem indice unico por spot, usuario e data', () => {
    expect(Booking.schema.indexes()).toEqual([[{ spot: 1, user: 1, date: 1 }, expect.objectContaining({ unique: true })]]);
  });

  test('schemas nao enfileiram comandos antes da conexao', () => {
    for (const Model of [User, Spot, Booking]) {
      expect(Model.schema.options.bufferCommands).toBe(false);
      expect(Model.schema.options.versionKey).toBe(false);
    }
  });
});
