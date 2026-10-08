const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    }
  },
  { timestamps: true, versionKey: false, bufferCommands: false }
);

module.exports = mongoose.model('User', UserSchema);
