const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('./firebase-config.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;