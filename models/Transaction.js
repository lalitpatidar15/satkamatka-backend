const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['upi', 'bank_transfer', 'cash'],
    },
    transactionId: String,
    bankDetails: {
      bankName: String,
      accountNumber: String,
      ifscCode: String,
      accountHolder: String,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    description: String,
  },
  {timestamps: true},
);

module.exports = mongoose.model('Transaction', transactionSchema);
