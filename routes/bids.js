const express = require('express');
const router = express.Router();
const Bid = require('../models/Bid');
const Game = require('../models/Game');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Place a bid
router.post('/', auth, async (req, res) => {
  try {
    const {gameId, number, amount, type} = req.body;

    // Check if game exists and is open
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({error: 'Game not found'});
    }
    if (!game.isOpen) {
      return res.status(400).json({error: 'Betting is closed for this game'});
    }

    // Check user balance
    const user = await User.findById(req.user.userId);
    if (user.wallet < amount) {
      return res.status(400).json({error: 'Insufficient balance'});
    }

    // Deduct from wallet
    user.wallet -= amount;
    await user.save();

    // Create bid
    const bid = new Bid({
      user: req.user.userId,
      game: gameId,
      number,
      amount,
      type,
      status: 'pending',
    });

    await bid.save();
    res.status(201).json(bid);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get user's bids
router.get('/my-bids', auth, async (req, res) => {
  try {
    const bids = await Bid.find({user: req.user.userId})
      .populate('game', 'name market result')
      .sort({createdAt: -1});
    res.json(bids);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get bids by game
router.get('/game/:gameId', async (req, res) => {
  try {
    const bids = await Bid.find({game: req.params.gameId}).populate('user', 'name phone');
    res.json(bids);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get starline bids
router.get('/starline', auth, async (req, res) => {
  try {
    const bids = await Bid.find({user: req.user.userId, type: 'starline'})
      .populate('game', 'name result')
      .sort({createdAt: -1});
    res.json(bids);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get jackpot bids
router.get('/jackpot', auth, async (req, res) => {
  try {
    const bids = await Bid.find({user: req.user.userId, type: 'jackpot'})
      .populate('game', 'name result')
      .sort({createdAt: -1});
    res.json(bids);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

module.exports = router;
