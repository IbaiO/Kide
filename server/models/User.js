const mongoose = require('mongoose');

// Firebase gestiona email, password y proveedor (Google, etc.)
// Este modelo guarda solo los datos extra que necesita Kide
const userSchema = new mongoose.Schema(
  {
    // uid de Firebase — es la clave que une ambos sistemas
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
    // IDs de los grupos a los que pertenece el usuario
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
      },
    ],
  },
  {
    timestamps: true, // añade createdAt y updatedAt automáticamente
  }
);

module.exports = mongoose.model('User', userSchema);
