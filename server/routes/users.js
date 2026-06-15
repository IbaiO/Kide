const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

/**
 * POST /api/users/register
 *
 * Se llama tras el login exitoso en el cliente (con Firebase SDK).
 * El cliente ya autenticó al usuario con Firebase; aquí creamos (o
 * recuperamos) su perfil en MongoDB y guardamos la sesión en el servidor.
 *
 * Body: { idToken }  ← token que devuelve Firebase tras el login en el cliente
 */
router.post('/register', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'Falta el idToken' });
  }

  try {
    // 1. Verificamos el token con Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // 2. Buscamos al usuario en MongoDB; si no existe, lo creamos (upsert)
    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        firebaseUid: uid,
        email: email,
        displayName: name || email.split('@')[0],
        photoURL: picture || null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 3. Guardamos en sesión para no tener que re-verificar en cada petición
    req.session.userId = user._id.toString();
    req.session.firebaseUid = uid;

    return res.status(201).json({
      message: 'Usuario registrado correctamente',
      user: {
        id: user._id,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      },
    });
  } catch (err) {
    console.error('Error en /register:', err.message);
    return res.status(500).json({ error: 'Error al registrar el usuario' });
  }
});

/**
 * GET /api/users/me
 *
 * Devuelve el perfil del usuario autenticado.
 * Ruta protegida: requiere sesión activa O token en cabecera.
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid })
      .populate('groups', 'name') // trae solo el nombre de cada grupo
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'Ez da erabiltzailea aurkitu en la base de datos' });
    }

    return res.json({
      id: user._id,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      groups: user.groups,
    });
  } catch (err) {
    console.error('Error en /me:', err.message);
    return res.status(500).json({ error: 'Error al obtener el perfil' });
  }
});

/**
 * POST /api/users/logout
 *
 * Destruye la sesión del servidor.
 * El cliente también debe llamar a firebase.auth().signOut() por su lado.
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al cerrar sesión' });
    }
    res.clearCookie('connect.sid');
    return res.json({ message: 'Sesión cerrada correctamente' });
  });
});

module.exports = router;
