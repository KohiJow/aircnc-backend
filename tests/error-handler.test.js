const multer = require('multer');
const mongoose = require('mongoose');

const { badRequest, notFound } = require('../src/lib/errors');
const { translateError } = require('../src/middlewares/error-handler');

const dev = { exposeDetails: true };
const prod = { exposeDetails: false };

describe('translateError', () => {
  test('AppError vira o status e a mensagem informados', () => {
    expect(translateError(notFound('spot nao encontrado'), prod)).toEqual({
      status: 404,
      body: { error: 'spot nao encontrado' },
      expected: true
    });
    expect(translateError(badRequest('dados invalidos', ['x']), prod).body).toEqual({ error: 'dados invalidos', details: ['x'] });
  });

  test('erros do express.json viram 400 e 413', () => {
    expect(translateError({ type: 'entity.parse.failed' }, prod)).toMatchObject({ status: 400, body: { error: 'JSON invalido no corpo da requisicao' } });
    expect(translateError({ type: 'entity.too.large' }, prod)).toMatchObject({ status: 413 });
  });

  test('erros do multer viram 413 ou 400', () => {
    expect(translateError(new multer.MulterError('LIMIT_FILE_SIZE', 'thumbnail'), prod)).toMatchObject({
      status: 413,
      body: { error: 'arquivo maior que o limite permitido' }
    });
    expect(translateError(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'outro'), prod)).toMatchObject({
      status: 400,
      body: { error: 'upload invalido', details: [expect.stringMatching(/Unexpected/)] }
    });
  });

  test('erros do mongoose viram 400, 409 e 503', () => {
    const cast = new mongoose.Error.CastError('ObjectId', 'abc', '_id');
    expect(translateError(cast, prod)).toMatchObject({ status: 400, body: { error: 'id invalido' } });

    const validation = new mongoose.Error.ValidationError();
    validation.addError('email', new mongoose.Error.ValidatorError({ message: 'email obrigatorio', path: 'email' }));
    expect(translateError(validation, prod)).toMatchObject({ status: 400, body: { error: 'dados invalidos', details: ['email obrigatorio'] } });

    expect(translateError(Object.assign(new Error('dup'), { code: 11000 }), prod)).toMatchObject({ status: 409 });

    const selection = Object.assign(new Error('timeout'), { name: 'MongooseServerSelectionError' });
    expect(translateError(selection, prod)).toMatchObject({ status: 503, body: { error: 'banco de dados indisponivel' }, expected: false });
  });

  test('erro desconhecido so mostra detalhes fora de producao', () => {
    const err = new Error('explodiu');
    expect(translateError(err, prod)).toEqual({ status: 500, body: { error: 'erro interno no servidor' }, expected: false });

    const exposed = translateError(err, dev);
    expect(exposed.status).toBe(500);
    expect(exposed.body.details).toBe('explodiu');
    expect(exposed.body.stack).toContain('explodiu');
  });
});
