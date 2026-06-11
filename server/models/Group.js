const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // El usuario que creó el grupo
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Miembros del grupo — siempre incluye al creador
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    // Campo virtual: los gastos se consultan desde Expense, no se embeben aquí
    // Así evitamos documentos enormes y facilitamos el CRUD de gastos
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: permite hacer group.expenses en el servidor sin almacenarlos en el doc
groupSchema.virtual('expenses', {
  ref: 'Expense',
  localField: '_id',
  foreignField: 'group',
});

module.exports = mongoose.model('Group', groupSchema);
