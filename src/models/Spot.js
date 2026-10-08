const mongoose = require('mongoose');

const SpotSchema = new mongoose.Schema(
  {
    // nome do arquivo gravado em uploads/, a url completa e montada no presenter
    thumbnail: { type: String, required: true },
    company: { type: String, required: true, trim: true },
    // sem preco significa spot gratuito
    price: { type: Number, min: 0 },
    techs: { type: [String], default: [] },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true, versionKey: false, bufferCommands: false }
);

SpotSchema.index({ user: 1, createdAt: -1 });
SpotSchema.index({ techs: 1 });

module.exports = mongoose.model('Spot', SpotSchema);
