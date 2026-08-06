const express = require('express');
const router = express.Router();
const Game = require('../models/Game');

// Get all games
router.get('/', async (req, res) => {
  try {
    const games = await Game.find().sort({createdAt: -1});
    res.json(games);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get single game
router.get('/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({error: 'Game not found'});
    }
    res.json(game);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get games by market
router.get('/market/:market', async (req, res) => {
  try {
    const games = await Game.find({market: req.params.market});
    res.json(games);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Create game (admin)
router.post('/', async (req, res) => {
  try {
    const {name, market, openTime, closeTime, result} = req.body;

    const game = new Game({
      name,
      market,
      openTime,
      closeTime,
      result,
      isOpen: true,
    });

    await game.save();
    res.status(201).json(game);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Update game result (admin)
router.put('/:id/result', async (req, res) => {
  try {
    const {result} = req.body;
    const game = await Game.findByIdAndUpdate(
      req.params.id,
      {result, isOpen: false},
      {new: true},
    );
    res.json(game);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Toggle game open/close (admin)
router.put('/:id/toggle', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    game.isOpen = !game.isOpen;
    await game.save();
    res.json(game);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

module.exports = router;
