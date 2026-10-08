const fs = require('fs');
const os = require('os');
const path = require('path');

const { AppError } = require('../src/lib/errors');
const { detectImageType, saveImage, removeImage } = require('../src/lib/upload');
const { fakeImage, PNG_SIGNATURE, JPEG_SIGNATURE } = require('./helpers/app');

describe('detectImageType', () => {
  test('reconhece jpeg, png, webp e gif pelos primeiros bytes', () => {
    expect(detectImageType(fakeImage(JPEG_SIGNATURE))).toBe('image/jpeg');
    expect(detectImageType(fakeImage(PNG_SIGNATURE))).toBe('image/png');
    expect(detectImageType(fakeImage(Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'binary')))).toBe('image/webp');
    expect(detectImageType(fakeImage(Buffer.from('GIF89a')))).toBe('image/gif');
  });

  test('devolve null para conteudo que nao e imagem', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageType(Buffer.from('curto'))).toBeNull();
    expect(detectImageType(undefined)).toBeNull();
  });
});

describe('saveImage', () => {
  let uploadDir;
  const config = () => ({ uploadDir, uploadMimeTypes: ['image/png'] });

  beforeEach(() => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aircnc-upload-'));
  });
  afterEach(() => fs.rmSync(uploadDir, { recursive: true, force: true }));

  test('grava com nome aleatorio e extensao do tipo detectado', async () => {
    const filename = await saveImage({ buffer: fakeImage(PNG_SIGNATURE), originalname: '../../etc/passwd' }, config());
    expect(filename).toMatch(/^[0-9a-f]{24}\.png$/);
    expect(fs.readFileSync(path.join(uploadDir, filename))).toEqual(fakeImage(PNG_SIGNATURE));
  });

  test('rejeita conteudo que nao bate com os tipos aceitos', async () => {
    await expect(saveImage({ buffer: fakeImage(JPEG_SIGNATURE) }, config())).rejects.toMatchObject({ status: 415 });
    await expect(saveImage({ buffer: Buffer.from('nao e imagem, so texto') }, config())).rejects.toBeInstanceOf(AppError);
    expect(fs.readdirSync(uploadDir)).toEqual([]);
  });

  test('removeImage ignora arquivo que ja nao existe', async () => {
    await expect(removeImage('nada.png', config())).resolves.toBeUndefined();
  });
});
