const Spot = require('../models/Spot');
const { presentSpot } = require('../lib/presenters');

// spots do usuario logado
async function show(req, res) {
  const { filesUrl } = req.app.locals.config;
  const spots = await Spot.find({ user: req.user._id }).sort({ createdAt: -1 });

  res.json(spots.map(spot => presentSpot(spot, filesUrl)));
}

module.exports = { show };
