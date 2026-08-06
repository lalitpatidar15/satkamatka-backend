const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// Get wallet balance
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json({balance: user.wallet});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Add funds request
router.post('/add-funds', auth, async (req, res) => {
  try {
    const {amount, paymentMethod, transactionId} = req.body;

    const transaction = new Transaction({
      user: req.user.userId,
      type: 'credit',
      amount,
      paymentMethod,
      transactionId,
      status: 'pending',
    });

    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Withdraw funds request
router.post('/withdraw', auth, async (req, res) => {
  try {
    const {amount, bankDetails} = req.body;

    const user = await User.findById(req.user.userId);
    if (user.wallet < amount) {
      return res.status(400).json({error: 'Insufficient balance'});
    }

    const transaction = new Transaction({
      user: req.user.userId,
      type: 'debit',
      amount,
      bankDetails,
      status: 'pending',
    });

    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get transaction history
router.get('/transactions', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({user: req.user.userId}).sort({
      createdAt: -1,
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Get fund requests (admin)
router.get('/fund-requests', async (req, res) => {
  try {
    const transactions = await Transaction.find({status: 'pending'}).populate(
      'user',
      'name phone',
    );
    res.json(transactions);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Approve/reject fund request (admin)
router.put('/fund-requests/:id', async (req, res) => {
  try {
    const {status} = req.body;
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      {status},
      {new: true},
    );

    if (status === 'approved' && transaction.type === 'credit') {
      await User.findByIdAndUpdate(transaction.user, {
        $inc: {wallet: transaction.amount},
      });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Add bank details
router.post('/bank-details', auth, async (req, res) => {
  try {
    const {bankName, accountNumber, ifscCode, accountHolder} = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        bankDetails: {bankName, accountNumber, ifscCode, accountHolder},
      },
      {new: true},
    );

    res.json({message: 'Bank details saved', bankDetails: user.bankDetails});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

module.exports = router;
