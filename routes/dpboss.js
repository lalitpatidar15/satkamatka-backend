const express = require('express');
const router = express.Router();
const {
  getResults,
  getResultBySlug,
  getResultsByMarket,
  scrapeAndSave,
  scrapeInnerPage,
  getChart,
  getScrapeStatus,
} = require('../services/dpboss.scraper');

// Scraper health/status (must be before /:slug)
router.get('/status', (req, res) => {
  res.json(getScrapeStatus());
});

// Get all results
router.get('/', async (req, res) => {
  try {
    const results = await getResults();
    res.json(results);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get chart history for a market (jodi or panel)
router.get('/charts/:slug/:type', async (req, res) => {
  const {slug, type} = req.params;
  if (!['jodi', 'panel'].includes(type)) {
    return res.status(400).json({error: 'type must be jodi or panel'});
  }
  try {
    let chart = await getChart(slug, type);
    if (!chart) {
      const market = await getResultBySlug(slug);
      const url = type === 'jodi' ? market?.jodiUrl : market?.panelUrl;
      if (!url) {
        return res.status(404).json({error: 'Chart not found for market'});
      }
      chart = await scrapeInnerPage(url, type, slug);
      if (!chart) {
        return res.status(404).json({error: 'Failed to scrape chart'});
      }
    }
    res.json(chart);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get result by market slug
router.get('/:slug', async (req, res) => {
  try {
    const result = await getResultBySlug(req.params.slug);
    if (!result) {
      return res.status(404).json({error: 'Market not found'});
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get results by market name
router.get('/market/:market', async (req, res) => {
  try {
    const results = await getResultsByMarket(req.params.market);
    res.json(results);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Manual refresh endpoint
router.post('/refresh', async (req, res) => {
  try {
    console.log('[API] Manual refresh triggered');
    const results = await scrapeAndSave();
    res.json({
      success: true,
      message: `Refreshed ${results.length} markets`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Live results (latest for each market)
router.get('/live/all', async (req, res) => {
  try {
    const DPBossResult = require('../models/DPBossResult');
    const results = await DPBossResult.aggregate([
      {$sort: {updatedAt: -1}},
      {
        $group: {
          _id: '$marketSlug',
          market: {$first: '$market'},
          result: {$first: '$result'},
          open: {$first: '$open'},
          close: {$first: '$close'},
          jodi: {$first: '$jodi'},
          openTime: {$first: '$openTime'},
          closeTime: {$first: '$closeTime'},
          jodiUrl: {$first: '$jodiUrl'},
          panelUrl: {$first: '$panelUrl'},
          date: {$first: '$date'},
          updatedAt: {$first: '$updatedAt'},
        },
      },
      {$sort: {market: 1}},
    ]);
    res.json(results);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

module.exports = router;
