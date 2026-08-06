const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      required: true,
    },
    number: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['regular', 'starline', 'jackpot'],
      default: 'regular',
    },
    status: {
      type: String,
      enum: ['pending', 'won', 'lost'],
      default: 'pending',
    },
    winnings: {
      type: Number,
      default: 0,
    },
  },
  {timestamps: true},
);

module.exports = mongoose.model('Bid', bidSchema);
