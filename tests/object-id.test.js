const mongoose = require('mongoose');

const User = require('../src/models/User');
const { isObjectId, isPopulated, idOf } = require('../src/lib/object-id');

const HEX = '507f1f77bcf86cd799439011';

describe('object-id', () => {
  test('isObjectId aceita so 24 hexadecimais em texto', () => {
    expect(isObjectId(HEX)).toBe(true);
    expect(isObjectId(HEX.toUpperCase())).toBe(true);
    expect(isObjectId('abc')).toBe(false);
    expect(isObjectId(new mongoose.Types.ObjectId(HEX))).toBe(false);
    expect(isObjectId(undefined)).toBe(false);
  });

  test('isPopulated distingue documento de id puro', () => {
    expect(isPopulated(HEX)).toBe(false);
    expect(isPopulated(new mongoose.Types.ObjectId(HEX))).toBe(false);
    expect(isPopulated(null)).toBe(false);
    expect(isPopulated({ _id: HEX, email: 'ana@example.com' })).toBe(true);
    expect(isPopulated(new User({ _id: HEX, email: 'ana@example.com' }))).toBe(true);
  });

  test('idOf devolve o id em texto de string, ObjectId, objeto e documento', () => {
    expect(idOf(HEX)).toBe(HEX);
    expect(idOf(new mongoose.Types.ObjectId(HEX))).toBe(HEX);
    expect(idOf({ _id: HEX, email: 'ana@example.com' })).toBe(HEX);
    expect(idOf(new User({ _id: HEX, email: 'ana@example.com' }))).toBe(HEX);
  });
});
