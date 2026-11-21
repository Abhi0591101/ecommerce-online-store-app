const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'hyperlocal_secret_key_123456';

const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, phone: user.phone, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Account suspended' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next();
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user && user.status !== 'suspended') req.user = user;
  } catch {
    /* ignore */
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  next();
};

module.exports = { signToken, protect, optionalAuth, requireRole, JWT_SECRET };
