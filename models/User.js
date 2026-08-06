const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
      default: null,
    },
    wallet: {
      type: Number,
      default: 0,
    },
    isAdmin: {
      type: Boolean,
      default: false,
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

userSchema.methods.compareMpin = async function (mpin) {
  if (!this.mpin) return false;
  return bcrypt.compare(mpin, this.mpin);
};

userSchema.statics.hashMpin = async function (mpin) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(mpin, salt);
};

module.exports = mongoose.model('User', userSchema);
