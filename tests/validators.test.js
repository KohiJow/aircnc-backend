const { AppError } = require('../src/lib/errors');
const { validateSession } = require('../src/validators/session');
const { validateSpot, validateTechFilter } = require('../src/validators/spot');
const { validateBooking } = require('../src/validators/booking');

function detailsOf(fn) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(400);
    return error.details;
  }
  throw new Error('esperava um erro de validacao');
}

describe('validateSession', () => {
  test('normaliza o email', () => {
    expect(validateSession({ email: '  Fulano@Example.COM ' })).toEqual({ email: 'fulano@example.com' });
  });

  test.each([undefined, {}, { email: '' }, { email: 42 }])('rejeita corpo sem email: %p', body => {
    expect(detailsOf(() => validateSession(body))).toEqual(['email e obrigatorio']);
  });

  test.each(['semarroba', 'a@b', 'a b@example.com', '@x.com'])('rejeita email invalido: %s', email => {
    expect(detailsOf(() => validateSession({ email }))).toEqual(['email invalido']);
  });
});

describe('validateSpot', () => {
  const file = { buffer: Buffer.alloc(1) };

  test('aceita form com techs em texto e price em texto', () => {
    expect(validateSpot({ company: ' ACME ', techs: 'React, Node, , Jest', price: '150' }, file)).toEqual({
      company: 'ACME',
      techs: ['React', 'Node', 'Jest'],
      price: 150
    });
  });

  test('aceita techs em array e price vazio como gratuito', () => {
    expect(validateSpot({ company: 'ACME', techs: ['React'], price: '' }, file)).toEqual({
      company: 'ACME',
      techs: ['React'],
      price: undefined
    });
  });

  test('junta todos os problemas', () => {
    expect(detailsOf(() => validateSpot({ price: '-5' }, undefined))).toEqual([
      'thumbnail e obrigatoria (campo de arquivo "thumbnail")',
      'company e obrigatoria',
      'techs e obrigatoria (lista separada por virgula)',
      'price precisa ser um numero maior ou igual a zero'
    ]);
  });

  test('rejeita price que nao e numero', () => {
    expect(detailsOf(() => validateSpot({ company: 'x', techs: 'a', price: 'caro' }, file))).toEqual([
      'price precisa ser um numero maior ou igual a zero'
    ]);
  });

  test('limita o tamanho dos campos', () => {
    const details = detailsOf(() => validateSpot({ company: 'x'.repeat(121), techs: 'y'.repeat(41) }, file));
    expect(details).toEqual(['company pode ter no maximo 120 caracteres', 'cada tech pode ter no maximo 40 caracteres']);
  });
});

describe('validateTechFilter', () => {
  test('devolve undefined sem filtro ou com filtro vazio', () => {
    expect(validateTechFilter({})).toBeUndefined();
    expect(validateTechFilter({ tech: '   ' })).toBeUndefined();
    expect(validateTechFilter(undefined)).toBeUndefined();
  });

  test('devolve o texto sem espacos', () => {
    expect(validateTechFilter({ tech: ' React ' })).toBe('React');
  });

  test('rejeita tech repetida na query (vira array)', () => {
    expect(detailsOf(() => validateTechFilter({ tech: ['a', 'b'] }))).toEqual(['tech precisa ser um texto']);
  });
});

describe('validateBooking', () => {
  const now = new Date('2026-10-08T15:00:00Z');

  test('aceita hoje e datas futuras', () => {
    expect(validateBooking({ date: '2026-10-08' }, now)).toEqual({ date: new Date('2026-10-08T00:00:00.000Z') });
    expect(validateBooking({ date: ' 2027-01-31 ' }, now)).toEqual({ date: new Date('2027-01-31T00:00:00.000Z') });
  });

  test.each([
    [{}, 'date e obrigatoria (formato YYYY-MM-DD)'],
    [{ date: '08/10/2026' }, 'date precisa estar no formato YYYY-MM-DD'],
    [{ date: '2026-02-31' }, 'date nao e um dia valido'],
    [{ date: '2026-13-01' }, 'date nao e um dia valido'],
    [{ date: '2026-10-07' }, 'date nao pode ser no passado']
  ])('rejeita %p', (body, message) => {
    expect(detailsOf(() => validateBooking(body, now))).toEqual([message]);
  });
});
