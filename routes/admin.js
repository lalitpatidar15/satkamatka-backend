const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Game = require('../models/Game');
const Bid = require('../models/Bid');
const Transaction = require('../models/Transaction');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

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
    console.error('Admin stats error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password -mpin').sort({createdAt: -1});
    res.json(users);
  } catch (error) {
    console.error('Admin users error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

router.get('/bids', async (req, res) => {
  try {
    const bids = await Bid.find()
      .populate('user', 'name phone')
      .populate('game', 'name market')
      .sort({createdAt: -1});
    res.json(bids);
  } catch (error) {
    console.error('Admin bids error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

router.put('/users/:id/wallet', async (req, res) => {
  try {
    const {amount} = req.body;

    if (typeof amount !== 'number' || isNaN(amount)) {
      return res.status(400).json({error: 'Invalid amount'});
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {$inc: {wallet: amount}},
      {new: true},
    ).select('-password -mpin');

    if (!user) {
      return res.status(404).json({error: 'User not found'});
    }

    res.json(user);
  } catch (error) {
    console.error('Admin wallet update error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

router.post('/declare-results', async (req, res) => {
  try {
    const {gameId, winningNumbers} = req.body;

    if (!gameId || !Array.isArray(winningNumbers)) {
      return res.status(400).json({error: 'Invalid request data'});
    }

    const bids = await Bid.find({game: gameId, status: 'pending'});
    let processedBids = 0;

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
      processedBids++;
    }

    res.json({message: 'Results declared', processedBids});
  } catch (error) {
    console.error('Declare results error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

module.exports = router;
