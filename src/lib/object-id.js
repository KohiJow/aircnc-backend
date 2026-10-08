// formato de um ObjectId do MongoDB: 24 caracteres hexadecimais
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const isObjectId = value => typeof value === 'string' && OBJECT_ID_RE.test(value);

module.exports = { isObjectId };
