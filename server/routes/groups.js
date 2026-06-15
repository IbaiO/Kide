const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense');
const { verifyToken } = require('../middleware/auth');

// Todas las rutas de grupos requieren autenticación
router.use(verifyToken);

// ─── Helper: obtener el _id de MongoDB a partir del firebaseUid ───────────────
async function getMongoUser(firebaseUid) {
  const user = await User.findOne({ firebaseUid }).lean();
  if (!user) throw new Error('Ez da erabiltzailea aurkitu');
  return user;
}

// ─── GET /api/groups ──────────────────────────────────────────────────────────
// Devuelve todos los grupos en los que participa el usuario autenticado
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

// ─── POST /api/groups ─────────────────────────────────────────────────────────
// Crea un nuevo grupo; el creador se añade automáticamente como miembro
router.post('/', async (req, res) => {
  const { name, description } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Taldearen izena beharrezkoa da' });
  }

  try {
    const user = await getMongoUser(req.user.uid);

    const newGroup = await Group.create({
      name,
      description: description || '',
      createdBy: user._id,
      members: [user._id], // El creador entra como primer miembro
    });

    // Añadir el grupo a la lista de grupos del usuario
    await User.findByIdAndUpdate(user._id, { $addToSet: { groups: newGroup._id } });

    return res.status(201).json(newGroup);
  } catch (err) {
    console.error('POST /groups:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/groups/:id ──────────────────────────────────────────────────────
// Obtiene el detalle de un grupo específico, incluyendo sus miembros y gastos
router.get('/:id', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    
    // Buscamos el grupo asegurando que el usuario sea miembro de él
    const group = await Group.findOne({ _id: req.params.id, members: user._id })
      .populate('members', 'displayName email photoURL')
      .populate('createdBy', 'displayName')
      .populate({
        path: 'expenses',
        populate: { path: 'paidBy', select: 'displayName photoURL' },
        options: { sort: { date: -1 } } // ordenados por fecha descendente
      });

    if (!group) {
      return res.status(404).json({ error: 'Ez da taldea aurkitu edo baimena falta da' });
    }

    return res.json(group);
  } catch (err) {
    console.error('GET /groups/:id:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/groups/:id ──────────────────────────────────────────────────────
// Permite editar el nombre/descripción de un grupo (solo el creador)
router.put('/:id', async (req, res) => {
  const { name, description } = req.body;

  try {
    const user = await getMongoUser(req.user.uid);
    const group = await Group.findOne({ _id: req.params.id, createdBy: user._id });

    if (!group) {
      return res.status(403).json({ error: 'Sortzaileak soilik aldatu dezake taldea' });
    }

    if (name) group.name = name;
    if (description !== undefined) group.description = description;

    await group.save();
    return res.json(group);
  } catch (err) {
    console.error('PUT /groups/:id:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/groups/:id ───────────────────────────────────────────────────
// Elimina un grupo y todos sus gastos asociados en cascada (solo el creador)
router.delete('/:id', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);
    const group = await Group.findOne({ _id: req.params.id, createdBy: user._id });

    if (!group) {
      return res.status(403).json({ error: 'Sortzaileak soilik ezabatu dezake taldea' });
    }

    // 1. Eliminar todos los gastos asociados al grupo
    await Expense.deleteMany({ group: group._id });

    // 2. Quitar el grupo de la lista de perfiles de todos los miembros
    await User.updateMany(
      { _id: { $in: group.members } },
      { $pull: { groups: group._id } }
    );

    // 3. Eliminar el grupo
    await Group.deleteOne({ _id: group._id });

    return res.json({ message: 'Taldea eta gastu guztiak ezabatu dira' });
  } catch (err) {
    console.error('DELETE /groups/:id:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/groups/:id/members ─────────────────────────────────────────────
// Añade un nuevo miembro al grupo buscando por su email
router.post('/:id/members', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Posta elektronikoa beharrezkoa da' });
  }

  try {
    const requestingUser = await getMongoUser(req.user.uid);
    const group = await Group.findOne({ _id: req.params.id, members: requestingUser._id });

    if (!group) {
      return res.status(404).json({ error: 'Ez da taldea aurkitu edo baimena falta da' });
    }

    const newMember = await User.findOne({ email: email.toLowerCase().trim() });
    if (!newMember) {
      return res.status(404).json({ error: 'Ez dako posta elektroniko horri lotutako erabiltzailerik' });
    }

    // Comprobar si ya es miembro
    if (group.members.includes(newMember._id)) {
      return res.status(400).json({ error: 'Erabiltzailea taldeko kide da dagoeneko' });
    }

    group.members.push(newMember._id);
    await group.save();
    await User.findByIdAndUpdate(newMember._id, { $addToSet: { groups: group._id } });

    return res.status(201).json({ message: `${newMember.displayName} taldean sartu da` });
  } catch (err) {
    console.error('POST /groups/:id/members:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/groups/:id/members/:userId ───────────────────────────────────
// Elimina un miembro del grupo (solo el creador, y no puede eliminarse a sí mismo)
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const requestingUser = await getMongoUser(req.user.uid);
    const group = await Group.findOne({ _id: req.params.id, createdBy: requestingUser._id });

    if (!group) {
      return res.status(403).json({ error: 'Sortzaileak soilik bota dezake taldekide bat' });
    }

    if (req.params.userId === requestingUser._id.toString()) {
      return res.status(400).json({ error: 'Sortzaileak ezin du taldea utzi' });
    }

    group.members = group.members.filter((m) => m.toString() !== req.params.userId);
    await group.save();
    await User.findByIdAndUpdate(req.params.userId, { $pull: { groups: group._id } });

    return res.json({ message: 'Taldekidea taldetik atera da' });
  } catch (err) {
    console.error('DELETE /groups/:id/members/:userId:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── NUEVO ENDPOINT FASE 4: GET /api/groups/:id/optimize ──────────────────────
// Calcula los balances netos y lanza el motor PuLP en Python por stdin/stdout
router.get('/:id/optimize', async (req, res) => {
  try {
    const user = await getMongoUser(req.user.uid);

    // Verificamos que el usuario pertenece al grupo y traemos la info de los miembros
    const group = await Group.findOne({
      _id: req.params.id,
      members: user._id,
    }).populate('members', 'displayName email');

    if (!group) {
      return res.status(404).json({ error: 'Ez da taldea aurkitu edo baimena falta da' });
    }

    // 1. Calcular balances del grupo
    const expenses = await Expense.find({ group: req.params.id }).lean();

    const balance = {};
    group.members.forEach((m) => (balance[m._id.toString()] = 0));

    for (const expense of expenses) {
      const payer = expense.paidBy.toString();
      if (balance[payer] !== undefined) {
        balance[payer] += expense.amount;
      }
      for (const split of expense.splits) {
        const participant = split.user.toString();
        if (balance[participant] !== undefined) {
          balance[participant] -= split.amount;
        }
      }
    }

    // Formateamos el array de balances para el stdin de Python
    const balanceArray = Object.entries(balance).map(([userId, net]) => ({
      userId,
      net: parseFloat(net.toFixed(2)),
    }));

    // 2. Ejecutar el script de Python (PuLP)
    const scriptPath = path.resolve(__dirname, '../../python/optimizazioa.py');
    
    let result;
    try {
      result = await runPython(scriptPath, balanceArray);
    } catch (pyErr) {
      return res.status(500).json({ error: `Errorea optimizazio motorrean: ${pyErr.message}` });
    }

    // 3. Mapear los IDs devueltos por Python con los nombres reales de MongoDB
    const memberMap = {};
    group.members.forEach((m) => {
      memberMap[m._id.toString()] = { id: m._id, displayName: m.displayName };
    });

    const transfers = result.map((t) => ({
      from:   memberMap[t.from]   || { id: t.from,   displayName: t.from },
      to:     memberMap[t.to]     || { id: t.to,     displayName: t.to },
      amount: t.amount,
    }));

    return res.json({ transfers });
  } catch (err) {
    console.error('GET /groups/:id/optimize:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Helper: Función que gestiona el proceso asíncrono hijo de Python
function runPython(scriptPath, inputData) {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [scriptPath]);

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (data) => (stdout += data.toString()));
    py.stderr.on('data', (data) => (stderr += data.toString()));

    py.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python-ek errore-kode hau eman du: ${code}: ${stderr}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Optimizatzailearen emaitza okerra: ${stdout}`));
      }
    });

    py.stdin.write(JSON.stringify(inputData));
    py.stdin.end();
  });
}

module.exports = router;