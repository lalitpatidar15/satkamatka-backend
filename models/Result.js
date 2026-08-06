const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema(
  {
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    openResult: {
      type: String,
      required: true,
    },
    closeResult: {
      type: String,
      required: true,
    },
    jodi: {
      type: String,
      required: true,
    },
    panel: {
      type: String,
    },
    fullResult: {
      type: String,
    },
  },
  {timestamps: true},
);

module.exports = mongoose.model('Result', resultSchema);
