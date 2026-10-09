const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    // dia da reserva, guardado como meia-noite UTC
    date: { type: Date, required: true },
    // null enquanto o dono do spot nao respondeu
    approved: { type: Boolean, default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    spot: { type: mongoose.Schema.Types.ObjectId, ref: 'Spot', required: true }
  },
  { timestamps: true, versionKey: false, bufferCommands: false }
);

// o controller ja checa antes de criar, mas duas requisicoes ao mesmo tempo
// passariam pela checagem; o indice unico garante no banco e vira 409
BookingSchema.index({ spot: 1, user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Booking', BookingSchema);
