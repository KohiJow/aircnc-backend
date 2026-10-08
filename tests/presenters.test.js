const Spot = require('../src/models/Spot');
const { presentUser, presentSpot, presentBooking } = require('../src/lib/presenters');

const FILES = 'http://api.test/files';

describe('presenters', () => {
  test('presentSpot monta thumbnail_url e expoe price null quando gratuito', () => {
    const spot = presentSpot(
      { _id: 'abc', thumbnail: 'x.png', company: 'ACME', techs: ['React'], user: '507f1f77bcf86cd799439011', createdAt: 'c' },
      FILES
    );
    expect(spot).toEqual({
      _id: 'abc',
      thumbnail: 'x.png',
      thumbnail_url: 'http://api.test/files/x.png',
      company: 'ACME',
      price: null,
      techs: ['React'],
      user: '507f1f77bcf86cd799439011',
      createdAt: 'c'
    });
  });

  test('presentSpot aceita documento do mongoose e usuario populado', () => {
    const doc = new Spot({ thumbnail: 'x.png', company: 'ACME', price: 10, techs: ['a'], user: '507f1f77bcf86cd799439011' });
    const spot = presentSpot(doc, FILES);
    expect(spot._id).toBe(String(doc._id));
    expect(spot.price).toBe(10);
    expect(spot.user).toBe('507f1f77bcf86cd799439011');

    const populated = presentSpot({ ...doc.toObject(), user: { _id: 'u1', email: 'ana@example.com' } }, FILES);
    expect(populated.user).toEqual({ _id: 'u1', email: 'ana@example.com' });
  });

  test('presentBooking formata a data e aninha spot e usuario', () => {
    const booking = presentBooking(
      {
        _id: 'b1',
        date: new Date('2030-01-01T00:00:00Z'),
        approved: undefined,
        user: { _id: 'u1', email: 'ana@example.com' },
        spot: { _id: 's1', thumbnail: 'x.png', company: 'ACME', techs: [], user: 'u2' },
        createdAt: 'c'
      },
      FILES
    );
    expect(booking).toEqual({
      _id: 'b1',
      date: '2030-01-01',
      approved: null,
      user: { _id: 'u1', email: 'ana@example.com' },
      spot: { _id: 's1', thumbnail: 'x.png', thumbnail_url: `${FILES}/x.png`, company: 'ACME', price: null, techs: [], user: 'u2', createdAt: undefined },
      createdAt: 'c'
    });
  });

  test('presentBooking sem populate devolve so os ids', () => {
    const booking = presentBooking({ _id: 'b1', date: new Date('2030-01-01T00:00:00Z'), approved: true, user: 'u1', spot: 's1' }, FILES);
    expect(booking.user).toBe('u1');
    expect(booking.spot).toBe('s1');
    expect(booking.approved).toBe(true);
  });

  test('presentUser so expoe id e email', () => {
    expect(presentUser({ _id: 'u1', email: 'ana@example.com', createdAt: 'x' })).toEqual({ _id: 'u1', email: 'ana@example.com' });
  });
});
