const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { calculateSplits } = require('../utils/splits');

router.use(verifyToken);

async function getMongoUser(firebaseUid) {
  const user = await User.findOne({ firebaseUid }).lean();
  if (!user) throw new Error('Usuario no encontrado');
  return user;
}

// Comprueba que el usuario pertenece al grupo
async function assertMember(groupId, userId) {
  const group = await Group.findOne({ _id: groupId, members: userId }).lean();
  if (!group) throw new Error('Grupo no encontrado o no tienes acceso');
  return group;
}

// ─── GET /api/expenses/group/:groupId ─────────────────────────────────────────
// Lista todos los gastos de un grupo
router.get('/group/:groupId', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    await assertMember(req.params.groupId, user._id);

    const expenses = await Expense.find({ group: req.params.groupId })
      .populate('paidBy', 'displayName photoURL')
      .populate('splits.user', 'displayName')
      .sort({ date: -1 })
      .lean();

    return res.json(expenses);
  } catch (err) {
    console.error('GET /expenses/group/:groupId:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/expenses ───────────────────────────────────────────────────────
// Crea un nuevo gasto
//
// Body:
// {
//   groupId:      string,
//   description:  string,
//   amount:       number,
//   date?:        ISO string,
//   splitType?:   'equal' | 'percentage' | 'exact'  (default: 'equal')
//   participants?: [{ user: id, value?: number }]
//     · omitir participants → se incluyen todos los miembros del grupo
//     · equal    → value ignorado
//     · percentage → value = porcentaje
//     · exact    → value = cantidad exacta
// }
router.post('/', async (req, res) => {
  const { groupId, description, amount, date, splitType = 'equal', participants } = req.body;

  if (!groupId || !description || !amount) {
    return res.status(400).json({ error: 'groupId, description y amount son obligatorios' });
  }
  if (amount <= 0) {
    return res.status(400).json({ error: 'El importe debe ser mayor que 0' });
  }

  try {
    const user = await getMongoUser(req.user.uid);
    const group = await assertMember(groupId, user._id);

    // Si no se especifican participantes, usamos todos los miembros del grupo
    const rawParticipants =
      participants && participants.length > 0
        ? participants
        : group.members.map((m) => ({ user: m.toString() }));

    const splits = calculateSplits(parseFloat(amount), splitType, rawParticipants);

    const expense = await Expense.create({
      group: groupId,
      description: description.trim(),
      amount: parseFloat(amount),
      paidBy: user._id,
      splitType,
      splits,
      date: date ? new Date(date) : undefined,
    });

    await expense.populate([
      { path: 'paidBy', select: 'displayName photoURL' },
      { path: 'splits.user', select: 'displayName' },
    ]);

    return res.status(201).json(expense);
  } catch (err) {
    console.error('POST /expenses:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// ─── GET /api/expenses/:id ────────────────────────────────────────────────────
// Detalle de un gasto
router.get('/:id', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const expense = await Expense.findById(req.params.id)
      .populate('paidBy', 'displayName photoURL')
      .populate('splits.user', 'displayName')
      .lean();

    if (!expense) return res.status(404).json({ error: 'Gasto no encontrado' });

    await assertMember(expense.group, user._id);

    return res.json(expense);
  } catch (err) {
    console.error('GET /expenses/:id:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/expenses/:id ────────────────────────────────────────────────────
// Edita un gasto (solo quien lo creó)
router.put('/:id', async (req, res) => {
  const { description, amount, date, splitType, participants } = req.body;

  try {
    const user = await getMongoUser(req.user.uid);
    const expense = await Expense.findOne({ _id: req.params.id, paidBy: user._id });

    if (!expense) {
      return res.status(403).json({ error: 'Solo quien pagó puede editar este gasto' });
    }

    const newAmount = amount ? parseFloat(amount) : expense.amount;
    const newSplitType = splitType || expense.splitType;

    // Recalculamos splits si cambia el importe, el tipo o los participantes
    if (amount || splitType || participants) {
      const group = await Group.findById(expense.group).lean();
      const rawParticipants =
        participants && participants.length > 0
          ? participants
          : group.members.map((m) => ({ user: m.toString() }));

      expense.splits = calculateSplits(newAmount, newSplitType, rawParticipants);
    }

    if (description) expense.description = description.trim();
    if (amount) expense.amount = newAmount;
    if (splitType) expense.splitType = newSplitType;
    if (date) expense.date = new Date(date);

    await expense.save();
    await expense.populate([
      { path: 'paidBy', select: 'displayName photoURL' },
      { path: 'splits.user', select: 'displayName' },
    ]);

    return res.json(expense);
  } catch (err) {
    console.error('PUT /expenses/:id:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// ─── DELETE /api/expenses/:id ─────────────────────────────────────────────────
// Elimina un gasto (solo quien lo creó)
router.delete('/:id', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const expense = await Expense.findOne({ _id: req.params.id, paidBy: user._id });

    if (!expense) {
      return res.status(403).json({ error: 'Solo quien pagó puede eliminar este gasto' });
    }

    await expense.deleteOne();
    return res.json({ message: 'Gasto eliminado correctamente' });
  } catch (err) {
    console.error('DELETE /expenses/:id:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/expenses/group/:groupId/balance ──────────────────────────────────
// Calcula el balance neto de cada miembro (quién debe cuánto a quién)
// Este endpoint alimentará la Fase 4 (optimización con PuLP)
router.get('/group/:groupId/balance', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const group = await assertMember(req.params.groupId, user._id);

    const expenses = await Expense.find({ group: req.params.groupId }).lean();

    // balance[userId] = cuánto ha puesto de su bolsillo (positivo = le deben, negativo = debe)
    const balance = {};
    group.members.forEach((m) => (balance[m.toString()] = 0));

    for (const expense of expenses) {
      const payer = expense.paidBy.toString();
      balance[payer] = (balance[payer] || 0) + expense.amount;

      for (const split of expense.splits) {
        const participant = split.user.toString();
        balance[participant] = (balance[participant] || 0) - split.amount;
      }
    }

    // Formateamos para que la Fase 4 lo reciba limpio
    const result = Object.entries(balance).map(([userId, net]) => ({
      userId,
      net: parseFloat(net.toFixed(2)),
    }));

    return res.json(result);
  } catch (err) {
    console.error('GET /expenses/group/:groupId/balance:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
