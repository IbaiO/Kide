const mongoose = require('mongoose');

// Firebase bidez kudeatzen dira email, password eta hornitzaileak (Google, etab.)
// Modelo honek app-ak behar dituen beste datuak tratatzen ditu
const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    photoURL: {
      type: String,
      default: null,
    },
    themeMode: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto',
    },
    accentColor: {
      type: String,
      enum: ['purple', 'green', 'orange', 'blue', 'red', 'pink', 'cyan', 'teal', 'lime', 'yellow'],
      default: 'purple',
    },
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
      },
    ],
  },
  {
    timestamps: true, // createdAt y updatedAt automatikoki gehitu
  }
);

module.exports = mongoose.model('User', userSchema);