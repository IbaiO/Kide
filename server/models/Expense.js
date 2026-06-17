const mongoose = require('mongoose');

const splitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false } // Ez degu _id behar split bakoitzean
);

const expenseSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    splitType: {
      type: String,
      enum: ['equal', 'percentage', 'exact'],
      default: 'equal',
    },
    splits: [splitSchema],

    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Split-en batura %100 dela egiaztatu
expenseSchema.pre('save', function (next) {
  if (!this.splits || this.splits.length === 0) return next();

  const total = this.splits.reduce((sum, s) => sum + s.amount, 0);
  // Xentimo bat gorabehera
  if (Math.abs(total - this.amount) > 0.01) {
    return next(
      new Error(
        `Split-en baturak (${total.toFixed(2)}) ez du totalarekin koinziditzen (${this.amount.toFixed(2)})`
      )
    );
  }
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);