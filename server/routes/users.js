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
  const { idToken, displayName: manualDisplayName } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken-a falta da' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    const existingUser = await User.findOne({ firebaseUid: uid });

    const finalPhotoURL = existingUser?.photoURL || picture || null;

    let finalDisplayName = existingUser?.displayName || name || manualDisplayName || email.split('@')[0];

    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        firebaseUid: uid,
        email,
        displayName: finalDisplayName,
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
// displayName eta photoURL aukeratutako koloretara egokitu MongoDB-n eta Firebase-n.
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

    await admin.auth().updateUser(req.user.uid, {
      displayName: displayName.trim()
    });

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

// DELETE /api/users/me
// Ezabatu erabiltzailea eta bere informazioa (MongoDB + Firebase Auth)
router.delete('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'Ez da erabiltzailea aurkitu' });

    await admin.auth().deleteUser(req.user.uid);

    await Group.updateMany(
      { members: user._id },
      { $pull: { members: user._id } }
    );

    await Expense.deleteMany({ paidBy: user._id });
    
    await User.deleteOne({ _id: user._id });

    req.session.destroy((err) => {
      if (err) {
        console.error('Errorea saioa suntsitzean:', err);
      }
      res.clearCookie('connect.sid');
      return res.json({ message: 'Kontua eta datu guztiak zuzen ezabatu dira.' });
    });

  } catch (err) {
    console.error('Errorea PUT /profile egitean:', err.message);
    return res.status(500).json({ error: 'Errorea erabiltzailea eta kontua ezabatzean' });
  }
});

// DELETE /api/users/unverified
// Egiaztatu gabeko kontuak ezabatzeko (MongoDB + Firebase Auth).
router.delete('/unverified', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken-a falta da' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email_verified, firebase } = decodedToken;

    if (firebase.sign_in_provider !== 'password' || email_verified !== false) {
      return res.status(403).json({ error: 'Kontu hau ez da bide honetatik ezabagarria' });
    }

    let mongoDeleted = false;
    let firebaseDeleted = false;

    try {
      await User.deleteOne({ firebaseUid: uid });
      mongoDeleted = true;
    } catch (err) {
      console.error('Errorea MongoDB-ko erabiltzailea ezabatzean:', err.message);
    }

    try {
      await admin.auth().deleteUser(uid);
      firebaseDeleted = true;
    } catch (err) {
      console.error('Errorea Firebase-ko erabiltzailea ezabatzean:', err.message);
    }

    req.session.destroy((err) => {
      if (err) {
        console.error('Errorea saioa suntsitzean unverified-en:', err);
      }
      res.clearCookie('connect.sid');
      return res.json({ 
        message: 'Kontu egiaztatu gabea ezabatu da', 
        mongoDeleted, 
        firebaseDeleted 
      });
    });  
  } catch (err) {
    console.error('Errorea /unverified ezabatzean:', err.message);
    return res.status(401).json({ error: 'Token baliogabea edo iraungia' });
  }
});

module.exports = router;