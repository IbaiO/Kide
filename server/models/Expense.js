const mongoose = require('mongoose');

// Cada entrada en 'splits' describe cuánto debe pagar un miembro concreto
const splitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Cantidad que le corresponde a este miembro (calculada al guardar)
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false } // no necesitamos _id en cada split
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
    // Importe total del gasto
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    // Quién pagó
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Cómo se reparte entre los participantes
    splitType: {
      type: String,
      enum: ['equal', 'percentage', 'exact'],
      default: 'equal',
    },
    // Lista de participantes con su parte calculada
    // Si splitType === 'equal', el servidor la calcula automáticamente
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

// ── Validación: la suma de splits debe igualar el total ──────────────────────
expenseSchema.pre('save', function (next) {
  if (!this.splits || this.splits.length === 0) return next();

  const total = this.splits.reduce((sum, s) => sum + s.amount, 0);
  // Toleramos un margen de ±1 céntimo por redondeos
  if (Math.abs(total - this.amount) > 0.01) {
    return next(
      new Error(
        `La suma de los splits (${total.toFixed(2)}) no coincide con el total (${this.amount.toFixed(2)})`
      )
    );
  }
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);
