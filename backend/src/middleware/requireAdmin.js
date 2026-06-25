const { getDb } = require('../firebase/admin');

async function requireAdmin(req, res, next) {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const doc = await getDb().collection('users').doc(uid).get();
    if (!doc.exists || doc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.isAdmin = true;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { requireAdmin };
