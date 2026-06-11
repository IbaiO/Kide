const admin = require('firebase-admin');

// Evita inicializar más de una vez si el módulo se requiere varias veces
if (!admin.apps.length) {
  const serviceAccount = require('./firebase-config.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
