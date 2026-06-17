const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const User = require('../models/User');
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const { verifyToken } = require('../middleware/auth');

// POST /api/users/register
// Erabiltzaile profila sortu edo sinkronizatu MongoDB-n Firebase-rekin saioa hasi ondoryen.
// photoURL atributua sinkronizatu eta babestu, ez gainidazteko.
router.post('/register', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken-a falta da' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    const existingUser = await User.findOne({ firebaseUid: uid });

    const finalPhotoURL = existingUser?.photoURL || picture || null;

    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        firebaseUid: uid,
        email,
        displayName: existingUser?.displayName || name || email.split('@')[0],
        photoURL: finalPhotoURL,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    req.session.userId = user._id.toString();
    req.session.firebaseUid = uid;

    return res.status(201).json({
      message: 'Erabiltzailea zuzen erregistratu da',
      user: {
        id: user._id,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        themeMode: user.themeMode || 'auto',
        accentColor: user.accentColor || 'purple',
      },
    });
  } catch (err) {
    console.error('Errorea /register-en:', err.message);
    return res.status(500).json({ error: 'Errorea erabiltzailea sinkronizatzean' });
  }
});

// POST /api/users/logout
// Zerbitzariko saioa itxi.
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Errorea saioa ixtean' });
    res.clearCookie('connect.sid');
    return res.json({ message: 'Saioa egoki itxi da' });
  });
});

// PUT /api/users/profile
// displayName eta photoURL aukeratutako koloretara egokitu MongoDB-n.
router.put('/profile', verifyToken, async (req, res) => {
  const { displayName, photoURL, themeMode, accentColor } = req.body;

  if (!displayName || displayName.trim() === '') {
    return res.status(400).json({ error: 'Izena ezin da hutsik egon' });
  }

  try {
    const user = await User.findOneAndUpdate(
      { firebaseUid: req.user.uid },
      { 
        displayName: displayName.trim(),
        photoURL: photoURL || null,
        themeMode: themeMode || 'auto',
        accentColor: accentColor || 'purple'
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'Ez da erabiltzailea aurkitu' });

    return res.json({
      message: 'Profila ongi eguneratu da',
      user: {
        id: user._id,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        themeMode: user.themeMode,
        accentColor: user.accentColor,
      }
    });
  } catch (err) {
    console.error('Errorea PUT /profile egitean:', err.message);
    return res.status(500).json({ error: 'Errorea profila eguneratzean' });
  }
});

module.exports = router;