const { isPopulated, idOf } = require('./object-id');

// monta o JSON que sai da api a partir dos documentos do mongoose,
// assim o contrato das rotas fica num lugar so e nao depende do toJSON do model

const plain = doc => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);

function presentUser(user) {
  const data = plain(user);
  return { _id: String(data._id), email: data.email };
}

function presentSpot(spot, filesUrl) {
  const data = plain(spot);
  return {
    _id: String(data._id),
    thumbnail: data.thumbnail,
    thumbnail_url: `${filesUrl}/${data.thumbnail}`,
    company: data.company,
    price: data.price === undefined ? null : data.price,
    techs: data.techs || [],
    user: isPopulated(data.user) ? presentUser(data.user) : idOf(data.user),
    createdAt: data.createdAt
  };
}

function presentBooking(booking, filesUrl) {
  const data = plain(booking);
  return {
    _id: String(data._id),
    date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : data.date,
    approved: data.approved === undefined ? null : data.approved,
    user: isPopulated(data.user) ? presentUser(data.user) : idOf(data.user),
    spot: isPopulated(data.spot) ? presentSpot(data.spot, filesUrl) : idOf(data.spot),
    createdAt: data.createdAt
  };
}

module.exports = { presentUser, presentSpot, presentBooking };
