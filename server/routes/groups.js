const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

async function getMongoUser(firebaseUid) {
  const user = await User.findOne({ firebaseUid }).lean();
  if (!user) throw new Error('Ez da erabiltzailea aurkitu');
  return user;
}

// GET /api/groups
router.get('/', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const groups = await Group.find({ members: user._id })
      .populate('members', 'displayName email photoURL')
      .populate('createdBy', 'displayName')
      .lean();

    return res.json(groups);
  } catch (err) {
    console.error('GET /groups:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/groups
router.post('/', async (req, res) => {
  const { name, description } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Taldearen izena beharrezkoa da' });
  }

  try {
    const user = await getMongoUser(req.user.uid);

    const newGroup = await Group.create({
      name,
      description,
      createdBy: user._id,
      members: [user._id]
    });

    await User.findByIdAndUpdate(user._id, {
      $push: { groups: newGroup._id }
    });

    return res.status(201).json(newGroup);
  } catch (err) {
    console.error('POST /groups:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);

    const group = await Group.findOne({ _id: req.params.id, members: user._id })
      .populate('members', 'displayName email photoURL')
      .populate({
        path: 'expenses',
        populate: [
          { path: 'paidBy', select: 'displayName email photoURL' },
          { path: 'splits.user', select: 'displayName email photoURL' }
        ]
      })
      .lean();

    if (!group) return res.status(404).json({ error: 'Taldea ez da aurkitu edo ez zara kide' });

    return res.json(group);
  } catch (err) {
    console.error('GET /groups/:id:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/groups/:id
router.put('/:id', async (req, res) => {
  const { name, description, photoURL } = req.body;
  try {
    const user = await getMongoUser(req.user.uid);
    const group = await Group.findById(req.params.id);

    if (!group) return res.status(404).json({ error: 'Taldea ez da aurkitu' });
    if (group.createdBy.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'Baimenik ez taldea editatzeko' });
    }

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (photoURL !== undefined) group.photoURL = photoURL;

    await group.save();
    return res.json(group);
  } catch (err) {
    console.error('PUT /groups/:id:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/groups/:id
router.delete('/:id', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const group = await Group.findById(req.params.id);

    if (!group) return res.status(404).json({ error: 'Taldea ez da aurkitu' });
    if (group.createdBy.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'Baimenik ez taldea ezabatzeko' });
    }

    await Expense.deleteMany({ _id: { $in: group.expenses } });
    await Group.findByIdAndDelete(req.params.id);

    await User.updateMany(
      { groups: group._id },
      { $pull: { groups: group._id } }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /groups/:id:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:id/members
router.post('/:id/members', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Emaila beharrezkoa da' });

  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Taldea ez da aurkitu' });

    const targetUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (!targetUser) {
      return res.status(404).json({ error: `Ez da aurkitu "${email}" helbidedun erabiltzailerik` });
    }

    const alreadyMember = group.members.some(m => m.toString() === targetUser._id.toString());
    if (alreadyMember) return res.status(400).json({ error: 'Erabiltzailea lehendik kide da' });

    group.members.push(targetUser._id);
    await group.save();

    await User.findByIdAndUpdate(targetUser._id, {
      $addToSet: { groups: group._id }
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('POST /groups/:id/members:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/groups/:id/members/:userId
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const group = await Group.findById(req.params.id);

    if (!group) return res.status(404).json({ error: 'Taldea ez da aurkitu' });
    if (group.createdBy.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'Baimenik ez kideak kentzeko' });
    }

    if (group.createdBy.toString() === req.params.userId) {
      return res.status(400).json({ error: 'Sortzaileak ezin du taldea utzi modu honetan' });
    }

    group.members = group.members.filter(m => m.toString() !== req.params.userId);
    await group.save();

    await User.findByIdAndUpdate(req.params.userId, {
      $pull: { groups: group._id }
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /groups/:id/members/:userId:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:id/leave
router.post('/:id/leave', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const group = await Group.findById(req.params.id);

    if (!group) return res.status(404).json({ error: 'Taldea ez da aurkitu' });

    const isMember = group.members.some(m => m.toString() === user._id.toString());
    if (!isMember) {
      return res.status(400).json({ error: 'Ez zara talde honetako kidea' });
    }

    const isCreator = group.createdBy.toString() === user._id.toString();

    if (isCreator) {
      const remainingMembers = group.members.filter(m => m.toString() !== user._id.toString());

      if (remainingMembers.length === 0) {
        await Expense.deleteMany({ _id: { $in: group.expenses } });
        await Group.findByIdAndDelete(req.params.id);
        
        await User.findByIdAndUpdate(user._id, {
          $pull: { groups: group._id }
        });

        return res.json({ success: true, deleted: true, message: 'Taldea ezabatu da azken kidea zarelako.' });
      }

      group.createdBy = remainingMembers[0];
    }

    group.members = group.members.filter(m => m.toString() !== user._id.toString());
    await group.save();

    await User.findByIdAndUpdate(user._id, {
      $pull: { groups: group._id }
    });

    return res.json({ success: true, deleted: false, message: 'Taldetik ongi irten zara.' });

  } catch (err) {
    console.error('POST /groups/:id/leave:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id/invite-link
router.get('/:id/invite-link', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const group = await Group.findOne({ _id: req.params.id, members: user._id });

    if (!group) return res.status(404).json({ error: 'Taldea ez da aurkitu edo ez zara kide' });

    // Tokena finkoa da: behin sortu eta beti bera izango da
    if (!group.inviteToken) {
      group.inviteToken = crypto.randomBytes(16).toString('hex');
      await group.save();
    }

    return res.json({ token: group.inviteToken });
  } catch (err) {
    console.error('GET /groups/:id/invite-link:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/join/:token  -> gonbidapenaren aurrebista (taldearen izena, dagoeneko kide den, etab.)
router.get('/join/:token', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const group = await Group.findOne({ inviteToken: req.params.token })
      .select('name description members')
      .lean();

    if (!group) return res.status(404).json({ error: 'Gonbidapen-esteka ez da baliozkoa' });

    const alreadyMember = group.members.some(m => m.toString() === user._id.toString());

    return res.json({
      id: group._id,
      name: group.name,
      description: group.description,
      alreadyMember,
    });
  } catch (err) {
    console.error('GET /groups/join/:token:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/join/:token  -> erabiltzaile autentifikatua taldera gehitu
router.post('/join/:token', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const group = await Group.findOne({ inviteToken: req.params.token });

    if (!group) return res.status(404).json({ error: 'Gonbidapen-esteka ez da baliozkoa' });

    const alreadyMember = group.members.some(m => m.toString() === user._id.toString());

    if (!alreadyMember) {
      group.members.push(user._id);
      await group.save();

      await User.findByIdAndUpdate(user._id, {
        $addToSet: { groups: group._id }
      });
    }

    return res.json({ id: group._id, name: group.name, alreadyJoined: alreadyMember });
  } catch (err) {
    console.error('POST /groups/join/:token:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id/optimize
router.get('/:id/optimize', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);

    const group = await Group.findOne({ _id: req.params.id, members: user._id })
      .populate('members', 'displayName')
      .populate({
        path: 'expenses',
        populate: [
          { path: 'paidBy', select: 'displayName' },
          { path: 'splits.user', select: 'displayName' }
        ]
      });

    if (!group) return res.status(404).json({ error: 'Taldea ez da aurkitu' });

    const memberMap = {};
    
    group.members.forEach(m => {
      memberMap[m._id.toString()] = { id: m._id, displayName: m.displayName };
    });

    group.expenses.forEach(exp => {
      if (exp.paidBy && !memberMap[exp.paidBy._id.toString()]) {
        memberMap[exp.paidBy._id.toString()] = { id: exp.paidBy._id, displayName: exp.paidBy.displayName + " (Irten da)" };
      }
      exp.splits.forEach(s => {
        if (s.user && !memberMap[s.user._id.toString()]) {
          memberMap[s.user._id.toString()] = { id: s.user._id, displayName: s.user.displayName + " (Irten da)" };
        }
      });
    });

    const balances = {};
    Object.keys(memberMap).forEach(uid => {
      balances[uid] = 0;
    });

    group.expenses.forEach(exp => {
      const payerId = exp.paidBy?._id?.toString() || exp.paidBy?.toString();
      if (balances[payerId] !== undefined) {
        balances[payerId] += exp.amount;
      }
      exp.splits.forEach(s => {
        const targetId = s.user?._id?.toString() || s.user?.toString();
        if (balances[targetId] !== undefined) {
          balances[targetId] -= s.amount;
        }
      });
    });

    const balanceArray = Object.keys(balances).map(uid => ({
      userId: uid,
      net: balances[uid]
    })).filter(b => Math.abs(b.net) > 0.01);
    
    // Exekuzio lokala
    let scriptPath = path.join(process.cwd(), '..', 'python', 'optimizazioa.py');

    // Online exekuzioa (VM)
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.join(process.cwd(), 'python', 'optimizazioa.py');
    }
    let result = [];
    try {
      result = await runPython(scriptPath, balanceArray);
    } catch (pyErr) {
      console.error('ERROREA OPTIMIZAZIOA.PY EXEKUTATZEAN:', pyErr.message);
      return res.status(500).json({ error: `Errorea optimizazio motorrean: ${pyErr.message}` });
    }

    const transfers = result.map(t => ({
      from:   memberMap[t.from]   || { id: t.from,   displayName: `Erabiltzaile ohia (${t.from.substring(0,4)})` },
      to:     memberMap[t.to]     || { id: t.to,     displayName: `Erabiltzaile ohia (${t.to.substring(0,4)})` },
      amount: t.amount,
    }));

    return res.json({ transfers });
  } catch (err) {
    console.error('GET /groups/:id/optimize:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

function runPython(scriptPath, inputData) {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [scriptPath]);
    let stdout = '';
    let stderr = '';

    py.stdout.on('data', d => (stdout += d.toString()));
    py.stderr.on('data', d => (stderr += d.toString()));

    py.on('close', code => {
      if (code !== 0) return reject(new Error(stderr || `Python exetech code ${code}`));
      try {
        const parsed = JSON.parse(stdout);
        if (parsed && parsed.error) {
          return reject(new Error(parsed.error));
        }
        resolve(parsed);
      } catch (parseErr) {
        reject(new Error(`Malformed JSON output: ${stdout}`));
      }
    });

    py.stdin.write(JSON.stringify(inputData));
    py.stdin.end();
  });
}

module.exports = router;