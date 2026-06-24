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
    photoURL: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    inviteToken: {
      type: String,
      unique: true,
      sparse: true, // talde zaharrek ez dute tokenik izango, gonbidapen-esteka eskatu arte
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

groupSchema.virtual('expenses', {
  ref: 'Expense',
  localField: '_id',
  foreignField: 'group',
});

module.exports = mongoose.model('Group', groupSchema);