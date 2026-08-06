const mongoose = require('mongoose');

const DPBossChartSchema = new mongoose.Schema(
  {
    marketSlug: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['jodi', 'panel'],
      required: true,
    },
    market: {
      type: String,
      required: true,
    },
    result: {
      type: String,
    },
    jodiGrid: {
      type: [[String]],
      default: [],
    },
    panelWeeks: {
      type: [
        {
          range: String,
          days: [
            {
              panel: [String],
              jodi: String,
            },
          ],
        },
      ],
      default: [],
    },
    sourceUrl: {
      type: String,
    },
    scrapedAt: {
      type: String,
    },
  },
  {timestamps: true},
);

DPBossChartSchema.index({marketSlug: 1, type: 1}, {unique: true});

module.exports = mongoose.model('DPBossChart', DPBossChartSchema);
