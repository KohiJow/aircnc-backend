const User = require('../models/User');
const { unauthorized } = require('../lib/errors');
const { isObjectId } = require('../lib/object-id');

// identificacao por header user_id, como no projeto original: nao e autenticacao de verdade
async function requireUser(req, res, next) {
  const userId = req.get('user_id');

  if (!userId) throw unauthorized('informe o header user_id');
  if (!isObjectId(userId)) throw unauthorized('header user_id invalido');

  const user = await User.findById(userId);
  if (!user) throw unauthorized('usuario nao encontrado');

  req.user = user;
  next();
}

module.exports = { requireUser };
