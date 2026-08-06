const mongoose = require('mongoose');

const DPBossResultSchema = new mongoose.Schema(
  {
    market: {
      type: String,
      required: true,
      index: true,
    },
    marketSlug: {
      type: String,
      required: true,
      unique: true,
    },
    result: {
      type: String,
    },
    open: {
      type: String,
    },
    close: {
      type: String,
    },
    jodi: {
      type: String,
    },
    panel: {
      type: String,
    },
    openTime: {
      type: String,
    },
    closeTime: {
      type: String,
    },
    jodiUrl: {
      type: String,
    },
    panelUrl: {
      type: String,
    },
    date: {
      type: String,
    },
    source: {
      type: String,
      default: 'dpboss',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {timestamps: true},
);

DPBossResultSchema.index({market: 1, date: 1});

module.exports = mongoose.model('DPBossResult', DPBossResultSchema);
