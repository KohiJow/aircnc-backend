const Booking = require('../models/Booking');
const Spot = require('../models/Spot');
const { badRequest, notFound, forbidden, conflict } = require('../lib/errors');
const { isObjectId, idOf } = require('../lib/object-id');
const { presentBooking } = require('../lib/presenters');
const { validateBooking } = require('../validators/booking');

async function store(req, res) {
  const { filesUrl } = req.app.locals.config;
  const { spot_id: spotId } = req.params;
  if (!isObjectId(spotId)) throw badRequest('spot_id invalido');

  const { date } = validateBooking(req.body);

  const spot = await Spot.findById(spotId);
  if (!spot) throw notFound('spot nao encontrado');
  if (idOf(spot.user) === idOf(req.user)) throw badRequest('nao e possivel reservar o proprio spot');

  const existing = await Booking.findOne({ user: req.user._id, spot: spot._id, date });
  if (existing) throw conflict('ja existe uma reserva sua para esse spot nessa data');

  const booking = await Booking.create({ user: req.user._id, spot: spot._id, date });
  await booking.populate(['spot', 'user']);

  const payload = presentBooking(booking, filesUrl);
  // avisa o dono do spot se ele estiver conectado no socket
  req.realtime.emitToUser(idOf(spot.user), 'booking_request', payload);

  res.status(201).json(payload);
}

// aprovacao e rejeicao sao a mesma operacao com valores diferentes
async function respond(req, res, approved) {
  const { filesUrl } = req.app.locals.config;
  const { booking_id: bookingId } = req.params;
  if (!isObjectId(bookingId)) throw badRequest('booking_id invalido');

  const booking = await Booking.findById(bookingId).populate(['spot', 'user']);
  if (!booking) throw notFound('reserva nao encontrada');
  if (!booking.spot || idOf(booking.spot.user) !== idOf(req.user)) {
    throw forbidden('so o dono do spot pode responder a reserva');
  }
  if (booking.approved !== null && booking.approved !== undefined) throw conflict('reserva ja respondida');

  booking.approved = approved;
  await booking.save();

  const payload = presentBooking(booking, filesUrl);
  // booking.user esta populado aqui, e a sala do socket e pelo id
  req.realtime.emitToUser(idOf(booking.user), 'booking_response', payload);

  res.json(payload);
}

const approve = (req, res) => respond(req, res, true);
const reject = (req, res) => respond(req, res, false);

module.exports = { store, approve, reject };
