const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Game = require('../models/Game');
const Bid = require('../models/Bid');
const Transaction = require('../models/Transaction');

// Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalGames = await Game.countDocuments();
    const totalBids = await Bid.countDocuments();
    const pendingTransactions = await Transaction.countDocuments({status: 'pending'});
    const totalBidsAmount = await Bid.aggregate([{$group: {_id: null, total: {$sum: '$amount'}}}]);

    res.json({
      totalUsers,
      totalGames,
      totalBids,
      pendingTransactions,
      totalBidsAmount: totalBidsAmount[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({createdAt: -1});
    res.json(users);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get all bids
router.get('/bids', async (req, res) => {
  try {
    const bids = await Bid.find()
      .populate('user', 'name phone')
      .populate('game', 'name market')
      .sort({createdAt: -1});
    res.json(bids);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Update user wallet
router.put('/users/:id/wallet', async (req, res) => {
  try {
    const {amount} = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {$inc: {wallet: amount}},
      {new: true},
    ).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Declare results for all users
router.post('/declare-results', async (req, res) => {
  try {
    const {gameId, winningNumbers} = req.body;

    const bids = await Bid.find({game: gameId, status: 'pending'});

    for (const bid of bids) {
      if (winningNumbers.includes(bid.number)) {
        const winnings = bid.amount * 90;
        await User.findByIdAndUpdate(bid.user, {$inc: {wallet: winnings}});
        bid.status = 'won';
        bid.winnings = winnings;
      } else {
        bid.status = 'lost';
      }
      await bid.save();
    }

    res.json({message: 'Results declared', processedBids: bids.length});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

module.exports = router;
