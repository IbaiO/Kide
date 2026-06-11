const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const { default: MongoStore } = require('connect-mongo');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;

// ─── Conexión a MongoDB ───────────────────────────────────────────────────────
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch((err) => {
    console.error('❌ Error al conectar a MongoDB:', err.message);
    process.exit(1);
  });

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000', // Puerto por defecto clásico
  'http://localhost:5173', // Puerto de Vite en modo desarrollo (npm run dev)
  'http://localhost:4173', // Puerto de Vite en modo PWA Preview (el de tus nuevos scripts)
  process.env.CLIENT_ORIGIN // Tu futuro dominio .eus en producción
].filter(Boolean); // Limpia valores vacíos si CLIENT_ORIGIN no está definido aún

app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como Postman o Server-to-Server) o si están en la lista
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por CORS: Origen no permitido por Kide-Server'));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Sesiones persistidas en MongoDB ─────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'kide-dev-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 * 7, // 7 egun (seg)
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 egun (ms)
  },
}));

// ─── Rutas ────────────────────────────────────────────────────────────────────
// Ruta de salud — útil para comprobar que el servidor responde
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});


app.use('/api/users', require('./routes/users'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/expenses', require('./routes/expenses'));

// ─── Arranque ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Servidor Kide escuchando en http://localhost:${PORT}`);
});
