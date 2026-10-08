const Spot = require('../models/Spot');
const { presentSpot } = require('../lib/presenters');
const { saveImage, removeImage } = require('../lib/upload');
const { validateSpot, validateTechFilter } = require('../validators/spot');

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function index(req, res) {
  const { filesUrl } = req.app.locals.config;
  const tech = validateTechFilter(req.query);

  // busca exata ignorando maiusculas: "react" encontra "React", nao "ReactJS"
  const filter = tech ? { techs: new RegExp(`^${escapeRegExp(tech)}$`, 'i') } : {};
  const spots = await Spot.find(filter).sort({ createdAt: -1 });

  res.json(spots.map(spot => presentSpot(spot, filesUrl)));
}

async function store(req, res) {
  const config = req.app.locals.config;
  const { company, techs, price } = validateSpot(req.body, req.file);

  const thumbnail = await saveImage(req.file, config);

  let spot;
  try {
    spot = await Spot.create({ user: req.user._id, thumbnail, company, techs, price });
  } catch (error) {
    // nao deixa imagem orfa em uploads/ se o insert falhar
    await removeImage(thumbnail, config);
    throw error;
  }

  res.status(201).json(presentSpot(spot, config.filesUrl));
}

module.exports = { index, store };
