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

// MongoDB-ra konektatu
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB-ra konektata!'))
  .catch((err) => {
    console.error('Errorea MongoDB-ra konektatzean:', err.message);
    process.exit(1);
  });

// Middleware
const allowedOrigins = [
  'http://localhost:3000', // Portu lehenetsia
  'http://localhost:5173', // Vite-ren portua garapen moduan (npm run dev)
  'http://localhost:4173', // Vite-ren portua PWA Preview moduan
  process.env.CLIENT_ORIGIN // .eus domeinua (Prozesuan)
].filter(Boolean); // Balio hutsak garbitzen ditu CLIENT_ORIGIN definituta ez badago

app.use(cors({
  origin: function (origin, callback) {
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

// MongoDB-n saio iraunkorrak
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

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});


app.use('/api/users', require('./routes/users'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/expenses', require('./routes/expenses'));

// Abiaraztea
app.listen(PORT, () => {
  console.log(`Kide zerbitzaria http://localhost:${PORT} helbidean entzuten`);
});