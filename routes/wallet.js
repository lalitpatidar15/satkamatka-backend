const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({error: 'User not found'});
    }
    res.json({balance: user.wallet});
  } catch (error) {
    console.error('Balance error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

router.post('/add-funds', auth, async (req, res) => {
  try {
    const {amount, paymentMethod, transactionId} = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({error: 'Invalid amount'});
    }

    const transaction = new Transaction({
      user: req.user.userId,
      type: 'credit',
      amount,
      paymentMethod: paymentMethod?.trim(),
      transactionId: transactionId?.trim(),
      status: 'pending',
    });

    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Add funds error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

router.post('/withdraw', auth, async (req, res) => {
  try {
    const {amount, bankDetails} = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({error: 'Invalid amount'});
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({error: 'User not found'});
    }
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
    console.error('Withdraw error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

router.get('/transactions', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({user: req.user.userId}).sort({
      createdAt: -1,
    });
    res.json(transactions);
  } catch (error) {
    console.error('Transactions error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

router.get('/fund-requests', adminAuth, async (req, res) => {
  try {
    const transactions = await Transaction.find({status: 'pending'}).populate(
      'user',
      'name phone',
    );
    res.json(transactions);
  } catch (error) {
    console.error('Fund requests error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

router.put('/fund-requests/:id', adminAuth, async (req, res) => {
  try {
    const {status} = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({error: 'Invalid status'});
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const transaction = await Transaction.findByIdAndUpdate(
        req.params.id,
        {status},
        {new: true, session},
      );

      if (!transaction) {
        await session.abortTransaction();
        return res.status(404).json({error: 'Transaction not found'});
      }

      if (status === 'approved' && transaction.type === 'credit') {
        await User.findByIdAndUpdate(
          transaction.user,
          {$inc: {wallet: transaction.amount}},
          {session},
        );
      }

      await session.commitTransaction();
      res.json(transaction);
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Fund request update error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

router.post('/bank-details', auth, async (req, res) => {
  try {
    const {bankName, accountNumber, ifscCode, accountHolder} = req.body;

    if (!bankName?.trim() || !accountNumber?.trim() || !ifscCode?.trim()) {
      return res.status(400).json({error: 'Bank name, account number, and IFSC are required'});
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        bankDetails: {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim(),
          accountHolder: accountHolder?.trim(),
        },
      },
      {new: true},
    );

    if (!user) {
      return res.status(404).json({error: 'User not found'});
    }

    res.json({message: 'Bank details saved', bankDetails: user.bankDetails});
  } catch (error) {
    console.error('Bank details error:', error.message);
    res.status(500).json({error: 'Server error'});
  }
});

module.exports = router;
