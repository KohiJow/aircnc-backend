const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { unsupportedMediaType } = require('./errors');

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

// o mimetype vem do cliente, entao o conteudo e conferido pelos primeiros bytes
function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  const head = buffer.subarray(0, 6).toString('ascii');
  if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif';
  return null;
}

// multer em memoria: o arquivo so vai para o disco depois de validar o resto do form
function createUpload(config) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: config.uploadMaxBytes,
      files: 1,
      fields: 10,
      fieldSize: 4 * 1024
    },
    fileFilter: (req, file, cb) => {
      if (config.uploadMimeTypes.includes(file.mimetype)) return cb(null, true);
      cb(unsupportedMediaType(`tipo de arquivo nao permitido: aceitos ${config.uploadMimeTypes.join(', ')}`));
    }
  });
}

async function saveImage(file, config) {
  const type = detectImageType(file.buffer);
  if (!type || !config.uploadMimeTypes.includes(type)) {
    throw unsupportedMediaType('o conteudo do arquivo nao corresponde a uma imagem aceita');
  }

  const filename = `${crypto.randomBytes(12).toString('hex')}${EXTENSIONS[type]}`;
  await fs.promises.mkdir(config.uploadDir, { recursive: true });
  await fs.promises.writeFile(path.join(config.uploadDir, filename), file.buffer);
  return filename;
}

async function removeImage(filename, config) {
  try {
    await fs.promises.unlink(path.join(config.uploadDir, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = { createUpload, saveImage, removeImage, detectImageType };
