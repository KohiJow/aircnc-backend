const fs = require('fs');
const os = require('os');
const path = require('path');

const { createApp } = require('../../src/app');
const { loadConfig } = require('../../src/config/env');

const BASE_ENV = {
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1:27017/aircnc-test',
  APP_URL: 'http://api.test',
  RATE_LIMIT_MAX: '1000'
};

// ids validos de ObjectId para usar nos mocks
const ids = {
  user: '507f1f77bcf86cd799439011',
  owner: '507f1f77bcf86cd799439012',
  spot: '507f1f77bcf86cd799439021',
  booking: '507f1f77bcf86cd799439031',
  unknown: '507f1f77bcf86cd799439099'
};

// monta o app com config de teste, realtime e database falsos e uploads numa pasta temporaria
function buildApp({ env = {}, databaseConnected = true } = {}) {
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aircnc-uploads-'));
  const config = loadConfig({ ...BASE_ENV, UPLOAD_DIR: uploadDir, ...env });
  const realtime = { emitToUser: jest.fn(() => true) };
  const database = { isConnected: jest.fn(() => databaseConnected) };
  const app = createApp({ config, realtime, database });

  const cleanup = () => fs.rmSync(uploadDir, { recursive: true, force: true });

  return { app, config, realtime, database, uploadDir, cleanup };
}

// imita o Query do mongoose para um unico passo de encadeamento
const query = value => ({
  sort: jest.fn().mockResolvedValue(value),
  populate: jest.fn().mockResolvedValue(value)
});

// bytes iniciais de uma imagem valida, completados ate o tamanho pedido
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

const fakeImage = (signature, size = 64) => Buffer.concat([signature, Buffer.alloc(Math.max(0, size - signature.length), 0)]);

module.exports = { buildApp, ids, query, fakeImage, PNG_SIGNATURE, JPEG_SIGNATURE };
