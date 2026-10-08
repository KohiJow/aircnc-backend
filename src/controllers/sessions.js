const User = require('../models/User');
const { presentUser } = require('../lib/presenters');
const { validateSession } = require('../validators/session');

// "login" do projeto original: entra com o email, cria o usuario se nao existir
async function store(req, res) {
  const { email } = validateSession(req.body);

  let user = await User.findOne({ email });
  let status = 200;

  if (!user) {
    user = await User.create({ email });
    status = 201;
  }

  res.status(status).json(presentUser(user));
}

module.exports = { store };
