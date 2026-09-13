// "Logged-in AND isAdmin" guard, derived from the SAME source of truth the
// rest of the app uses: req.session.userId (populated by the Bearer-JWT shim
// in index.js) + the User.isAdmin flag in Mongo. isAdmin is never read from
// the request body/headers.
//
// This does not touch any existing route — nothing imports it yet. It exists
// as a reusable building block and is composed inside requireAdminPanel.js.

const User = require('../models/User.model.js');

async function requireAdmin(req, res, next) {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Not logged in' });
    }
    const user = await User.findById(req.session.userId).select('username email isAdmin').maxTimeMS(5000);
    if (!user) {
      return res.status(401).json({ message: 'Not logged in' });
    }
    if (!user.isAdmin) {
      return res.status(403).json({ message: 'Admin privileges required' });
    }
    req.authUser = user;
    next();
  } catch (err) {
    console.error('[requireAdmin] error:', err.message);
    res.status(500).json({ message: 'Authorization check failed' });
  }
}

module.exports = requireAdmin;
