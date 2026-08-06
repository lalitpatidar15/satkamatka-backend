const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    mpin: {
      type: String,
      default: '1234',
    },
    wallet: {
      type: Number,
      default: 0,
    },
    bankDetails: {
      bankName: String,
      accountNumber: String,
      ifscCode: String,
      accountHolder: String,
    },
    notifications: {
      main: {type: Boolean, default: true},
      game: {type: Boolean, default: true},
      starline: {type: Boolean, default: true},
      jackpot: {type: Boolean, default: true},
    },
  },
  {timestamps: true},
);

module.exports = mongoose.model('User', userSchema);
