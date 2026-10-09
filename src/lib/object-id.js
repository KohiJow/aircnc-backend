const mongoose = require('mongoose');

// formato de um ObjectId do MongoDB: 24 caracteres hexadecimais
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const isObjectId = value => typeof value === 'string' && OBJECT_ID_RE.test(value);

// um ObjectId do mongoose tambem tem _id (aponta para ele mesmo),
// entao a referencia so conta como populada quando nao e um id puro
const isPopulated = value =>
  value !== null && typeof value === 'object' && !mongoose.isObjectIdOrHexString(value) && value._id !== undefined;

// id em texto de uma referencia, esteja ela populada (documento) ou nao (ObjectId ou string)
const idOf = value => (isPopulated(value) ? String(value._id) : String(value));

module.exports = { isObjectId, isPopulated, idOf };
