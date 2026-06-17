const admin = require('../config/firebase');

// Ruta pribatuak babesteko Middleware-a.
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // { uid, email, name, picture, ... }
    next();
  } catch (err) {
    console.error('Error verificando token:', err.message);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { verifyToken };