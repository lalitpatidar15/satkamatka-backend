const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    market: {
      type: String,
      required: true,
      enum: ['morning', 'day', 'night'],
    },
    openTime: {
      type: String,
      required: true,
    },
    closeTime: {
      type: String,
      required: true,
    },
    result: {
      type: String,
      default: '---',
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    gameType: {
      type: String,
      enum: ['regular', 'starline', 'jackpot'],
      default: 'regular',
    },
  },
  {timestamps: true},
);

module.exports = mongoose.model('Game', gameSchema);
