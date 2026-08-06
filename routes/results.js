const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const Result = require('../models/Result');

// Get latest results
router.get('/latest', async (req, res) => {
  try {
    const results = await Result.find()
      .populate('game', 'name market')
      .sort({date: -1})
      .limit(10);
    res.json(results);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get results by date
router.get('/date/:date', async (req, res) => {
  try {
    const results = await Result.find({date: req.params.date}).populate(
      'game',
      'name market',
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get results by market
router.get('/market/:market', async (req, res) => {
  try {
    const results = await Result.find()
      .populate({
        path: 'game',
        match: {market: req.params.market},
      })
      .sort({date: -1});

    const filteredResults = results.filter(r => r.game !== null);
    res.json(filteredResults);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get jodi chart
router.get('/jodi/:market', async (req, res) => {
  try {
    const results = await Result.find({market: req.params.market})
      .populate('game', 'name')
      .sort({date: -1})
      .limit(30);

    const jodiChart = results.map(r => ({
      date: r.date,
      game: r.game.name,
      open: r.openResult,
      close: r.closeResult,
      jodi: r.jodi,
    }));

    res.json(jodiChart);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get panel chart
router.get('/panel/:market', async (req, res) => {
  try {
    const results = await Result.find({market: req.params.market})
      .populate('game', 'name')
      .sort({date: -1})
      .limit(30);

    const panelChart = results.map(r => ({
      date: r.date,
      game: r.game.name,
      panel: r.panel,
    }));

    res.json(panelChart);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Set result (admin)
router.post('/', async (req, res) => {
  try {
    const {gameId, date, openResult, closeResult, jodi, panel} = req.body;

    const result = new Result({
      game: gameId,
      date,
      openResult,
      closeResult,
      jodi,
      panel,
    });

    await result.save();
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

module.exports = router;
