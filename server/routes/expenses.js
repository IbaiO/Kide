const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { calculateSplits } = require('../utils/splits');

router.use(verifyToken);

// Middleware berrerabilgarria: balidazio erroreak badaude, katea eten
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
}

// Balidazio arau partekatuak (POST eta PUT)
const descriptionRules = body('description')
  .if(body('description').exists())
  .trim()
  .notEmpty()
  .withMessage('Gastuaren kontzeptua ezin da hutsik egon');

const amountRules = body('amount')
  .if(body('amount').exists())
  .isFloat({ gt: 0 })
  .withMessage('Zenbatekoa 0 baino handiagoa behar da');

const splitTypeRules = body('splitType')
  .optional()
  .isIn(['equal', 'percentage', 'exact'])
  .withMessage("Banaketa mota 'equal', 'percentage' edo 'exact' izan behar da");

const receiptURLRules = body('receiptURL')
  .optional({ nullable: true })
  .custom((value) => value === null || typeof value === 'string')
  .withMessage('Tiketaren URL-ak ez dauka formatu egokia');

const createExpenseRules = [
  body('groupId')
    .notEmpty()
    .withMessage('groupId nahitaezkoa da')
    .isMongoId()
    .withMessage('groupId-k ez dauka formatu egokia'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Gastuaren kontzeptua ezin da hutsik egon'),
  body('amount')
    .notEmpty()
    .withMessage('Zenbatekoa nahitaezkoa da')
    .isFloat({ gt: 0 })
    .withMessage('Zenbatekoa 0 baino handiagoa behar da'),
  splitTypeRules,
  receiptURLRules,
];

// PUTerako arauak (Denak aukerazkoak)
const updateExpenseRules = [
  param('id')
    .isMongoId()
    .withMessage('Gastuaren ID-ak ez dauka formatu egokia'),
  descriptionRules,
  amountRules,
  splitTypeRules,
  receiptURLRules,
];

// Barne helper-ak
async function getMongoUser(firebaseUid) {
  const user = await User.findOne({ firebaseUid }).lean();
  if (!user) throw new Error('Ez da erabiltzailea aurkitu');
  return user;
}

async function assertMember(groupId, userId) {
  const group = await Group.findOne({ _id: groupId, members: userId }).lean();
  if (!group) throw new Error('Ez da taldea aurkitu edo baimena falta da');
  return group;
}

function notifyGroup(req, groupId, action, expenseId) {
  if (req.io && groupId) {
    req.io.to(groupId.toString()).emit('gastuak_eguneratuta', {
      groupId: groupId.toString(),
      action,
      expenseId: expenseId ? expenseId.toString() : undefined,
    });
  }
}

// GET /api/expenses/group/:groupId
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

// POST /api/expenses
// Gastu berri bat sortu
// Body:
// {
//   groupId:       string  (obligatorio, MongoId válido)
//   description:   string  (obligatorio, no vacío)
//   amount:        number  (obligatorio, > 0)
//   date?:         ISO string
//   splitType?:    'equal' | 'percentage' | 'exact'  (default: 'equal')
//   participants?: [{ user: id, value?: number }]
//   receiptURL?:   string | null
// }
router.post('/', createExpenseRules, handleValidation, async (req, res) => {
  const {
    groupId,
    description,
    amount,
    date,
    splitType = 'equal',
    participants,
    receiptURL,
  } = req.body;

  try {
    const user = await getMongoUser(req.user.uid);
    const group = await assertMember(groupId, user._id);

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
      receiptURL: receiptURL || null,
    });

    await expense.populate([
      { path: 'paidBy', select: 'displayName photoURL' },
      { path: 'splits.user', select: 'displayName' },
    ]);

    notifyGroup(req, groupId, 'created', expense._id);

    return res.status(201).json(expense);
  } catch (err) {
    console.error('POST /expenses:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/expenses/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const expense = await Expense.findById(req.params.id)
      .populate('paidBy', 'displayName photoURL')
      .populate('splits.user', 'displayName')
      .lean();

    if (!expense) return res.status(404).json({ error: 'Ez da gastua aurkitu' });

    await assertMember(expense.group, user._id);

    return res.json(expense);
  } catch (err) {
    console.error('GET /expenses/:id:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id
// Gastu bat eguneratu
router.put('/:id', updateExpenseRules, handleValidation, async (req, res) => {
  const { description, amount, date, splitType, participants, receiptURL } = req.body;

  try {
    const user = await getMongoUser(req.user.uid);
    const expense = await Expense.findOne({ _id: req.params.id, paidBy: user._id });

    if (!expense) {
      return res.status(403).json({ error: 'Ordaindu duenak soilik aldatu dezake gastua' });
    }

    const newAmount = amount ? parseFloat(amount) : expense.amount;
    const newSplitType = splitType || expense.splitType;

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
    if (receiptURL !== undefined) expense.receiptURL = receiptURL || null;

    await expense.save();
    await expense.populate([
      { path: 'paidBy', select: 'displayName photoURL' },
      { path: 'splits.user', select: 'displayName' },
    ]);

    notifyGroup(req, expense.group, 'updated', expense._id);

    return res.json(expense);
  } catch (err) {
    console.error('PUT /expenses/:id:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const expense = await Expense.findOne({ _id: req.params.id, paidBy: user._id });

    if (!expense) {
      return res.status(403).json({ error: 'Ordaindu duenak soilik ezabatu dezake gastua' });
    }

    const groupId = expense.group;
    const expenseId = expense._id;

    await expense.deleteOne();

    notifyGroup(req, groupId, 'deleted', expenseId);

    return res.json({ message: 'Gastua ezanatu da' });
  } catch (err) {
    console.error('DELETE /expenses/:id:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/group/:groupId/balance
router.get('/group/:groupId/balance', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const group = await assertMember(req.params.groupId, user._id);

    const expenses = await Expense.find({ group: req.params.groupId }).lean();

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